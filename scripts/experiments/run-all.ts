import { network } from "hardhat";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
const scripts = ["e1-state-machine", "e3-gas-measurement", "e4-scalability", "e6-audit-integrity", "e9-security", "e12-performance", "e15-interface"];
const directory = path.resolve("results", "legacy", new Date().toISOString().replace(/[:.]/g, "-"));
fs.mkdirSync(directory, { recursive: true });
const runs: any[] = [];
const hash = (p: string) => createHash("sha256").update(fs.readFileSync(p)).digest("hex");
for (const script of scripts) {
  const source = `scripts/experiments/${script}.ts`;
  const start = Date.now();
  const result = spawnSync(process.execPath, [require.resolve("hardhat/internal/cli/cli"), "run", source, "--network", network.name, "--no-compile"], { encoding: "utf8", timeout: 900000, maxBuffer: 32 * 1024 * 1024 });
  const stdout = result.stdout ?? "", stderr = result.stderr ?? "";
  fs.writeFileSync(path.join(directory, `${script}.stdout.txt`), stdout);
  fs.writeFileSync(path.join(directory, `${script}.stderr.txt`), stderr);
  let data: any, error: string | undefined;
  try {
    const marker = "[JSON para relatório]";
    const at = stdout.lastIndexOf(marker);
    if (at < 0) throw new Error("Missing structured results");
    data = JSON.parse(stdout.slice(at + marker.length).trim());
    fs.writeFileSync(path.join(directory, `${script}.json`), JSON.stringify(data, null, 2));
  } catch (e) { error = String(e); }
  const summary = data?.summary ?? data;
  const failed = result.status !== 0 || !!result.error || !!error || (typeof summary?.passed === "number" && summary.passed !== summary.total);
  runs.push({ script, network: network.name, durationMs: Date.now() - start, exitCode: result.status, failed, error: error ?? result.error?.message, sourceSha256: hash(source), data });
  fs.writeFileSync(path.join(directory, "report.json"), JSON.stringify({ network: network.name, contractSha256: hash("contracts/CarbonCreditRegistry.sol"), runs }, null, 2));
  console.log(`${failed ? "FAIL" : "OK"} ${script}`);
}
console.log(`Results: ${directory}`);
if (runs.some(r => r.failed)) process.exitCode = 1;
