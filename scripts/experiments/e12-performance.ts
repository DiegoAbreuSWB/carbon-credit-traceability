import { CarbonCreditRegistry__factory } from "../../typechain-types";
/**
 * E12 + E13 + E14 — Desempenho de Rede
 *
 * E12: Latência de confirmação por operação (tempo tx enviada → bloco minerado).
 * E13: Throughput — quantas txs/s o nó local suporta em sequência.
 * E14: Comparação de latência Hardhat vs Besu (lê RPC_URL se --network besu).
 *
 * Uso: npx hardhat run scripts/experiments/e12-performance.ts --network localhost
 *   ou: npx hardhat run scripts/experiments/e12-performance.ts --network besu
 */

import { ethers } from "hardhat";

const LATENCY_SAMPLES = 10;
const THROUGHPUT_BATCH = 20;

interface LatencyMeasure { operation: string; samples: number[]; avgMs: number; minMs: number; maxMs: number }

async function measureLatency(label: string, fn: () => Promise<any>): Promise<number> {
  const start = Date.now();
  const tx = await fn();
  await tx.wait();
  return Date.now() - start;
}

async function main() {
  const [owner, validator, buyer] = await ethers.getSigners();
  const Factory = new CarbonCreditRegistry__factory((await ethers.getSigners())[0]);

  // Detecta rede
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? `chainId-${network.chainId}` : network.name;

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  E12 + E13 — Latência e Throughput");
  console.log(`  Rede: ${networkName} (chainId ${network.chainId})`);
  console.log(`  Amostras de latência: ${LATENCY_SAMPLES} | Batch de throughput: ${THROUGHPUT_BATCH}`);
  console.log("══════════════════════════════════════════════════════════\n");

  const latencyResults: LatencyMeasure[] = [];

  // ── E12: Latência por operação ──────────────────────────────
  const latencyOps = [
    {
      label: "issueCredit",
      setup: async () => {
        const c = await (await Factory.deploy()).waitForDeployment();
        return c;
      },
      fn: async (c: any, i: number) =>
        c.connect(owner).issueCredit(`Área ${i}`, `Loc ${i}`, `${i},0`, 100n),
    },
    {
      label: "validateCredit",
      setup: async () => {
        const c = await (await Factory.deploy()).waitForDeployment();
        // pré-emite créditos
        for (let i = 0; i < LATENCY_SAMPLES; i++) {
          await (await c.connect(owner).issueCredit(`A${i}`, "L", "0,0", 100n)).wait();
        }
        return c;
      },
      fn: async (c: any, i: number) => c.connect(validator).validateCredit(i),
    },
    {
      label: "transferCredit",
      setup: async () => {
        const c = await (await Factory.deploy()).waitForDeployment();
        for (let i = 0; i < LATENCY_SAMPLES; i++) {
          await (await c.connect(owner).issueCredit(`A${i}`, "L", "0,0", 100n)).wait();
          await (await c.connect(validator).validateCredit(i)).wait();
        }
        return c;
      },
      fn: async (c: any, i: number) => c.connect(owner).transferCredit(i, buyer.address),
    },
    {
      label: "retireCredit",
      setup: async () => {
        const c = await (await Factory.deploy()).waitForDeployment();
        for (let i = 0; i < LATENCY_SAMPLES; i++) {
          await (await c.connect(owner).issueCredit(`A${i}`, "L", "0,0", 100n)).wait();
          await (await c.connect(validator).validateCredit(i)).wait();
        }
        return c;
      },
      fn: async (c: any, i: number) => c.connect(owner).retireCredit(i),
    },
  ];

  for (const op of latencyOps) {
    process.stdout.write(`  Medindo latência: ${op.label}... `);
    const contract = await op.setup();
    const samples: number[] = [];
    for (let i = 0; i < LATENCY_SAMPLES; i++) {
      const ms = await measureLatency(op.label, () => op.fn(contract, i));
      samples.push(ms);
      process.stdout.write(`${ms}ms `);
    }
    console.log();
    const avgMs = Math.round(samples.reduce((a, b) => a + b) / samples.length);
    const minMs = Math.min(...samples);
    const maxMs = Math.max(...samples);
    latencyResults.push({ operation: op.label, samples, avgMs, minMs, maxMs });
  }

  // Tabela de latência
  console.log("\n  Operação          Mín(ms)  Média(ms)  Máx(ms)");
  console.log("  " + "─".repeat(50));
  for (const r of latencyResults) {
    console.log(
      `  ${r.operation.padEnd(18)}` +
      `${r.minMs.toString().padStart(8)} ` +
      `${r.avgMs.toString().padStart(9)} ` +
      `${r.maxMs.toString().padStart(8)}`
    );
  }

  // ── E13: Throughput ─────────────────────────────────────────
  console.log("\n  Medindo throughput (issueCredit em lote)...");
  const tContract = await (await Factory.deploy()).waitForDeployment();
  const throughputStart = Date.now();
  const txs: any[] = [];
  for (let i = 0; i < THROUGHPUT_BATCH; i++) {
    txs.push(await tContract.connect(owner).issueCredit(`T${i}`, "L", "0,0", 100n));
  }
  // aguarda todas confirmações
  const tReceipts = await Promise.all(txs.map((tx) => tx.wait()));
  const throughputMs = Date.now() - throughputStart;
  const confirmedCount = tReceipts.filter((r) => r?.status === 1).length;
  const tps = (confirmedCount / (throughputMs / 1000)).toFixed(2);

  console.log(`\n  E13 — Throughput:`);
  console.log(`    Transações enviadas: ${THROUGHPUT_BATCH}`);
  console.log(`    Confirmadas: ${confirmedCount}`);
  console.log(`    Tempo total: ${throughputMs}ms`);
  console.log(`    Throughput: ${tps} tx/s`);

  // E14 is documentary context, not an experiment or network latency comparison.
  console.log("E14: contexto documental; nenhuma outra rede foi medida nesta execucao.");

  return {
    experiment: "E12+E13",
    e14: { kind: "documentary-context", measured: false },
    network: { name: networkName, chainId: network.chainId.toString() },
    latency: latencyResults.map((r) => ({
      operation: r.operation,
      samples: r.samples,
      minMs: r.minMs,
      avgMs: r.avgMs,
      maxMs: r.maxMs,
    })),
    throughput: { batch: THROUGHPUT_BATCH, confirmed: confirmedCount, durationMs: throughputMs, tps: parseFloat(tps) },
  };
}

main()
  .then((data) => {
    console.log("\n  [JSON para relatório]");
    console.log(JSON.stringify(data, null, 2));
  })
  .catch((err) => { console.error(err); process.exit(1); });
