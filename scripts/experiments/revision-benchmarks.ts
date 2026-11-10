import { ethers, network, config } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { createHash } from "crypto";
import { execFileSync } from "child_process";

// Separate from the original experiments to preserve the published protocol.
const pilot = process.env.REVISION_PROFILE === "pilot";
const rounds = pilot ? 2 : 5;
const samples = pilot ? 3 : 30;
const volumes = pilot ? [1, 10] : [1, 10, 50, 100, 200, 500, 1000, 2000];
const batches = pilot ? [5, 10] : [100, 500, 1000];
const startedAt = new Date().toISOString();
const runDir = path.resolve("results", "revision", startedAt.replace(/[:.]/g, "-"));
const rows: any[] = [];
const now = () => process.hrtime.bigint();
const ms = (t: bigint) => Number(now() - t) / 1e6;
const hash = (file: string) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
let metadata: any;
function save(status: string, error?: string) {
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, "raw.json"), JSON.stringify({ ...metadata, status, error, rows }, null, 2));
}
async function confirmed(promise: Promise<any>) {
  const tx = await promise;
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Transaction failed: ${tx.hash}`);
  return receipt;
}
async function main() {
  const chain = await ethers.provider.getNetwork();
  if (network.name !== "hardhat") throw new Error("Use the isolated in-process hardhat network for this protocol.");
  let commit = "unavailable";
  try { commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
  metadata = {
    startedAt, profile: pilot ? "pilot" : "full", rounds, samples, volumes, batches,
    network: network.name, chainId: chain.chainId.toString(), automining: true,
    node: process.version, hardhat: require("hardhat/package.json").version,
    ethers: ethers.version, platform: os.platform(), cpu: os.cpus()[0]?.model,
    memoryBytes: os.totalmem(), solidity: config.solidity, commit,
    contractSha256: hash("contracts/CarbonCreditRegistry.sol"),
    scriptSha256: hash(__filename),
    scope: "Local in-process Hardhat; includes client, signing and confirmation; not external RPC or production capacity.",
  };
  save("running");
  const [owner, validator, buyer] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("CarbonCreditRegistry");
  const deploy = async (): Promise<any> => (await factory.deploy()).waitForDeployment();
  const issue = (c: any, text = "A".repeat(16)) => c.connect(owner).issueCredit(text, "L".repeat(16), "0,0", 100n);
  async function measure(experiment: string, round: number, operation: string, fn: () => Promise<any>, extra: any = {}) {
    const t = now();
    const r = await confirmed(fn());
    const durationMs = ms(t);
    rows.push({ experiment, round, operation, ...extra, durationMs, gasUsed: r.gasUsed.toString(), txHash: r.hash, blockNumber: r.blockNumber, status: r.status });
  }
  // E4: same background, fixed target metadata and target ID for each N.
  // Each round redeploys; N denotes count AFTER the measured issue.
  for (let round = 1; round <= rounds; round++) {
    for (const volume of volumes) {
      const c = await deploy();
      for (let i = 0; i < volume - 1; i++) await confirmed(issue(c));
      const id = volume - 1;
      await measure("E4", round, "issueCredit", () => issue(c), { volume, targetId: id, firstIssue: volume === 1 });
      await measure("E4", round, "validateCredit", () => c.connect(validator).validateCredit(id), { volume, targetId: id });
      await measure("E4", round, "transferCredit", () => c.connect(owner).transferCredit(id, buyer.address), { volume, targetId: id });
      await measure("E4", round, "retireCredit", () => c.connect(buyer).retireCredit(id), { volume, targetId: id });
      save("running");
      console.log(`E4 round=${round} N=${volume}`);
    }
  }
  // E3: byte lengths around Solidity short/long string storage boundary.
  for (let round = 1; round <= rounds; round++) {
    for (const bytes of [16, 31, 32, 33, 64]) {
      const c = await deploy();
      for (let i = 0; i < 2; i++) {
        await measure("E3", round, "issueCredit", () => issue(c, "A".repeat(bytes)), { bytes, firstIssue: i === 0 });
        await measure("E3", round, "rejectCredit", () => c.connect(validator).rejectCredit(i, "R".repeat(bytes)), { bytes });
      }
    }
    save("running");
  }
  // E12: fresh contract for each operation/round; one excluded warm-up.
  for (let round = 1; round <= rounds; round++) {
    for (const operation of ["issueCredit", "validateCredit", "rejectCredit", "transferCredit", "retireCredit"]) {
      const c = await deploy();
      const invoke = (id: number) => {
        if (operation === "issueCredit") return issue(c);
        if (operation === "validateCredit") return c.connect(validator).validateCredit(id);
        if (operation === "rejectCredit") return c.connect(validator).rejectCredit(id, "R".repeat(16));
        if (operation === "transferCredit") return c.connect(owner).transferCredit(id, buyer.address);
        return c.connect(owner).retireCredit(id);
      };
      for (let i = 0; i <= samples; i++) {
        if (operation !== "issueCredit") await confirmed(issue(c));
        if (["transferCredit", "retireCredit"].includes(operation)) await confirmed(c.connect(validator).validateCredit(i));
        if (i === 0) await confirmed(invoke(i));
        else await measure("E12", round, operation, () => invoke(i), { sample: i });
      }
      save("running");
      console.log(`E12 round=${round} ${operation}`);
    }
  }
  // E13: sequential send+confirmation, deliberately not a saturation benchmark.
  for (let round = 1; round <= rounds; round++) {
    for (const batch of batches) {
      const c = await deploy();
      await confirmed(issue(c)); // excluded warm-up
      const t = now();
      let successful = 0;
      const transactions: any[] = [];
      for (let i = 0; i < batch; i++) {
        const r = await confirmed(issue(c));
        successful++;
        transactions.push({ txHash: r.hash, blockNumber: r.blockNumber, status: r.status });
      }
      const durationMs = ms(t);
      rows.push({ experiment: "E13", round, operation: "issueCredit", mode: "sequential-send-and-wait", batch, successful, failures: batch - successful, durationMs, tps: successful * 1000 / durationMs, transactions });
      save("running");
      console.log(`E13 round=${round} batch=${batch}`);
    }
  }
  save("completed");
  console.log(`Raw results: ${runDir}`);
}
main().catch(error => { save("failed", String(error?.stack ?? error)); console.error(error); process.exitCode = 1; });
