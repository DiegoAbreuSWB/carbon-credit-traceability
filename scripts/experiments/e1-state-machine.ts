/**
 * E1 + E2 — Verificação da máquina de estados
 *
 * E1: testa todas as transições VÁLIDAS e verifica o status resultante.
 * E2: testa todas as transições INVÁLIDAS e verifica que causam revert.
 *
 * Uso: npx hardhat run scripts/experiments/e1-state-machine.ts --network localhost
 */

import { ethers } from "hardhat";

const STATUS = ["Created", "Validated", "Transferred", "Retired", "Rejected"];

interface TestResult {
  id: string;
  description: string;
  expected: string;
  obtained: string;
  pass: boolean;
  note?: string;
}

async function deployFresh() {
  const Factory = await ethers.getContractFactory("CarbonCreditRegistry");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  return contract;
}

async function getStatus(contract: any, id: number): Promise<string> {
  const c = await contract.getCredit(id);
  return STATUS[Number(c.status)] ?? "Unknown";
}

async function main() {
  const [owner, validator, buyer, other] = await ethers.getSigners();
  const results: TestResult[] = [];

  console.log("\n══════════════════════════════════════════════════");
  console.log("  E1 — Transições de Estado VÁLIDAS");
  console.log("══════════════════════════════════════════════════\n");

  // ── E1: Transições válidas ──────────────────────────────
  {
    const contract = await deployFresh();

    // T1: issueCredit → Created
    await (await contract.connect(owner).issueCredit("Área A", "Manaus, AM", "-3.0,-60.0", 1000n)).wait();
    const s1 = await getStatus(contract, 0);
    results.push({ id: "E1-T1", description: "issueCredit → Created", expected: "Created", obtained: s1, pass: s1 === "Created" });

    // T2: validateCredit (Created → Validated)
    await (await contract.connect(validator).validateCredit(0)).wait();
    const s2 = await getStatus(contract, 0);
    results.push({ id: "E1-T2", description: "validateCredit → Validated", expected: "Validated", obtained: s2, pass: s2 === "Validated" });

    // T3: transferCredit (Validated → Transferred)
    await (await contract.connect(owner).transferCredit(0, buyer.address)).wait();
    const s3 = await getStatus(contract, 0);
    results.push({ id: "E1-T3", description: "transferCredit → Transferred", expected: "Transferred", obtained: s3, pass: s3 === "Transferred" });

    // T4: retransferCredit (Transferred → Transferred)
    await (await contract.connect(buyer).transferCredit(0, other.address)).wait();
    const s4 = await getStatus(contract, 0);
    results.push({ id: "E1-T4", description: "re-transferCredit → Transferred", expected: "Transferred", obtained: s4, pass: s4 === "Transferred" });

    // T5: retireCredit (Transferred → Retired)
    await (await contract.connect(other).retireCredit(0)).wait();
    const s5 = await getStatus(contract, 0);
    results.push({ id: "E1-T5", description: "retireCredit (Transferred) → Retired", expected: "Retired", obtained: s5, pass: s5 === "Retired" });

    // T6: rejectCredit (Created → Rejected)
    await (await contract.connect(owner).issueCredit("Área B", "Belém, PA", "-1.0,-48.0", 500n)).wait();
    await (await contract.connect(validator).rejectCredit(1, "Dados inválidos")).wait();
    const s6 = await getStatus(contract, 1);
    results.push({ id: "E1-T6", description: "rejectCredit → Rejected", expected: "Rejected", obtained: s6, pass: s6 === "Rejected" });

    // T7: retireCredit (Validated → Retired)
    await (await contract.connect(owner).issueCredit("Área C", "Santarém, PA", "-2.5,-54.5", 750n)).wait();
    await (await contract.connect(validator).validateCredit(2)).wait();
    await (await contract.connect(owner).retireCredit(2)).wait();
    const s7 = await getStatus(contract, 2);
    results.push({ id: "E1-T7", description: "retireCredit (Validated) → Retired", expected: "Retired", obtained: s7, pass: s7 === "Retired" });
  }

  printResults(results, "E1");

  console.log("\n══════════════════════════════════════════════════");
  console.log("  E2 — Transições de Estado INVÁLIDAS (reverts)");
  console.log("══════════════════════════════════════════════════\n");

  // ── E2: Transições inválidas ────────────────────────────
  const resultsE2: TestResult[] = [];
  const contract2 = await deployFresh();

  // Cria créditos em estados distintos para teste
  await (await contract2.connect(owner).issueCredit("Área X", "Local", "0,0", 100n)).wait(); // id=0 → Created
  await (await contract2.connect(owner).issueCredit("Área Y", "Local", "0,0", 100n)).wait(); // id=1 → Created
  await (await contract2.connect(validator).validateCredit(1)).wait();                         // id=1 → Validated
  await (await contract2.connect(owner).issueCredit("Área Z", "Local", "0,0", 100n)).wait(); // id=2 → Created
  await (await contract2.connect(validator).validateCredit(2)).wait();
  await (await contract2.connect(owner).transferCredit(2, buyer.address)).wait();              // id=2 → Transferred
  await (await contract2.connect(owner).issueCredit("Área W", "Local", "0,0", 100n)).wait(); // id=3 → Created
  await (await contract2.connect(validator).validateCredit(3)).wait();
  await (await contract2.connect(owner).retireCredit(3)).wait();                               // id=3 → Retired
  await (await contract2.connect(owner).issueCredit("Área V", "Local", "0,0", 100n)).wait(); // id=4 → Created
  await (await contract2.connect(validator).rejectCredit(4, "Inválido")).wait();               // id=4 → Rejected

  const invalid: { id: string; desc: string; fn: () => Promise<any> }[] = [
    { id: "E2-I01", desc: "Created → retire (sem validação)", fn: () => contract2.connect(owner).retireCredit(0) },
    { id: "E2-I02", desc: "Created → transfer (sem validação)", fn: () => contract2.connect(owner).transferCredit(0, buyer.address) },
    { id: "E2-I03", desc: "Validated → validate (já validado)", fn: () => contract2.connect(validator).validateCredit(1) },
    { id: "E2-I04", desc: "Validated → reject (já validado)", fn: () => contract2.connect(validator).rejectCredit(1, "x") },
    { id: "E2-I05", desc: "Transferred → validate", fn: () => contract2.connect(validator).validateCredit(2) },
    { id: "E2-I06", desc: "Transferred → reject", fn: () => contract2.connect(validator).rejectCredit(2, "x") },
    { id: "E2-I07", desc: "Retired → transfer", fn: () => contract2.connect(owner).transferCredit(3, buyer.address) },
    { id: "E2-I08", desc: "Retired → retire (double-retirement)", fn: () => contract2.connect(owner).retireCredit(3) },
    { id: "E2-I09", desc: "Retired → validate", fn: () => contract2.connect(validator).validateCredit(3) },
    { id: "E2-I10", desc: "Rejected → validate", fn: () => contract2.connect(validator).validateCredit(4) },
    { id: "E2-I11", desc: "Rejected → transfer", fn: () => contract2.connect(owner).transferCredit(4, buyer.address) },
    { id: "E2-I12", desc: "transfer por não-proprietário (other)", fn: () => contract2.connect(other).transferCredit(1, buyer.address) },
    { id: "E2-I13", desc: "retire por não-proprietário (other)", fn: () => contract2.connect(other).retireCredit(1) },
    { id: "E2-I14", desc: "issueCredit com nome vazio", fn: () => contract2.connect(owner).issueCredit("", "Local", "0,0", 100n) },
    { id: "E2-I15", desc: "issueCredit com CO2=0", fn: () => contract2.connect(owner).issueCredit("Nome", "Local", "0,0", 0n) },
    { id: "E2-I16", desc: "getCredit de ID inexistente", fn: () => contract2.getCredit(999) },
  ];

  for (const t of invalid) {
    let reverted = false;
    let errMsg = "";
    try {
      await (await t.fn()).wait?.() ?? await t.fn();
    } catch (e: any) {
      reverted = true;
      errMsg = e?.message?.split("'")[1] ?? e?.reason ?? "revertido";
    }
    resultsE2.push({
      id: t.id,
      description: t.desc,
      expected: "REVERT",
      obtained: reverted ? "REVERT" : "SUCESSO (FALHA DO TESTE)",
      pass: reverted,
      note: reverted ? errMsg.substring(0, 60) : "NÃO reverteu — comportamento inesperado",
    });
  }

  printResults(resultsE2, "E2");

  // Resumo final
  const allResults = [...results, ...resultsE2];
  const passed = allResults.filter((r) => r.pass).length;
  const total = allResults.length;
  console.log(`\n  RESUMO: ${passed}/${total} testes aprovados`);
  if (passed === total) {
    console.log("  ✅ Máquina de estados CORRETA — todas as transições verificadas.\n");
  } else {
    console.log(`  ❌ ${total - passed} falha(s) detectada(s).\n`);
  }

  return { E1: results, E2: resultsE2, summary: { passed, total } };
}

function printResults(results: TestResult[], group: string) {
  const colW = 48;
  console.log(`  ${"ID".padEnd(10)} ${"Descrição".padEnd(colW)} ${"Esperado".padEnd(10)} ${"Obtido".padEnd(12)} Status`);
  console.log("  " + "─".repeat(105));
  for (const r of results) {
    const status = r.pass ? "✅ OK" : "❌ FALHA";
    const note = r.note ? `\n  ${"".padEnd(10)} ↳ ${r.note}` : "";
    console.log(`  ${r.id.padEnd(10)} ${r.description.padEnd(colW)} ${r.expected.padEnd(10)} ${r.obtained.padEnd(12)} ${status}${note}`);
  }
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n  ${group}: ${passed}/${results.length} aprovados\n`);
}

main()
  .then((data) => {
    process.exitCode = data.summary.passed === data.summary.total ? 0 : 1;
  })
  .catch((err) => { console.error(err); process.exit(1); });
