import { CarbonCreditRegistry__factory } from "../../typechain-types";
/**
 * E15 + E16 — Consistência da Interface com o Estado On-Chain
 *
 * E15: lê o estado on-chain de todos os créditos e compara com o que
 *      a camada de serviço do frontend retornaria (blockchainService).
 * E16: verifica que o log de eventos on-chain corresponde ao audit log da UI.
 *
 * Não abre navegador — valida via leitura direta de contrato + ABI.
 *
 * Uso: npx hardhat run scripts/experiments/e15-interface.ts --network localhost
 */

import { ethers } from "hardhat";
import { eventIdentity, compareEventPosition } from "./event-identity";
import * as fs from "fs";
import * as path from "path";

const STATUS_MAP = ["Created", "Validated", "Transferred", "Retired", "Rejected"] as const;
type CreditStatus = typeof STATUS_MAP[number];

interface OnChainCredit {
  id: number;
  areaName: string;
  location: string;
  geoCoordinates: string;
  co2Tonnes: string;
  issuer: string;
  owner: string;
  validator: string;
  issuedAt: number;
  status: CreditStatus;
}

interface OnChainEvent {
  creditId: number;
  eventType: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  transactionIndex: number;
  args: Record<string, string>;
}

interface TestResult { id: string; description: string; pass: boolean; detail: string }

// Simula a lógica de mapeamento do blockchainService.ts do frontend.
// Struct CarbonCredit: [0]=id, [1]=areaName, [2]=location, [3]=geoCoordinates,
// [4]=co2Tonnes, [5]=issuer, [6]=owner, [7]=validator, [8]=issuedAt, [9]=status
function mapOnChainToFrontend(raw: any, id: number): OnChainCredit {
  const get = (name: string, idx: number) => raw[name] !== undefined ? raw[name] : raw[idx];
  return {
    id,
    areaName: String(get("areaName", 1)),
    location: String(get("location", 2)),
    geoCoordinates: String(get("geoCoordinates", 3)),
    co2Tonnes: get("co2Tonnes", 4).toString(),
    issuer: String(get("issuer", 5)),
    owner: String(get("owner", 6)),
    validator: String(get("validator", 7)),
    issuedAt: Number(get("issuedAt", 8)),
    status: STATUS_MAP[Number(get("status", 9))] as CreditStatus,
  };
}

async function readAllCredits(contract: any): Promise<OnChainCredit[]> {
  const total = Number(await contract.getTotalCredits());
  const credits: OnChainCredit[] = [];
  for (let i = 0; i < total; i++) {
    const raw = await contract.getCredit(i);
    credits.push(mapOnChainToFrontend(raw, i));
  }
  return credits;
}

async function readAllEvents(contract: any, fromBlock = 0): Promise<OnChainEvent[]> {
  const address = await contract.getAddress();
  const logs = await ethers.provider.getLogs({ address, fromBlock, toBlock: "latest" });
  const iface = contract.interface;

  return logs.map((log: any) => {
    const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
    const args: Record<string, string> = {};
    parsed?.args.forEach((v: any, i: number) => {
      const name = parsed.fragment.inputs[i]?.name ?? `arg${i}`;
      args[name] = v.toString();
    });
    return {
      creditId: parseInt(args["creditId"] ?? "-1"),
      eventType: parsed?.name ?? "Unknown",
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      logIndex: log.index,
      transactionIndex: log.transactionIndex,
      args,
    };
  });
}

async function main() {
  const [owner, validator, buyer, other] = await ethers.getSigners();
  const Factory = new CarbonCreditRegistry__factory((await ethers.getSigners())[0]);
  const results: TestResult[] = [];

  console.log("\n══════════════════════════════════════════════════");
  console.log("  E15 + E16 — Consistência Interface vs On-Chain");
  console.log("══════════════════════════════════════════════════\n");

  // ── Setup: ciclo de vida variado ────────────────────────────
  const contract = await (await Factory.deploy()).waitForDeployment();
  const fromBlock = await ethers.provider.getBlockNumber();

  const creditsInput = [
    { name: "Floresta Amazônica Leste", loc: "Pará, BR", coord: "-6.0,-52.5", co2: 1200n },
    { name: "Cerrado Central", loc: "Mato Grosso, BR", coord: "-13.0,-56.0", co2: 800n },
    { name: "Mata Atlântica Sul", loc: "Santa Catarina, BR", coord: "-27.0,-50.0", co2: 450n },
    { name: "Pantanal Norte", loc: "Mato Grosso do Sul, BR", coord: "-17.0,-57.0", co2: 950n },
    { name: "Caatinga", loc: "Bahia, BR", coord: "-10.5,-40.0", co2: 320n },
  ];

  for (const c of creditsInput) {
    await (await contract.connect(owner).issueCredit(c.name, c.loc, c.coord, c.co2)).wait();
  }
  // Ciclo completo: 0=Retired, 1=Transferred, 2=Validated, 3=Rejected, 4=Created
  await (await contract.connect(validator).validateCredit(0)).wait();
  await (await contract.connect(owner).transferCredit(0, buyer.address)).wait();
  await (await contract.connect(buyer).retireCredit(0)).wait();
  await (await contract.connect(validator).validateCredit(1)).wait();
  await (await contract.connect(owner).transferCredit(1, buyer.address)).wait();
  await (await contract.connect(validator).validateCredit(2)).wait();
  await (await contract.connect(validator).rejectCredit(3, "Dados incompletos")).wait();
  // id=4 permanece Created

  // ── Leitura on-chain ────────────────────────────────────────
  const onChainCredits = await readAllCredits(contract);
  const onChainEvents = await readAllEvents(contract, fromBlock);

  console.log(`  Créditos no contrato: ${onChainCredits.length}`);
  console.log(`  Eventos registrados:  ${onChainEvents.length}\n`);

  // ── E15: Consistência de dados dos créditos ─────────────────
  console.log("  E15 — Verificações de Dados dos Créditos:\n");

  // E15-D1: total de créditos
  const totalExpected = creditsInput.length;
  results.push({
    id: "E15-D1",
    description: `getTotalCredits() retorna ${totalExpected}`,
    pass: onChainCredits.length === totalExpected,
    detail: `obtido: ${onChainCredits.length}`,
  });

  // E15-D2: cada crédito tem campos obrigatórios não-vazios
  const allHaveFields = onChainCredits.every(
    (c) => c.areaName.length > 0 && c.location.length > 0 && c.issuer.startsWith("0x") && c.owner.startsWith("0x") && BigInt(c.co2Tonnes) > 0n
  );
  results.push({ id: "E15-D2", description: "Todos os créditos têm campos não-vazios", pass: allHaveFields, detail: allHaveFields ? "OK" : "Campo vazio detectado" });

  // E15-D3: status de cada crédito
  const expectedStatuses: CreditStatus[] = ["Retired", "Transferred", "Validated", "Rejected", "Created"];
  const statusesMatch = onChainCredits.every((c, i) => c.status === expectedStatuses[i]);
  results.push({
    id: "E15-D3",
    description: "Status de cada crédito corresponde às operações realizadas",
    pass: statusesMatch,
    detail: statusesMatch ? "OK" : `${onChainCredits.map((c, i) => `#${i}=${c.status}(esperado ${expectedStatuses[i]})`).join(", ")}`,
  });

  // E15-D4: owner de id=1 é buyer (após transferência)
  const id1Owner = onChainCredits[1]?.owner?.toLowerCase();
  const buyerAddr = buyer.address.toLowerCase();
  results.push({
    id: "E15-D4",
    description: "Owner do crédito #1 é buyer após transferência",
    pass: id1Owner === buyerAddr,
    detail: `on-chain=${id1Owner}, esperado=${buyerAddr}`,
  });

  // E15-D5: co2Tonnes preservado exatamente
  const co2Match = onChainCredits.every((c, i) => BigInt(c.co2Tonnes) === creditsInput[i].co2);
  results.push({ id: "E15-D5", description: "co2Tonnes preservado sem perda de precisão (uint256)", pass: co2Match, detail: co2Match ? "OK" : "Divergência de CO₂" });

  // E15-D6: issuedAt não-zero e monotonicamente crescente entre créditos
  // Nota: Hardhat automining acumula timestamps sintéticos além do relógio real;
  // verificamos apenas que o campo é preenchido e cresce a cada emissão.
  const timestampsNonZero = onChainCredits.every((c) => c.issuedAt > 0);
  const timestampsGrow = onChainCredits.every((c, i) => i === 0 || c.issuedAt >= onChainCredits[i - 1].issuedAt);
  const timestampsOk = timestampsNonZero && timestampsGrow;
  results.push({
    id: "E15-D6",
    description: "issuedAt não-zero e crescente entre créditos consecutivos",
    pass: timestampsOk,
    detail: timestampsOk
      ? `OK — valores: ${onChainCredits.map((c) => c.issuedAt).join(",")}`
      : `Inválido — ${!timestampsNonZero ? "algum issuedAt=0" : "ordem decrescente"}`,
  });

  // ── E16: Consistência do Log de Auditoria ──────────────────
  console.log("\n  E16 — Verificações do Log de Auditoria:\n");

  const evResults: TestResult[] = [];

  // E16-L1: número de eventos
  // 5 issues + validate(0) + transfer(0) + retire(0) + validate(1) + transfer(1) + validate(2) + reject(3) = 12
  const expectedEventCount = 12;
  evResults.push({
    id: "E16-L1",
    description: `Total de eventos = ${expectedEventCount}`,
    pass: onChainEvents.length === expectedEventCount,
    detail: `obtido: ${onChainEvents.length}`,
  });

  // E16-L2: eventos por crédito batem com operações
  const eventsByCredit: Record<number, string[]> = {};
  for (const ev of onChainEvents) {
    if (!eventsByCredit[ev.creditId]) eventsByCredit[ev.creditId] = [];
    eventsByCredit[ev.creditId].push(ev.eventType);
  }
  const expectedByCreditId: Record<number, string[]> = {
    0: ["CreditIssued", "CreditValidated", "CreditTransferred", "CreditRetired"],
    1: ["CreditIssued", "CreditValidated", "CreditTransferred"],
    2: ["CreditIssued", "CreditValidated"],
    3: ["CreditIssued", "CreditRejected"],
    4: ["CreditIssued"],
  };
  let allEventsMatch = true;
  for (const [id, expected] of Object.entries(expectedByCreditId)) {
    const obtained = eventsByCredit[parseInt(id)] ?? [];
    if (JSON.stringify(expected) !== JSON.stringify(obtained)) allEventsMatch = false;
  }
  evResults.push({
    id: "E16-L2",
    description: "Eventos por crédito correspondem às operações realizadas",
    pass: allEventsMatch,
    detail: allEventsMatch ? "OK" : JSON.stringify(eventsByCredit),
  });

  // E16-L3: todos os eventos têm txHash único
  const txHashes = onChainEvents.map(eventIdentity);
  const uniqueHashes = new Set(txHashes).size;
  evResults.push({
    id: "E16-L3",
    description: "Todos os eventos têm identidade txHash + logIndex única",
    pass: uniqueHashes === txHashes.length,
    detail: `${uniqueHashes} únicos de ${txHashes.length} total`,
  });

  // E16-L4: ordenação cronológica (blockNumber crescente)
  const ordered = onChainEvents.every((e, i) => i === 0 || compareEventPosition(onChainEvents[i - 1], e) < 0);
  evResults.push({ id: "E16-L4", description: "Eventos ordenados por bloco, transação e log", pass: ordered, detail: ordered ? "OK" : "Ordem incorreta" });

  results.push(...evResults);

  // Impressão
  const colW = 55;
  console.log(`  ${"ID".padEnd(10)} ${"Descrição".padEnd(colW)} Status`);
  console.log("  " + "─".repeat(80));
  for (const r of results) {
    const status = r.pass ? "✅ OK" : "❌ FALHA";
    console.log(`  ${r.id.padEnd(10)} ${r.description.padEnd(colW)} ${status}`);
    if (!r.pass) console.log(`  ${"".padEnd(10)} ↳ ${r.detail}`);
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n  RESUMO: ${passed}/${results.length} verificações aprovadas`);
  if (passed === results.length) {
    console.log("  ✅ Interface e on-chain CONSISTENTES — dados e log de auditoria íntegros.\n");
  }

  // Tabela de créditos
  console.log("\n  Estado on-chain dos créditos:");
  console.log("  ID  Nome                          Status       CO₂     Owner (truncado)");
  console.log("  " + "─".repeat(80));
  for (const c of onChainCredits) {
    console.log(
      `  ${c.id.toString().padEnd(4)}` +
      `${c.areaName.substring(0, 30).padEnd(32)}` +
      `${c.status.padEnd(13)}` +
      `${c.co2Tonnes.padStart(6)}  ` +
      `${c.owner.substring(0, 10)}...`
    );
  }

  return { experiment: "E15+E16", results, summary: { passed, total: results.length } };
}

main()
  .then((data) => {
    console.log("\n  [JSON para relatório]");
    console.log(JSON.stringify({ ...data, ...data.summary }, null, 2));
    if (data.summary.passed !== data.summary.total) process.exitCode = 1;
  })
  .catch((err) => { console.error(err); process.exit(1); });
