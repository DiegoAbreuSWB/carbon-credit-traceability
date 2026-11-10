import { CarbonCreditRegistry__factory } from "../../typechain-types";
/**
 * E4 — Escalabilidade: Gas em Função do Volume de Créditos
 *
 * Verifica se o custo de operações cresce com o número de créditos no contrato.
 * Hipótese: operações em IDs específicos têm custo constante (O(1)) independente do volume.
 *
 * Uso: npx hardhat run scripts/experiments/e4-scalability.ts --network localhost
 */

import { ethers } from "hardhat";

const VOLUMES = [1, 10, 50, 100, 200]; // número de créditos no contrato antes da medição

async function collectGas(txPromise: Promise<any>): Promise<bigint> {
  const tx = await txPromise;
  const receipt = await tx.wait();
  return receipt.gasUsed as bigint;
}

interface VolumeResult {
  volume: number;
  issueGas: bigint;
  validateGas: bigint;
  transferGas: bigint;
  retireGas: bigint;
  getTotalCreditsGas?: bigint;
}

async function main() {
  const [owner, validator, buyer] = await ethers.getSigners();
  const Factory = new CarbonCreditRegistry__factory((await ethers.getSigners())[0]);

  console.log("\n══════════════════════════════════════════════════");
  console.log("  E4 — Escalabilidade: Gas vs Volume de Créditos");
  console.log(`  Volumes testados: ${VOLUMES.join(", ")} créditos`);
  console.log("══════════════════════════════════════════════════\n");

  const results: VolumeResult[] = [];

  for (const volume of VOLUMES) {
    process.stdout.write(`  Preparando contrato com ${volume} crédito(s)... `);
    const contract = await (await Factory.deploy()).waitForDeployment();

    // Popula até (volume - 1) créditos como estado de fundo
    // usa lotes menores para não congestionar
    for (let i = 0; i < volume - 1; i++) {
      await (await contract.connect(owner).issueCredit(`Pad ${i}`, "Loc", "0,0", 100n)).wait();
      if (i % 50 === 49) process.stdout.write(".");
    }

    // Mede a operação alvo no último crédito
    const targetId = volume - 1;

    const issueGas = await collectGas(contract.connect(owner).issueCredit(`Target ${targetId}`, "Alvo", "0,0", 500n));
    const validateGas = await collectGas(contract.connect(validator).validateCredit(targetId));
    const transferGas = await collectGas(contract.connect(owner).transferCredit(targetId, buyer.address));
    const retireGas = await collectGas(contract.connect(buyer).retireCredit(targetId));

    results.push({ volume, issueGas, validateGas, transferGas, retireGas });
    console.log(` pronto (issue=${issueGas}, validate=${validateGas}, transfer=${transferGas}, retire=${retireGas})`);
  }

  // Tabela de resultados
  console.log("\n  Volume    issueCredit  validateCredit  transferCredit  retireCredit");
  console.log("  " + "─".repeat(75));
  for (const r of results) {
    console.log(
      `  ${r.volume.toString().padEnd(9)} ` +
      `${r.issueGas.toString().padStart(12)}  ` +
      `${r.validateGas.toString().padStart(14)}  ` +
      `${r.transferGas.toString().padStart(14)}  ` +
      `${r.retireGas.toString().padStart(13)}`
    );
  }

  // Análise de crescimento
  console.log("\n  Análise de crescimento (comparação volume=1 vs maior volume):\n");
  if (results.length >= 2) {
    const base = results[0];
    const last = results[results.length - 1];
    const ops: (keyof Omit<VolumeResult, "volume" | "getTotalCreditsGas">)[] = ["issueGas", "validateGas", "transferGas", "retireGas"];
    for (const op of ops) {
      const ratio = Number(last[op]) / Number(base[op]);
      const trend = ratio < 1.02 ? "variacao inferior a 2%" : ratio < 1.1 ? "Quase constante" : "Cresce com volume";
      const delta = Number(last[op]) - Number(base[op]);
      console.log(`  ${op.padEnd(16)}: V=${last.volume}/${base.volume} → ratio=${ratio.toFixed(4)}, delta=${delta} gas — ${trend}`);
    }
  }

  console.log("Resultados restritos aos cenarios medidos; consultas de historico exigem avaliacao propria.");

  return {
    experiment: "E4",
    volumes: VOLUMES,
    results: results.map((r) => ({
      volume: r.volume,
      issueGas: r.issueGas.toString(),
      validateGas: r.validateGas.toString(),
      transferGas: r.transferGas.toString(),
      retireGas: r.retireGas.toString(),
    })),
  };
}

main()
  .then((data) => {
    console.log("  [JSON para relatório]");
    console.log(JSON.stringify(data, null, 2));
  })
  .catch((err) => { console.error(err); process.exit(1); });
