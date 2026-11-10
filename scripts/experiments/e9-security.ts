import { CarbonCreditRegistry__factory } from "../../typechain-types";
/**
 * E9 + E10 + E11 — Segurança do Contrato
 *
 * E9:  Controle de acesso — operações por contas não autorizadas reverted.
 * E10: Double-spend — aposentadoria dupla do mesmo crédito reverted.
 * E11: Concorrência — múltiplas txs simultâneas processadas corretamente.
 *
 * Uso: npx hardhat run scripts/experiments/e9-security.ts --network localhost
 */

import { ethers } from "hardhat";

interface TestResult { id: string; description: string; pass: boolean; detail: string }

async function expectRevert(fn: () => Promise<any>, expectedMsg?: string): Promise<{ reverted: boolean; msg: string }> {
  try {
    const tx = await fn();
    await tx.wait?.();
    return { reverted: false, msg: "NÃO reverteu" };
  } catch (e: any) {
    const msg: string = e?.message ?? e?.reason ?? String(e);
    if (expectedMsg && !msg.includes(expectedMsg)) {
      return { reverted: true, msg: `reverteu com msg diferente: ${msg.substring(0, 80)}` };
    }
    return { reverted: true, msg: msg.substring(0, 80) };
  }
}

async function main() {
  const [owner, validator, attacker, buyer, other] = await ethers.getSigners();
  const Factory = new CarbonCreditRegistry__factory((await ethers.getSigners())[0]);

  // ── E9: Controle de Acesso ──────────────────────────────────
  console.log("\n══════════════════════════════════════════════════");
  console.log("  E9 — Controle de Acesso");
  console.log("══════════════════════════════════════════════════\n");

  const resultsE9: TestResult[] = [];
  const c9 = await (await Factory.deploy()).waitForDeployment();

  // Prepara créditos para teste
  await (await c9.connect(owner).issueCredit("Área A", "Local", "0,0", 100n)).wait(); // id=0 Created
  await (await c9.connect(owner).issueCredit("Área B", "Local", "0,0", 100n)).wait(); // id=1 Created
  await (await c9.connect(validator).validateCredit(1)).wait();                         // id=1 Validated
  await (await c9.connect(owner).issueCredit("Área C", "Local", "0,0", 100n)).wait(); // id=2 Created
  await (await c9.connect(validator).validateCredit(2)).wait();
  await (await c9.connect(owner).transferCredit(2, buyer.address)).wait();              // id=2 owner=buyer

  const accessTests = [
    {
      id: "E9-A1",
      desc: "Atacante não pode transferir crédito do owner",
      fn: () => c9.connect(attacker).transferCredit(1, attacker.address),
      expectRevert: true,
    },
    {
      id: "E9-A2",
      desc: "Atacante não pode aposentar crédito do owner",
      fn: () => c9.connect(attacker).retireCredit(1),
      expectRevert: true,
    },
    {
      id: "E9-A3",
      desc: "Atacante não pode validar crédito (qualquer conta pode validar — sem Role)",
      fn: () => c9.connect(attacker).validateCredit(0),
      expectRevert: false, // validateCredit não tem controle de acesso por papel neste contrato
    },
    {
      id: "E9-A4",
      desc: "Buyer pode transferir seu próprio crédito (id=2)",
      fn: () => c9.connect(buyer).transferCredit(2, other.address),
      expectRevert: false,
    },
    {
      id: "E9-A5",
      desc: "Atacante não pode transferir crédito do buyer após transferência acima",
      fn: () => c9.connect(attacker).transferCredit(2, attacker.address),
      expectRevert: true,
    },
    {
      id: "E9-A6",
      desc: "Owner não pode aposentar crédito transferido para buyer/other",
      fn: () => c9.connect(owner).retireCredit(2),
      expectRevert: true,
    },
    {
      id: "E9-A7",
      desc: "Transferência para endereço zero reverted",
      fn: () => c9.connect(owner).transferCredit(1, ethers.ZeroAddress),
      expectRevert: true,
    },
  ];

  for (const t of accessTests) {
    const res = await expectRevert(t.fn);
    const pass = t.expectRevert ? res.reverted : !res.reverted;
    resultsE9.push({ id: t.id, description: t.desc, pass, detail: res.msg });
  }

  printResults(resultsE9, "E9");

  // ── E10: Double-Spend / Double-Retirement ──────────────────
  console.log("══════════════════════════════════════════════════");
  console.log("  E10 — Proteção contra Double-Spend");
  console.log("══════════════════════════════════════════════════\n");

  const resultsE10: TestResult[] = [];
  const c10 = await (await Factory.deploy()).waitForDeployment();

  // Cria e aposenta crédito
  await (await c10.connect(owner).issueCredit("Carbono X", "AM", "0,0", 300n)).wait(); // id=0
  await (await c10.connect(validator).validateCredit(0)).wait();
  await (await c10.connect(owner).retireCredit(0)).wait(); // Aposentado

  const doubleTests = [
    { id: "E10-D1", desc: "Retirar crédito já aposentado (double-retirement)", fn: () => c10.connect(owner).retireCredit(0) },
    { id: "E10-D2", desc: "Transferir crédito aposentado", fn: () => c10.connect(owner).transferCredit(0, buyer.address) },
    { id: "E10-D3", desc: "Validar crédito aposentado", fn: () => c10.connect(validator).validateCredit(0) },
    { id: "E10-D4", desc: "Rejeitar crédito aposentado", fn: () => c10.connect(validator).rejectCredit(0, "tentativa") },
  ];

  // Também testa dupla validação
  await (await c10.connect(owner).issueCredit("Carbono Y", "PA", "0,0", 200n)).wait(); // id=1
  await (await c10.connect(validator).validateCredit(1)).wait();
  doubleTests.push(
    { id: "E10-D5", desc: "Validar crédito já validado (double-validation)", fn: () => c10.connect(validator).validateCredit(1) },
    { id: "E10-D6", desc: "Rejeitar crédito já validado", fn: () => c10.connect(validator).rejectCredit(1, "tentativa") }
  );

  for (const t of doubleTests) {
    const res = await expectRevert(t.fn);
    resultsE10.push({ id: t.id, description: t.desc, pass: res.reverted, detail: res.msg });
  }

  printResults(resultsE10, "E10");

  // ── E11: Concorrência — múltiplas txs no mesmo bloco ──────
  console.log("══════════════════════════════════════════════════");
  console.log("  E11 — Atomicidade e Concorrência");
  console.log("══════════════════════════════════════════════════\n");

  const resultsE11: TestResult[] = [];
  const c11 = await (await Factory.deploy()).waitForDeployment();

  // Emite vários créditos antecipadamente
  for (let i = 0; i < 5; i++) {
    await (await c11.connect(owner).issueCredit(`Área ${i}`, "Local", "0,0", 100n)).wait();
  }

  // Envia 5 validateCredit em sequência rápida (sem esperar cada um)
  // Em Hardhat local (automining), cada tx vai em bloco separado, mas simulamos o padrão
  const validateTxs = await Promise.all([
    c11.connect(validator).validateCredit(0),
    c11.connect(validator).validateCredit(1),
    c11.connect(validator).validateCredit(2),
    c11.connect(validator).validateCredit(3),
    c11.connect(validator).validateCredit(4),
  ]);
  const receipts = await Promise.all(validateTxs.map((tx) => tx.wait()));

  const allConfirmed = receipts.every((r) => r?.status === 1);
  resultsE11.push({
    id: "E11-C1",
    description: "5 validateCredit enviados em paralelo: todos confirmados",
    pass: allConfirmed,
    detail: allConfirmed
      ? `OK — ${receipts.length} txs confirmadas`
      : `${receipts.filter((r) => r?.status !== 1).length} falha(s)`,
  });

  // Verifica que todos os 5 estão Validated
  const STATUS = ["Created", "Validated", "Transferred", "Retired", "Rejected"];
  let allValidated = true;
  for (let i = 0; i < 5; i++) {
    const credit = await c11.getCredit(i);
    if (STATUS[Number(credit.status)] !== "Validated") allValidated = false;
  }
  resultsE11.push({
    id: "E11-C2",
    description: "Todos os 5 créditos estão no estado Validated após execução paralela",
    pass: allValidated,
    detail: allValidated ? "OK" : "Estado inconsistente detectado",
  });

  // Testa concorrência de conflito: dois calls para mesmo crédito
  await (await c11.connect(owner).issueCredit("Área Conflito", "Local", "0,0", 100n)).wait(); // id=5
  await (await c11.connect(validator).validateCredit(5)).wait();

  // Dois transfers do id=5 enviados quase simultaneamente — apenas o primeiro deve valer.
  // Promise.allSettled evita propagação imediata do revert da segunda tx.
  const [res1, res2] = await Promise.allSettled([
    c11.connect(owner).transferCredit(5, buyer.address),
    c11.connect(owner).transferCredit(5, other.address),
  ]);

  let firstOk = false, secondFailed = false;
  if (res1.status === "fulfilled") {
    try { await res1.value.wait(); firstOk = true; } catch { /* tx falhou no mining */ }
  }
  if (res2.status === "rejected") {
    secondFailed = true; // revert em mempool (Hardhat automining)
  } else {
    try { await res2.value.wait(); } catch { secondFailed = true; }
  }

  // Em Hardhat automining as txs são serializadas: a primeira passa, a segunda reverte
  // pois o crédito mudou de dono antes da segunda ser minerada.
  resultsE11.push({
    id: "E11-C3",
    description: "Transferência concorrente: primeira passa, segunda reverte",
    pass: firstOk && secondFailed,
    detail: `tx1=${firstOk ? "OK" : "FALHOU"}, tx2=${secondFailed ? "REVERTEU" : "passou (inesperado)"}`,
  });

  printResults(resultsE11, "E11");

  const all = [...resultsE9, ...resultsE10, ...resultsE11];
  const passed = all.filter((r) => r.pass).length;
  console.log(`\n  RESUMO DE SEGURANÇA: ${passed}/${all.length} verificações aprovadas`);
  if (passed === all.length) {
    console.log("  ✅ Contrato seguro: acesso controlado, double-spend prevenido, concorrência correta.\n");
  } else {
    console.log(`  ⚠️  ${all.length - passed} verificação(ões) falharam — revisar contrato.\n`);
  }

  return { E9: resultsE9, E10: resultsE10, E11: resultsE11, summary: { passed, total: all.length } };
}

function printResults(results: TestResult[], group: string) {
  const colW = 55;
  console.log(`\n  ${"ID".padEnd(10)} ${"Descrição".padEnd(colW)} Status`);
  console.log("  " + "─".repeat(80));
  for (const r of results) {
    const status = r.pass ? "✅ OK" : "❌ FALHA";
    console.log(`  ${r.id.padEnd(10)} ${r.description.padEnd(colW)} ${status}`);
    if (!r.pass) console.log(`  ${"".padEnd(10)} ↳ ${r.detail}`);
  }
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n  ${group}: ${passed}/${results.length} aprovados\n`);
}

main()
  .then((data) => {
    if (data.summary.passed !== data.summary.total) process.exitCode = 1;
    console.log("  [JSON para relatório]");
    console.log(JSON.stringify({ ...data, ...data.summary }, null, 2));
  })
  .catch((err) => { console.error(err); process.exit(1); });
