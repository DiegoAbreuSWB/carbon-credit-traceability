/**
 * blockchainService.ts
 *
 * Abstração de acesso ao contrato CarbonCreditRegistry.
 *
 * Modos:
 *  - "blockchain" (padrão quando VITE_CONTRACT_ADDRESS está definido):
 *      comunica com o contrato real implantado via Ethers.js + MetaMask.
 *  - "mock" (fallback ou quando VITE_MODE=mock):
 *      usa dados sintéticos locais para demonstração visual sem infraestrutura.
 *
 * O modo é determinado por VITE_MODE. Se VITE_MODE=blockchain mas MetaMask não
 * estiver disponível, o serviço lança erro descritivo em vez de cair em mock.
 */

import { ethers, BrowserProvider, Contract, JsonRpcProvider } from 'ethers';
import { CarbonCredit, CreditEvent, CreditStatus, DashboardStats, IssueFormData } from '../types';
import { MOCK_CREDITS, MOCK_EVENTS } from '../data/mockCredits';

// ─── Configuração ────────────────────────────────────────────────────────────

export const MODE: 'blockchain' | 'mock' =
  (import.meta.env.VITE_MODE as 'blockchain' | 'mock') ?? 'mock';

const CONTRACT_ADDRESS: string = import.meta.env.VITE_CONTRACT_ADDRESS ?? '';
const RPC_URL: string = import.meta.env.VITE_RPC_URL ?? 'http://127.0.0.1:8545';

// ─── ABI mínima do contrato ──────────────────────────────────────────────────

const ABI = [
  // Escrita
  'function issueCredit(string areaName, string location, string geoCoordinates, uint256 co2Tonnes) returns (uint256)',
  'function validateCredit(uint256 creditId)',
  'function rejectCredit(uint256 creditId, string reason)',
  'function transferCredit(uint256 creditId, address to)',
  'function retireCredit(uint256 creditId)',
  // Leitura
  'function getCredit(uint256 creditId) view returns (tuple(uint256 id, string areaName, string location, string geoCoordinates, uint256 co2Tonnes, address issuer, address owner, address validator, uint256 issuedAt, uint8 status))',
  'function getTotalCredits() view returns (uint256)',
  'function getCreditIds() view returns (uint256[])',
  'function getAuditLog() view returns (tuple(uint256 creditId, string eventType, address actor, uint256 timestamp, string metadata)[])',
  'function getCreditEvents(uint256 creditId) view returns (tuple(uint256 creditId, string eventType, address actor, uint256 timestamp, string metadata)[])',
  // Eventos
  'event CreditIssued(uint256 indexed creditId, address indexed issuer, string areaName, uint256 co2Tonnes, uint256 timestamp)',
  'event CreditValidated(uint256 indexed creditId, address indexed validator, uint256 timestamp)',
  'event CreditRejected(uint256 indexed creditId, address indexed validator, string reason, uint256 timestamp)',
  'event CreditTransferred(uint256 indexed creditId, address indexed from, address indexed to, uint256 timestamp)',
  'event CreditRetired(uint256 indexed creditId, address indexed owner, uint256 timestamp)',
] as const;

const STATUS_MAP: Record<number, CreditStatus> = {
  0: 'Created', 1: 'Validated', 2: 'Transferred', 3: 'Retired', 4: 'Rejected',
};

// ─── Helpers internos ────────────────────────────────────────────────────────

function assertBlockchainConfig() {
  if (!CONTRACT_ADDRESS) {
    throw new Error(
      'VITE_CONTRACT_ADDRESS não definido. Execute "npm run deploy:local" na raiz do projeto e reinicie o frontend.'
    );
  }
}

/** Retorna um provider de leitura (sem signer) usando JsonRpc ou BrowserProvider. */
function getReadProvider(): JsonRpcProvider | BrowserProvider {
  if (window.ethereum) return new BrowserProvider(window.ethereum);
  // Fallback: provider direto por RPC (sem MetaMask — apenas leitura)
  return new JsonRpcProvider(RPC_URL);
}

/** Retorna um signer da MetaMask (necessário para escrita). */
async function getSigner(): Promise<ethers.JsonRpcSigner> {
  if (!window.ethereum) {
    throw new Error('MetaMask não encontrada. Instale a extensão MetaMask para assinar transações.');
  }
  const provider = new BrowserProvider(window.ethereum);
  // Solicita acesso se ainda não concedido
  await provider.send('eth_requestAccounts', []);
  return provider.getSigner();
}

function getReadContract(): Contract {
  assertBlockchainConfig();
  return new Contract(CONTRACT_ADDRESS, ABI, getReadProvider());
}

async function getWriteContract(): Promise<Contract> {
  assertBlockchainConfig();
  const signer = await getSigner();
  return new Contract(CONTRACT_ADDRESS, ABI, signer);
}

// ─── Mapeadores ──────────────────────────────────────────────────────────────

type RawCredit = {
  id: bigint; areaName: string; location: string; geoCoordinates: string;
  co2Tonnes: bigint; issuer: string; owner: string; validator: string;
  issuedAt: bigint; status: number;
};

type RawEvent = {
  creditId: bigint; eventType: string; actor: string; timestamp: bigint; metadata: string;
};

function mapCredit(r: RawCredit): CarbonCredit {
  return {
    id: r.id.toString(),
    areaName: r.areaName,
    location: r.location,
    geoCoordinates: r.geoCoordinates,
    co2Tonnes: Number(r.co2Tonnes),
    issuer: r.issuer,
    owner: r.owner,
    validator: r.validator,
    issuedAt: Number(r.issuedAt),
    status: STATUS_MAP[r.status] ?? 'Created',
  };
}

function mapEvent(r: RawEvent, txHash?: string): CreditEvent {
  return {
    creditId: r.creditId.toString(),
    eventType: r.eventType,
    actor: r.actor,
    timestamp: Number(r.timestamp),
    metadata: r.metadata,
    txHash,
  };
}

// ─── Estado mock (sessão) ────────────────────────────────────────────────────

let _mockCredits: CarbonCredit[] = [...MOCK_CREDITS];
let _mockEvents: CreditEvent[] = [...MOCK_EVENTS];
let _mockNextId = _mockCredits.length;

// ─── API pública ─────────────────────────────────────────────────────────────

export function isMockMode(): boolean { return MODE === 'mock'; }

export async function connectWallet(): Promise<string> {
  if (MODE === 'mock') return '0xMockUser0000000000000000000000000000000';
  const signer = await getSigner();
  return signer.getAddress();
}

export async function getAllCredits(): Promise<CarbonCredit[]> {
  if (MODE === 'mock') return [..._mockCredits];
  const contract = getReadContract();
  const ids: bigint[] = await contract.getCreditIds();
  if (ids.length === 0) return [];
  const credits = await Promise.all(ids.map((id) => contract.getCredit(id)));
  return credits.map((c) => mapCredit(c as RawCredit));
}

export async function getCreditById(id: string): Promise<CarbonCredit | null> {
  if (MODE === 'mock') return _mockCredits.find((c) => c.id === id) ?? null;
  try {
    const contract = getReadContract();
    const raw = await contract.getCredit(BigInt(id));
    return mapCredit(raw as RawCredit);
  } catch { return null; }
}

export async function getAuditLog(): Promise<CreditEvent[]> {
  if (MODE === 'mock') return [..._mockEvents];
  const contract = getReadContract();
  const rawEvents: RawEvent[] = await contract.getAuditLog();
  return rawEvents.map((e) => mapEvent(e));
}

export async function getEventsByCredit(id: string): Promise<CreditEvent[]> {
  if (MODE === 'mock') return _mockEvents.filter((e) => e.creditId === id);
  const contract = getReadContract();
  const rawEvents: RawEvent[] = await contract.getCreditEvents(BigInt(id));
  return rawEvents.map((e) => mapEvent(e));
}

export async function issueCredit(data: IssueFormData): Promise<string> {
  if (MODE === 'mock') {
    const newId = String(_mockNextId++);
    const now = Math.floor(Date.now() / 1000);
    _mockCredits = [..._mockCredits, {
      id: newId, areaName: data.areaName, location: data.location,
      geoCoordinates: data.geoCoordinates, co2Tonnes: data.co2Tonnes,
      issuer: '0xMockUser', owner: '0xMockUser', validator: '(não validado)',
      issuedAt: now, status: 'Created',
    }];
    _mockEvents = [..._mockEvents, { creditId: newId, eventType: 'CreditIssued', actor: '0xMockUser', timestamp: now, metadata: '' }];
    return `mock-tx-issue-${newId}`;
  }
  const contract = await getWriteContract();
  const tx = await contract.issueCredit(data.areaName, data.location, data.geoCoordinates, BigInt(data.co2Tonnes));
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

export async function validateCredit(id: string): Promise<string> {
  if (MODE === 'mock') {
    _mockCredits = _mockCredits.map((c) => c.id === id ? { ...c, status: 'Validated' as CreditStatus } : c);
    _mockEvents = [..._mockEvents, { creditId: id, eventType: 'CreditValidated', actor: '0xMockValidator', timestamp: Math.floor(Date.now() / 1000), metadata: '' }];
    return `mock-tx-validate-${id}`;
  }
  const contract = await getWriteContract();
  const tx = await contract.validateCredit(BigInt(id));
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

export async function rejectCredit(id: string, reason: string): Promise<string> {
  if (MODE === 'mock') {
    _mockCredits = _mockCredits.map((c) => c.id === id ? { ...c, status: 'Rejected' as CreditStatus } : c);
    _mockEvents = [..._mockEvents, { creditId: id, eventType: 'CreditRejected', actor: '0xMockValidator', timestamp: Math.floor(Date.now() / 1000), metadata: reason }];
    return `mock-tx-reject-${id}`;
  }
  const contract = await getWriteContract();
  const tx = await contract.rejectCredit(BigInt(id), reason);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

export async function transferCredit(id: string, to: string): Promise<string> {
  if (MODE === 'mock') {
    _mockCredits = _mockCredits.map((c) => c.id === id ? { ...c, status: 'Transferred' as CreditStatus, owner: to } : c);
    _mockEvents = [..._mockEvents, { creditId: id, eventType: 'CreditTransferred', actor: '0xMockUser', timestamp: Math.floor(Date.now() / 1000), metadata: to }];
    return `mock-tx-transfer-${id}`;
  }
  if (!ethers.isAddress(to)) throw new Error('Endereço de destino inválido.');
  const contract = await getWriteContract();
  const tx = await contract.transferCredit(BigInt(id), to);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

export async function retireCredit(id: string): Promise<string> {
  if (MODE === 'mock') {
    _mockCredits = _mockCredits.map((c) => c.id === id ? { ...c, status: 'Retired' as CreditStatus } : c);
    _mockEvents = [..._mockEvents, { creditId: id, eventType: 'CreditRetired', actor: '0xMockUser', timestamp: Math.floor(Date.now() / 1000), metadata: '' }];
    return `mock-tx-retire-${id}`;
  }
  const contract = await getWriteContract();
  const tx = await contract.retireCredit(BigInt(id));
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

export function getDashboardStats(credits: CarbonCredit[]): DashboardStats {
  return {
    totalCredits: credits.length,
    created:      credits.filter((c) => c.status === 'Created').length,
    validated:    credits.filter((c) => c.status === 'Validated').length,
    transferred:  credits.filter((c) => c.status === 'Transferred').length,
    retired:      credits.filter((c) => c.status === 'Retired').length,
    rejected:     credits.filter((c) => c.status === 'Rejected').length,
    totalCO2:     credits.reduce((acc, c) => acc + c.co2Tonnes, 0),
    totalAreas:   new Set(credits.map((c) => c.areaName)).size,
  };
}

/** Retorna informações sobre a rede atual (apenas blockchain mode). */
export async function getNetworkInfo(): Promise<{ name: string; chainId: number } | null> {
  if (MODE === 'mock') return null;
  try {
    const provider = getReadProvider();
    const network = await provider.getNetwork();
    return { name: network.name, chainId: Number(network.chainId) };
  } catch { return null; }
}
