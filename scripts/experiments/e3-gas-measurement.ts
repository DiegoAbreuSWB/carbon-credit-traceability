import { CarbonCreditRegistry__factory } from "../../typechain-types";
/**
 * E3 + E5 — Custo de Gás por Operação e Eficiência Relativa
 *
 * E3: mede o gas consumido por cada tipo de operação (média de N amostras).
 * E5: calcula custo em USD para comparação com sistemas tradicionais.
 *
 * Uso: npx hardhat run scripts/experiments/e3-gas-measurement.ts --network localhost
 */

import { ethers } from "hardhat";

const N = 10; // amostras por operação
const ETH_PRICE_USD = 3_000; // ETH/USD (referência 2024)
const GAS_PRICE_GWEI = 1; // cenario economico ilustrativo; nao e preco medido

interface GasResult {
  operation: string;
  samples: bigint[];
  min: bigint;
  max: bigint;
  avg: bigint;
  stdDev: number;
  costETH: string;
  costUSD: string;
}

async function collectGas(txPromise: Promise<any>): Promise<bigint> {
  const tx = await txPromise;
  const receipt = await tx.wait();
  return receipt.gasUsed as bigint;
}

async function stats(samples: bigint[]): Promise<{ min: bigint; max: bigint; avg: bigint; stdDev: number }> {
  const min = samples.reduce((a, b) => (a < b ? a : b));
  const max = samples.reduce((a, b) => (a > b ? a : b));
  const avg = samples.reduce((a, b) => a + b) / BigInt(samples.length);
  const variance = samples.reduce((acc, v) => acc + Math.pow(Number(v) - Number(avg), 2), 0) / samples.length;
  return { min, max, avg, stdDev: Math.sqrt(variance) };
}

function gasToUSD(gasUsed: bigint): { eth: string; usd: string } {
  const gasPriceWei = BigInt(GAS_PRICE_GWEI) * BigInt(1e9);
  const costWei = gasUsed * gasPriceWei;
  const costEth = Number(costWei) / 1e18;
  const costUsd = costEth * ETH_PRICE_USD;
  return {
    eth: costEth.toFixed(8),
    usd: costUsd.toFixed(4),
  };
}

async function main() {
  const [owner, validator, buyer] = await ethers.getSigners();
  const Factory = new CarbonCreditRegistry__factory((await ethers.getSigners())[0]);

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  E3 — Medição de Custo de Gás por Operação");
  console.log(`  Amostras por operação: ${N} | ETH/USD referência: $${ETH_PRICE_USD.toLocaleString()}`);
  console.log(`  Gas price: ${GAS_PRICE_GWEI} gwei`);
  console.log("══════════════════════════════════════════════════════════\n");

  const results: GasResult[] = [];

  // ── Deploy ─────────────────────────────────────────────────
  {
    const deployGas: bigint[] = [];
    for (let i = 0; i < Math.min(N, 3); i++) {
      const contract = await Factory.deploy();
      const receipt = await contract.deploymentTransaction()!.wait();
      deployGas.push(receipt!.gasUsed);
    }
    const s = await stats(deployGas);
    const cost = gasToUSD(s.avg);
    results.push({ operation: "deploy()", samples: deployGas, ...s, costETH: cost.eth, costUSD: cost.usd });
  }

  // ── issueCredit ────────────────────────────────────────────
  {
    const gas: bigint[] = [];
    for (let i = 0; i < N; i++) {
      const c = await (await Factory.deploy()).waitForDeployment();
      gas.push(await collectGas(c.connect(owner).issueCredit(`Área ${i}`, `Local ${i}`, `${i}.0,${-i}.0`, BigInt(100 + i * 10))));
    }
    const s = await stats(gas);
    const cost = gasToUSD(s.avg);
    results.push({ operation: "issueCredit()", samples: gas, ...s, costETH: cost.eth, costUSD: cost.usd });
  }

  // ── validateCredit ─────────────────────────────────────────
  {
    const gas: bigint[] = [];
    const c = await (await Factory.deploy()).waitForDeployment();
    for (let i = 0; i < N; i++) {
      await (await c.connect(owner).issueCredit(`Área ${i}`, "Local", "0,0", 100n)).wait();
      gas.push(await collectGas(c.connect(validator).validateCredit(i)));
    }
    const s = await stats(gas);
    const cost = gasToUSD(s.avg);
    results.push({ operation: "validateCredit()", samples: gas, ...s, costETH: cost.eth, costUSD: cost.usd });
  }

  // ── rejectCredit ───────────────────────────────────────────
  {
    const gas: bigint[] = [];
    const c = await (await Factory.deploy()).waitForDeployment();
    for (let i = 0; i < N; i++) {
      await (await c.connect(owner).issueCredit(`Área ${i}`, "Local", "0,0", 100n)).wait();
      gas.push(await collectGas(c.connect(validator).rejectCredit(i, "Razão de rejeição de teste para medição")));
    }
    const s = await stats(gas);
    const cost = gasToUSD(s.avg);
    results.push({ operation: "rejectCredit()", samples: gas, ...s, costETH: cost.eth, costUSD: cost.usd });
  }

  // ── transferCredit ─────────────────────────────────────────
  {
    const gas: bigint[] = [];
    const c = await (await Factory.deploy()).waitForDeployment();
    for (let i = 0; i < N; i++) {
      await (await c.connect(owner).issueCredit(`Área ${i}`, "Local", "0,0", 100n)).wait();
      await (await c.connect(validator).validateCredit(i)).wait();
      gas.push(await collectGas(c.connect(owner).transferCredit(i, buyer.address)));
    }
    const s = await stats(gas);
    const cost = gasToUSD(s.avg);
    results.push({ operation: "transferCredit()", samples: gas, ...s, costETH: cost.eth, costUSD: cost.usd });
  }

  // ── retireCredit ───────────────────────────────────────────
  {
    const gas: bigint[] = [];
    const c = await (await Factory.deploy()).waitForDeployment();
    for (let i = 0; i < N; i++) {
      await (await c.connect(owner).issueCredit(`Área ${i}`, "Local", "0,0", 100n)).wait();
      await (await c.connect(validator).validateCredit(i)).wait();
      gas.push(await collectGas(c.connect(owner).retireCredit(i)));
    }
    const s = await stats(gas);
    const cost = gasToUSD(s.avg);
    results.push({ operation: "retireCredit()", samples: gas, ...s, costETH: cost.eth, costUSD: cost.usd });
  }

  // ── Impressão dos resultados ────────────────────────────────
  console.log("  Operação              Mín (gas)    Média (gas)  Máx (gas)  Desvio     Custo ETH    Custo USD");
  console.log("  " + "─".repeat(110));
  for (const r of results) {
    console.log(
      `  ${r.operation.padEnd(22)}` +
      `${r.min.toString().padStart(12)} ` +
      `${r.avg.toString().padStart(12)} ` +
      `${r.max.toString().padStart(10)} ` +
      `${r.stdDev.toFixed(0).padStart(10)} ` +
      `${r.costETH.padStart(12)} ` +
      `$${r.costUSD.padStart(10)}`
    );
  }

  // ── E5: análise de eficiência e comparação ─────────────────
  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  E5 — Eficiência Relativa ao Gas de Referência");
  console.log("══════════════════════════════════════════════════════════\n");

  const REF_GAS = 21_000n; // transferência ETH simples (referência mínima EVM)
  console.log(`  Referência: transferência ETH simples = ${REF_GAS} gas\n`);
  console.log("  Operação              Gas Médio   Ratio vs Referência  Classificação");
  console.log("  " + "─".repeat(80));
  for (const r of results) {
    const ratio = Number(r.avg) / Number(REF_GAS);
    const cls = ratio < 5 ? "Muito eficiente" : ratio < 10 ? "Eficiente" : ratio < 20 ? "Moderado" : "Alto custo";
    console.log(
      `  ${r.operation.padEnd(22)}` +
      `${r.avg.toString().padStart(10)}` +
      `  ${ratio.toFixed(1).padStart(8)}x               ${cls}`
    );
  }

  // Custo de ciclo completo
  const cycleOps = ["issueCredit()", "validateCredit()", "transferCredit()", "retireCredit()"];
  const cycleGas = results
    .filter((r) => cycleOps.includes(r.operation))
    .reduce((acc, r) => acc + r.avg, 0n);
  const cycleCost = gasToUSD(cycleGas);
  console.log(`\n  Ciclo completo (emissão→validação→transferência→aposentadoria):`);
  console.log(`    Gas total: ${cycleGas.toLocaleString()} | ETH: ${cycleCost.eth} | USD: $${cycleCost.usd}\n`);

  // Resultado estruturado do experimento
  return {
    experiment: "E3+E5",
    gasPrice_gwei: GAS_PRICE_GWEI,
    ethPriceUSD: ETH_PRICE_USD,
    samples: N,
    results: results.map((r) => ({
      operation: r.operation,
      samples: r.samples.map(String),
      min: r.min.toString(),
      avg: r.avg.toString(),
      max: r.max.toString(),
      stdDev: r.stdDev.toFixed(0),
      costUSD: r.costUSD,
    })),
    cycleTotal: { gas: cycleGas.toString(), usd: cycleCost.usd },
    referenceGas: REF_GAS.toString(),
  };
}

main()
  .then((data) => {
    console.log("\n  [JSON para relatório]");
    console.log(JSON.stringify(data, null, 2));
  })
  .catch((err) => { console.error(err); process.exit(1); });
