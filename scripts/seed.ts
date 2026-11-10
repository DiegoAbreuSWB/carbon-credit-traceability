import { CarbonCreditRegistry__factory } from "../typechain-types";
/**
 * seed.ts — Popula o contrato com dados simulados de créditos de carbono.
 * Uso: CONTRACT_ADDRESS=0x... npx hardhat run scripts/seed.ts --network localhost
 *   ou: npm run seed:local (após definir CONTRACT_ADDRESS no ambiente)
 */
import { ethers } from "hardhat";

const MOCK_CREDITS = [
  { areaName: "Reserva Extrativista Rio Jutaí (Simulada)", location: "Jutaí, AM", geo: "-2.7450,-66.7825", co2: 2500n },
  { areaName: "Parque Estadual Serra do Araçá (Simulado)", location: "Barcelos, AM", geo: "-0.9011,-63.2847", co2: 1800n },
  { areaName: "Floresta Nacional do Jamanxim (Simulada)", location: "Novo Progresso, PA", geo: "-6.5012,-55.9841", co2: 3200n },
  { areaName: "APA Caverna do Maroaga (Simulada)", location: "Presidente Figueiredo, AM", geo: "-1.9732,-60.0217", co2: 900n },
  { areaName: "RDS Uatumã (Simulada)", location: "São Sebastião do Uatumã, AM", geo: "-2.6823,-58.0011", co2: 1500n },
  { areaName: "FLONA Tapajós Norte (Simulada)", location: "Belterra, PA", geo: "-3.6712,-54.9500", co2: 2900n },
  { areaName: "TI Yanomami Zona Sul (Simulada)", location: "Boa Vista, RR", geo: "2.8200,-62.4500", co2: 4100n },
  { areaName: "Resex Baixo Rio Branco-Jauaperi (Simulada)", location: "Caracaraí, RR", geo: "0.9123,-61.3841", co2: 2100n },
];

async function main() {
  const [deployer, validator, buyer] = await ethers.getSigners();
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) throw new Error("Defina CONTRACT_ADDRESS no ambiente.");

  console.log(`\n🌱 Populando contrato em ${contractAddress}...`);
  const registry = CarbonCreditRegistry__factory.connect(contractAddress, deployer);

  for (let i = 0; i < MOCK_CREDITS.length; i++) {
    const c = MOCK_CREDITS[i];
    const tx = await registry.connect(deployer).issueCredit(c.areaName, c.location, c.geo, c.co2);
    await tx.wait();
    console.log(`  [${i}] ✅ Emitido:    ${c.areaName}`);

    // Valida índices pares (exceto 6 - será rejeitado)
    if (i % 2 === 0 && i !== 6) {
      await (await registry.connect(validator).validateCredit(i)).wait();
      console.log(`  [${i}] ✔  Validado`);
    }

    // Rejeita índice 6
    if (i === 6) {
      await (await registry.connect(validator).rejectCredit(i, "Área não atende critérios mínimos")).wait();
      console.log(`  [${i}] ✗  Rejeitado`);
    }

    // Transfere índice 0 para buyer
    if (i === 0) {
      await (await registry.connect(deployer).transferCredit(i, buyer.address)).wait();
      console.log(`  [${i}] →  Transferido para ${buyer.address.slice(0, 10)}...`);
    }

    // Aposenta índice 2 (já validado)
    if (i === 2) {
      await (await registry.connect(deployer).retireCredit(i)).wait();
      console.log(`  [${i}] ⊘  Aposentado`);
    }
  }

  const total = await registry.getTotalCredits();
  console.log(`\n✅ Seed concluído. Total de créditos no contrato: ${total}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
