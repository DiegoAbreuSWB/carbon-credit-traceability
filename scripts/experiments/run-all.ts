/**
 * run-all.ts — Orquestrador de experimentos
 *
 * Executa todos os scripts de experimento em sequência e grava o relatório
 * JSON em results/experiment-results.json para posterior inserção em
 * docs/resultados-experimentos.md.
 *
 * Uso: npx hardhat run scripts/experiments/run-all.ts --network localhost
 *
 * Nota: cada sub-experimento faz deploy de um contrato isolado para evitar
 * interferência de estado. O nó deve estar rodando antes de executar.
 */

import { ethers, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Importa cada experimento como módulo (run-all chama main() diretamente)
// Hardhat run não suporta import de outros scripts com run(),
// por isso vamos executar via child_process e capturar saída JSON.

import { execSync } from "child_process";

interface ExperimentRun {
  name: string;
  script: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode: number;
  passed?: number;
  total?: number;
  error?: string;
}

const EXPERIMENTS = [
  { name: "E1+E2 — Máquina de Estados", script: "e1-state-machine" },
  { name: "E3+E5 — Custo de Gás", script: "e3-gas-measurement" },
  { name: "E4 — Escalabilidade", script: "e4-scalability" },
  { name: "E6+E7+E8 — Integridade do Audit Log", script: "e6-audit-integrity" },
  { name: "E9+E10+E11 — Segurança", script: "e9-security" },
  { name: "E12+E13+E14 — Desempenho", script: "e12-performance" },
  { name: "E15+E16 — Consistência Interface", script: "e15-interface" },
];

const RESULTS_DIR = path.join(__dirname, "../../results");
const OUTPUT_FILE = path.join(RESULTS_DIR, "experiment-results.json");

function getNetwork(): string {
  // Tenta detectar --network no argv
  const argv = process.argv;
  const idx = argv.indexOf("--network");
  return idx >= 0 ? argv[idx + 1] : "localhost";
}

async function main() {
  const network = getNetwork();

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║         CarbonTrace — Suite de Experimentos               ║");
  console.log("║         Iniciação Científica 2024/2025                    ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`  Rede: ${network}`);
  console.log(`  Data: ${new Date().toISOString()}`);
  console.log(`  Experimentos: ${EXPERIMENTS.length}\n`);
  console.log("  " + "═".repeat(58) + "\n");

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const runs: ExperimentRun[] = [];
  let totalPassed = 0;
  let totalTests = 0;
  let failedExperiments = 0;

  for (const exp of EXPERIMENTS) {
    const scriptPath = `scripts/experiments/${exp.script}.ts`;
    console.log(`\n  ▶ ${exp.name}`);
    console.log("  " + "─".repeat(58));

    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    let exitCode = 0;
    let output = "";
    let passed: number | undefined;
    let total: number | undefined;
    let error: string | undefined;

    try {
      output = execSync(
        `npx hardhat run ${scriptPath} --network ${network}`,
        { encoding: "utf8", stdio: ["inherit", "pipe", "pipe"], timeout: 300_000 }
      );
      process.stdout.write(output);

      // Extrai JSON do final da saída (convenção de todos os scripts)
      const jsonMatch = output.match(/\[JSON para relatório\]\s*\n([\s\S]+?)(?:\n\s*$|$)/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim());
          passed = parsed.passed;
          total = parsed.total;
          if (passed !== undefined) { totalPassed += passed; totalTests += total!; }
        } catch { /* JSON parse falhou, não crítico */ }
      }
    } catch (e: any) {
      exitCode = e.status ?? 1;
      error = (e.stderr ?? e.message ?? "").substring(0, 200);
      process.stdout.write(e.stdout ?? "");
      process.stderr.write(e.stderr ?? "");
      failedExperiments++;
    }

    const durationMs = Date.now() - t0;
    const finishedAt = new Date().toISOString();
    const status = exitCode === 0 ? "✅ OK" : "❌ FALHA";
    console.log(`\n  ${status} — ${exp.name} (${(durationMs / 1000).toFixed(1)}s)`);

    runs.push({ name: exp.name, script: exp.script, startedAt, finishedAt, durationMs, exitCode, passed, total, error });
  }

  // Relatório final
  const totalDuration = runs.reduce((s, r) => s + r.durationMs, 0);
  const report = {
    generatedAt: new Date().toISOString(),
    network,
    totalDurationMs: totalDuration,
    experiments: runs,
    summary: {
      experimentsRun: EXPERIMENTS.length,
      experimentsPassed: EXPERIMENTS.length - failedExperiments,
      experimentsFailed: failedExperiments,
      totalTests,
      totalPassed,
      totalFailed: totalTests - totalPassed,
    },
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), "utf8");

  console.log("\n\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  RESUMO FINAL                                             ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`  Experimentos: ${report.summary.experimentsPassed}/${report.summary.experimentsRun} aprovados`);
  if (totalTests > 0) {
    console.log(`  Verificações: ${totalPassed}/${totalTests} aprovadas`);
  }
  console.log(`  Tempo total: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`\n  Relatório JSON: ${OUTPUT_FILE}\n`);

  for (const r of runs) {
    const icon = r.exitCode === 0 ? "✅" : "❌";
    const checks = r.total !== undefined ? ` (${r.passed}/${r.total})` : "";
    console.log(`  ${icon} ${r.name}${checks} — ${(r.durationMs / 1000).toFixed(1)}s`);
  }

  if (failedExperiments > 0) {
    console.log(`\n  ⚠️  ${failedExperiments} experimento(s) falharam. Verifique o nó Hardhat com: npm run node\n`);
    process.exit(1);
  } else {
    console.log("\n  ✅ Todos os experimentos concluídos com sucesso.\n");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
