/**
 * E6 + E7 + E8 — Integridade do Log de Auditoria
 *
 * E6: completude — todos os eventos de cada operação são emitidos.
 * E7: reprodutibilidade — recriar o estado a partir dos eventos gera resultado idêntico.
 * E8: imutabilidade — eventos históricos não mudam após novas operações.
 *
 * Uso: npx hardhat run scripts/experiments/e6-audit-integrity.ts --network localhost
 */

import { ethers } from "hardhat";

type EventLog = { event: string; args: Record<string, string>; blockNumber: number; txHash: string };

async function getEvents(contract: any, fromBlock: number = 0): Promise<EventLog[]> {
  const address = await contract.getAddress();
  const provider = contract.runner?.provider ?? ethers.provider;
  const logs = await provider.getLogs({ address, fromBlock, toBlock: "latest" });

  const iface = contract.interface;
  return logs.map((log: any) => {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      const args: Record<string, string> = {};
      parsed?.args.forEach((v: any, i: number) => {
        const name = parsed.fragment.inputs[i]?.name ?? `arg${i}`;
        args[name] = v.toString();
      });
      return { event: parsed?.name ?? "Unknown", args, blockNumber: log.blockNumber, txHash: log.transactionHash };
    } catch {
      return { event: "Unknown", args: {}, blockNumber: log.blockNumber, txHash: log.transactionHash };
    }
  });
}

interface TestResult { id: string; description: string; pass: boolean; detail: string }

async function main() {
  const [owner, validator, buyer] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("CarbonCreditRegistry");
  const results: TestResult[] = [];

  // ────────────────────────────────────────────────────────────
  // Preparação: ciclo completo de operações em contrato limpo
  // ────────────────────────────────────────────────────────────
  const contract = await (await Factory.deploy()).waitForDeployment();
  const deployBlock = await ethers.provider.getBlockNumber();

  await (await contract.connect(owner).issueCredit("Área Alfa", "Pará, BR", "-5.0,-52.0", 1000n)).wait();      // id=0
  await (await contract.connect(validator).validateCredit(0)).wait();
  await (await contract.connect(owner).transferCredit(0, buyer.address)).wait();
  await (await contract.connect(buyer).retireCredit(0)).wait();
  await (await contract.connect(owner).issueCredit("Área Beta", "Amazonas, BR", "-3.5,-60.1", 500n)).wait();   // id=1
  await (await contract.connect(validator).rejectCredit(1, "Coordenadas inválidas")).wait();
  await (await contract.connect(owner).issueCredit("Área Gama", "Mato Grosso, BR", "-11.0,-55.0", 750n)).wait(); // id=2
  await (await contract.connect(validator).validateCredit(2)).wait();

  const allEvents = await getEvents(contract, deployBlock);

  console.log("\n══════════════════════════════════════════════════");
  console.log("  E6 — Completude do Log de Auditoria");
  console.log("══════════════════════════════════════════════════\n");
  console.log(`  Total de eventos capturados: ${allEvents.length}`);

  // E6-C1: sequência de eventos esperados
  const expectedSequence = [
    "CreditIssued", "CreditValidated", "CreditTransferred", "CreditRetired", // id=0
    "CreditIssued", "CreditRejected",                                          // id=1
    "CreditIssued", "CreditValidated",                                         // id=2
  ];
  const obtainedSequence = allEvents.map((e) => e.event);
  const seqMatch = JSON.stringify(expectedSequence) === JSON.stringify(obtainedSequence);
  results.push({
    id: "E6-C1",
    description: "Sequência de eventos corresponde às operações realizadas",
    pass: seqMatch,
    detail: seqMatch
      ? `OK — ${allEvents.length} eventos na ordem correta`
      : `Esperado: ${expectedSequence.join(",")} | Obtido: ${obtainedSequence.join(",")}`,
  });

  // E6-C2: cada evento tem creditId, blockNumber e txHash
  const allHaveMetadata = allEvents.every((e) => e.blockNumber > 0 && e.txHash.startsWith("0x"));
  results.push({
    id: "E6-C2",
    description: "Todos os eventos têm blockNumber e txHash válidos",
    pass: allHaveMetadata,
    detail: allHaveMetadata ? "OK" : "Evento(s) sem metadados",
  });

  // E6-C3: creditId nos eventos está correto (arg principal)
  const creditIdCorrect = allEvents
    .filter((e) => ["CreditIssued", "CreditValidated", "CreditTransferred", "CreditRetired", "CreditRejected"].includes(e.event))
    .every((e) => e.args["creditId"] !== undefined);
  results.push({
    id: "E6-C3",
    description: "Todos os eventos de crédito contêm o campo creditId",
    pass: creditIdCorrect,
    detail: creditIdCorrect ? "OK" : "creditId ausente em algum evento",
  });

  // E6-C4: CreditRejected tem campo reason
  const rejectedEvents = allEvents.filter((e) => e.event === "CreditRejected");
  const hasReason = rejectedEvents.every((e) => e.args["reason"] !== undefined && e.args["reason"].length > 0);
  results.push({
    id: "E6-C4",
    description: "CreditRejected inclui campo reason não-vazio",
    pass: hasReason,
    detail: hasReason ? `OK — ${rejectedEvents.length} rejeição(ões) com razão registrada` : "Razão ausente",
  });

  printResults(results, "E6");

  // ────────────────────────────────────────────────────────────
  // E7: Reprodutibilidade — replay dos eventos reconstrói estado
  // ────────────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════");
  console.log("  E7 — Reprodutibilidade: Replay de Eventos");
  console.log("══════════════════════════════════════════════════\n");

  const resultsE7: TestResult[] = [];

  // Estado reconstruído pelos eventos (simulação de replay)
  interface CreditState { owner: string; status: string }
  const replayState: Map<number, CreditState> = new Map();

  for (const ev of allEvents) {
    const id = parseInt(ev.args["creditId"] ?? "-1");
    if (isNaN(id)) continue;
    switch (ev.event) {
      case "CreditIssued":
        replayState.set(id, { owner: ev.args["issuer"] ?? "", status: "Created" });
        break;
      case "CreditValidated":
        replayState.get(id)!.status = "Validated";
        break;
      case "CreditRejected":
        replayState.get(id)!.status = "Rejected";
        break;
      case "CreditTransferred":
        replayState.set(id, { owner: ev.args["to"] ?? "", status: "Transferred" });
        break;
      case "CreditRetired":
        replayState.get(id)!.status = "Retired";
        break;
    }
  }

  // Verifica contra estado real do contrato
  const STATUS = ["Created", "Validated", "Transferred", "Retired", "Rejected"];
  let allMatch = true;
  for (const [id, replayCredit] of replayState) {
    const onChain = await contract.getCredit(id);
    const onChainStatus = STATUS[Number(onChain.status)];
    const statusMatch = replayCredit.status === onChainStatus;
    if (!statusMatch) allMatch = false;
    resultsE7.push({
      id: `E7-R${id}`,
      description: `Crédito #${id}: status reconstituído por replay`,
      pass: statusMatch,
      detail: `replay="${replayCredit.status}" on-chain="${onChainStatus}"`,
    });
  }
  resultsE7.push({
    id: "E7-TOTAL",
    description: "Todos os estados reconstituídos por replay batem com on-chain",
    pass: allMatch,
    detail: allMatch ? "OK" : "Divergência detectada",
  });

  printResults(resultsE7, "E7");

  // ────────────────────────────────────────────────────────────
  // E8: Imutabilidade — eventos antigos não mudam após novas operações
  // ────────────────────────────────────────────────────────────
  console.log("══════════════════════════════════════════════════");
  console.log("  E8 — Imutabilidade do Histórico");
  console.log("══════════════════════════════════════════════════\n");

  const resultsE8: TestResult[] = [];

  // Snapshot dos eventos antes de novas operações
  const snapshotBefore = JSON.stringify(allEvents.map((e) => ({ event: e.event, txHash: e.txHash, blockNumber: e.blockNumber })));

  // Realiza operação nova
  await (await contract.connect(owner).issueCredit("Área Delta", "Roraima, BR", "2.0,-61.0", 200n)).wait();

  // Relê eventos do mesmo intervalo (fromBlock=deployBlock até o bloco da snapshot)
  const snapshotAfter = JSON.stringify(
    (await getEvents(contract, deployBlock))
      .filter((e) => allEvents.some((a) => a.txHash === e.txHash))
      .map((e) => ({ event: e.event, txHash: e.txHash, blockNumber: e.blockNumber }))
  );

  const historyUnchanged = snapshotBefore === snapshotAfter;
  resultsE8.push({
    id: "E8-I1",
    description: "Eventos históricos permanecem inalterados após nova operação",
    pass: historyUnchanged,
    detail: historyUnchanged ? "OK — histórico imutável confirmado" : "FALHA — histórico adulterado",
  });

  // Verifica que novo evento foi adicionado (não substituído)
  const eventsAfterNew = await getEvents(contract, deployBlock);
  const newEventAdded = eventsAfterNew.length === allEvents.length + 1;
  resultsE8.push({
    id: "E8-I2",
    description: "Nova operação ACRESCENTA evento sem remover existentes",
    pass: newEventAdded,
    detail: `antes=${allEvents.length}, depois=${eventsAfterNew.length} — ${newEventAdded ? "OK" : "FALHA"}`,
  });

  // Verifica blocos crescentes (ordem temporal garantida pela blockchain)
  const blocksMonotonic = eventsAfterNew.every((e, i) => i === 0 || e.blockNumber >= eventsAfterNew[i - 1].blockNumber);
  resultsE8.push({
    id: "E8-I3",
    description: "Blocos dos eventos são monotonicamente crescentes",
    pass: blocksMonotonic,
    detail: blocksMonotonic ? "OK" : "Ordem de blocos inconsistente",
  });

  printResults(resultsE8, "E8");

  // Resumo
  const all = [...results, ...resultsE7, ...resultsE8];
  const passed = all.filter((r) => r.pass).length;
  console.log(`\n  RESUMO GERAL: ${passed}/${all.length} verificações aprovadas`);
  if (passed === all.length) {
    console.log("  ✅ Log de auditoria COMPLETO, REPRODUZÍVEL e IMUTÁVEL.\n");
  }

  console.log("\n  Eventos registrados:");
  for (const ev of allEvents.slice(0, 10)) {
    console.log(`    [Bloco ${ev.blockNumber}] ${ev.event} creditId=${ev.args["creditId"] ?? "-"} tx=${ev.txHash.substring(0, 14)}...`);
  }

  return { E6: results, E7: resultsE7, E8: resultsE8, summary: { passed, total: all.length } };
}

function printResults(results: TestResult[], group: string) {
  const colW = 52;
  console.log(`\n  ${"ID".padEnd(12)} ${"Descrição".padEnd(colW)} Status`);
  console.log("  " + "─".repeat(80));
  for (const r of results) {
    const status = r.pass ? "✅ OK" : "❌ FALHA";
    console.log(`  ${r.id.padEnd(12)} ${r.description.padEnd(colW)} ${status}`);
    if (!r.pass || r.detail !== "OK") {
      console.log(`  ${"".padEnd(12)} ↳ ${r.detail}`);
    }
  }
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n  ${group}: ${passed}/${results.length} aprovados\n`);
}

main()
  .then((data) => {
    console.log("\n  [JSON para relatório]");
    console.log(JSON.stringify({ experiment: "E6+E7+E8", ...data.summary }, null, 2));
  })
  .catch((err) => { console.error(err); process.exit(1); });
