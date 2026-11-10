import { ethers, network, config } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { strict as assert } from "assert";

const pilot = process.env.REVISION_PROFILE === "pilot";
const volumes = pilot ? [10, 30] : [10, 100, 500, 1000, 2000];
const rounds = pilot ? 1 : 3;
const samples = pilot ? 1 : 3;
const dir = path.resolve("results", "history", new Date().toISOString().replace(/[:.]/g, "-"));
const report: any = { profile: pilot ? "pilot" : "full", status: "running", volumes, rounds, samples, rows: [], checks: [],
  node: process.version, hardhat: require("hardhat/package.json").version, solidity: config.solidity,
  contractSha256: createHash("sha256").update(fs.readFileSync("contracts/CarbonCreditRegistry.sol")).digest("hex"),
  scriptSha256: createHash("sha256").update(fs.readFileSync(__filename)).digest("hex"),
  excludedFields: ["location", "geoCoordinates"], scope: "Isolated in-process Hardhat, automining; timings include ethers decoding." };
function save() { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir,"raw.json"), JSON.stringify(report, null, 2)); }
const compare = (a: any, b: any) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex || a.index - b.index;
function replay(logs: any[], iface: any) {
  const states = new Map<string, any>();
  const identities = new Set<string>();
  for (const log of [...logs].sort(compare)) {
    const key = `${log.transactionHash}:${log.index}`;
    assert(!identities.has(key), `Duplicate log ${key}`); identities.add(key);
    const ev = iface.parseLog(log); assert(ev, "Unknown event");
    const a = ev.args, id = a.creditId.toString();
    if (ev.name === "CreditIssued") {
      assert(!states.has(id), "Duplicate issuance");
      states.set(id, { id, issuer: a.issuer, owner: a.issuer, validator: ethers.ZeroAddress, areaName: a.areaName, co2Tonnes: a.co2Tonnes.toString(), issuedAt: a.timestamp.toString(), status: 0 });
    } else {
      const c = states.get(id); assert(c, "Event without issuance");
      if (ev.name === "CreditValidated" || ev.name === "CreditRejected") {
        assert(c.status === 0, "Invalid validation/rejection");
        c.validator = a.validator; c.status = ev.name === "CreditValidated" ? 1 : 4;
      } else if (ev.name === "CreditTransferred") {
        assert(c.status === 1 || c.status === 2, "Invalid transfer state");
        assert.equal(c.owner.toLowerCase(), a.from.toLowerCase()); c.owner = a.to; c.status = 2;
      } else if (ev.name === "CreditRetired") {
        assert(c.status === 1 || c.status === 2, "Invalid retirement state");
        assert.equal(c.owner.toLowerCase(), a.owner.toLowerCase()); c.status = 3;
      } else throw new Error(`Unexpected event ${ev.name}`);
    }
  }
  return states;
}
async function confirmed(p: Promise<any>) { const tx = await p; const r = await tx.wait(); assert.equal(r.status, 1); return r; }
async function main() {
  assert.equal(network.name, "hardhat");
  report.chainId = (await ethers.provider.getNetwork()).chainId.toString();
  save();
  const [owner, validator, buyer] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("CarbonCreditRegistry");
  for (let round=1; round<=rounds; round++) {
    const c: any = await (await factory.deploy()).waitForDeployment();
    const deployment = await c.deploymentTransaction().wait();
    const address = await c.getAddress();
    // Six paths exercise all states, repeated transfers and both retirement paths.
    for (let id=0; id<6; id++) {
      await confirmed(c.issueCredit("Area", "Local", "0,0", 100n));
      if (id === 1) await confirmed(c.connect(validator).rejectCredit(id,"Reason"));
      if (id >= 2) await confirmed(c.connect(validator).validateCredit(id));
      if (id === 3) await confirmed(c.retireCredit(id));
      if (id >= 4) await confirmed(c.transferCredit(id,buyer.address));
      if (id === 5) {
        await confirmed(c.connect(buyer).transferCredit(id,owner.address));
        await confirmed(c.retireCredit(id));
      }
    }
    let total = 6;
    for (const volume of volumes) {
      while (total < volume) { await confirmed(c.issueCredit("Area", "Local", "0,0", 100n)); total++; }
      const toBlock = await ethers.provider.getBlockNumber();
      const logs = await ethers.provider.getLogs({ address, fromBlock: deployment.blockNumber, toBlock });
      const states = replay(logs, c.interface);
      assert.equal(states.size, volume);
      for (const [id,s] of states) {
        const actual = await c.getCredit(id, { blockTag: toBlock });
        for (const field of Object.keys(s)) assert.equal(String(actual[field]).toLowerCase(), String(s[field]).toLowerCase(), `id=${id} field=${field}`);
      }
      report.checks.push({ round, volume, events: logs.length, creditsCompared: states.size, fieldsPerCredit: 8, passed: true });
      // Negative controls: ensure missing issuance, altered owner, duplicate logs are detected.
      if (volume === volumes[0]) {
        assert.throws(() => replay([...logs,logs[0]],c.interface));
        assert.throws(() => replay(logs.filter(l => !(c.interface.parseLog(l)?.name === "CreditIssued" && c.interface.parseLog(l)?.args.creditId === 5n)), c.interface));
        const altered = replay(logs,c.interface); altered.get("5").owner = buyer.address;
        assert.notEqual(altered.get("5").owner, (await c.getCredit(5)).owner);
        report.checks.push({ round, negativeControls: ["duplicate-log", "missing-issuance", "altered-owner"], passed: true });
      }
      for (let sample=1; sample<=samples; sample++) {
        for (const op of ["getLogs", "replay", "getAuditLog", "getCreditEvents"]) {
          const t = process.hrtime.bigint();
          try {
            let result: any;
            if (op === "getLogs") result = await ethers.provider.getLogs({ address, fromBlock: deployment.blockNumber, toBlock });
            else if (op === "replay") result = replay(logs,c.interface);
            else if (op === "getAuditLog") result = await c.getAuditLog({ blockTag: toBlock });
            else result = await c.getCreditEvents(5, { blockTag: toBlock });
            const durationMs = Number(process.hrtime.bigint()-t)/1e6;
            const count = result instanceof Map ? result.size : result.length;
            const expected = op === "replay" ? volume : op === "getCreditEvents" ? 5 : logs.length;
            assert.equal(count, expected);
            report.rows.push({ round, volume, events: logs.length, sample, operation: op, durationMs, count, success: true });
          } catch (error: any) {
            report.rows.push({ round, volume, events: logs.length, sample, operation: op, durationMs: Number(process.hrtime.bigint()-t)/1e6, success: false, error: String(error.message) });
            if (error.code === "ERR_ASSERTION") throw error;
          }
        }
      }
      save(); console.log(`History round=${round} N=${volume} events=${logs.length}`);
    }
  }
  report.status = "completed"; save(); console.log(`Results: ${dir}`);
}
main().catch(e=>{report.status="failed";report.error=String(e.stack??e);save();console.error(e);process.exitCode=1;});
