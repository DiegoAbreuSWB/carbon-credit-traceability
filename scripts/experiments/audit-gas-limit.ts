import { ethers, network, config } from "hardhat";
import { CarbonCreditRegistry__factory } from "../../typechain-types";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
async function main() {
  const [owner, validator, buyer] = await ethers.getSigners();
  const c = await new CarbonCreditRegistry__factory(owner).deploy(); await c.waitForDeployment();
  const done = async (p: Promise<any>) => { const r = await (await p).wait(); if(r.status!==1) throw Error("Preparation failed"); };
  for(let id=0;id<6;id++) {
    await done(c.issueCredit("Area","Local","0,0",100n));
    if(id===1) await done(c.connect(validator).rejectCredit(id,"Reason"));
    if(id>=2) await done(c.connect(validator).validateCredit(id));
    if(id===3) await done(c.retireCredit(id));
    if(id>=4) await done(c.transferCredit(id,buyer.address));
    if(id===5) { await done(c.connect(buyer).transferCredit(id,owner.address)); await done(c.retireCredit(id)); }
  }
  for(let id=6;id<2000;id++) await done(c.issueCredit("Area","Local","0,0",100n));
  const block = await ethers.provider.getBlock("latest");
  const report: any = { timestamp: new Date().toISOString(), kind:"gas-limit-audit", originalHistoryRun:"2026-11-10T14-59-15-343Z", explanation:"Supplementary replication of the same prepared state; original timings are preserved.", hardhat:require("hardhat/package.json").version, ethers:ethers.version, network:network.name, hardhatConfig:Object.fromEntries(Object.entries(config.networks.hardhat).filter(([key])=>key!=="accounts")), latestBlock:{number:block!.number,gasLimit:block!.gasLimit.toString()}, records:2000, events:2010, probes:[], contractSha256:createHash("sha256").update(fs.readFileSync("contracts/CarbonCreditRegistry.sol")).digest("hex"), scriptSha256:createHash("sha256").update(fs.readFileSync(__filename)).digest("hex") };
  const to = await c.getAddress(), data = c.interface.encodeFunctionData("getAuditLog");
  for(const gas of [undefined,16777216,30000000,60000000]) {
    const tx:any={to,data};if(gas!==undefined)tx.gas=ethers.toQuantity(gas);
    try {
      const encoded = await network.provider.send("eth_call",[tx,ethers.toQuantity(block!.number)]);
      const decoded = c.interface.decodeFunctionResult("getAuditLog",encoded);
      report.probes.push({requestedGas:gas??null,success:true,eventCount:decoded[0].length});
    } catch(e:any) {report.probes.push({requestedGas:gas??null,success:false,error:e.message});}
  }
  try {
    const trace=await network.provider.send("debug_traceCall",[{to,data},ethers.toQuantity(block!.number),{disableMemory:true,disableStack:true,disableStorage:true}]);
    report.defaultCallTrace={gasUsed:trace.gas,failed:trace.failed,lastError:trace.structLogs?.at(-1)?.error};
  } catch(e:any) {report.traceError=e.message;}
  const dir=path.resolve("results/gas-audit",report.timestamp.replace(/[:.]/g,"-"));fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,"audit.json"),JSON.stringify(report,(_,v)=>typeof v==="bigint"?v.toString():v,2));
  console.log(JSON.stringify({directory:dir,block:report.latestBlock,resolvedGas:(config.networks.hardhat as any).gas,hardfork:(config.networks.hardhat as any).hardfork,probes:report.probes,trace:report.defaultCallTrace},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
