/**
 * DADOS SINTÉTICOS — exclusivamente para validação do protótipo acadêmico.
 * Não representam propriedades reais, coordenadas exatas ou empresas reais.
 * Nomes de áreas são fictícios ou baseados em denominações de domínio público.
 */

import { CarbonCredit, CreditEvent, MockAreaData } from '../types';

export const MOCK_AREA_DATA: MockAreaData[] = [
  {
    areaName: 'Reserva Florestal Rio Jutaí (Simulada)',
    municipality: 'Jutaí',
    state: 'AM',
    coordinates: '-2.7450,-66.7825',
    hectares: 12500,
    co2Estimate: 2500,
    initialStatus: 'Transferred',
    issuer: 'Instituto Florestal Amazônia S/A (Simulado)',
    validator: 'CertAmb Certificadora Ltda (Simulada)',
  },
  {
    areaName: 'Parque Estadual Serra Araçá (Simulado)',
    municipality: 'Barcelos',
    state: 'AM',
    coordinates: '-0.9011,-63.2847',
    hectares: 8700,
    co2Estimate: 1800,
    initialStatus: 'Validated',
    issuer: 'Verde Carbono Gestão Ambiental (Simulada)',
    validator: 'CertAmb Certificadora Ltda (Simulada)',
  },
  {
    areaName: 'Floresta Nacional do Jamanxim (Simulada)',
    municipality: 'Novo Progresso',
    state: 'PA',
    coordinates: '-6.5012,-55.9841',
    hectares: 18300,
    co2Estimate: 3200,
    initialStatus: 'Retired',
    issuer: 'BioCarbon Preservação Ltda (Simulada)',
    validator: 'EcoAudit Verificações (Simulada)',
  },
  {
    areaName: 'APA Caverna do Maroaga (Simulada)',
    municipality: 'Presidente Figueiredo',
    state: 'AM',
    coordinates: '-1.9732,-60.0217',
    hectares: 4200,
    co2Estimate: 900,
    initialStatus: 'Created',
    issuer: 'Instituto Florestal Amazônia S/A (Simulado)',
    validator: '',
  },
  {
    areaName: 'RDS Uatumã (Simulada)',
    municipality: 'São Sebastião do Uatumã',
    state: 'AM',
    coordinates: '-2.6823,-58.0011',
    hectares: 6800,
    co2Estimate: 1500,
    initialStatus: 'Validated',
    issuer: 'Verde Carbono Gestão Ambiental (Simulada)',
    validator: 'EcoAudit Verificações (Simulada)',
  },
  {
    areaName: 'FLONA Tapajós Norte (Simulada)',
    municipality: 'Belterra',
    state: 'PA',
    coordinates: '-3.6712,-54.9500',
    hectares: 15600,
    co2Estimate: 2900,
    initialStatus: 'Validated',
    issuer: 'BioCarbon Preservação Ltda (Simulada)',
    validator: 'CertAmb Certificadora Ltda (Simulada)',
  },
  {
    areaName: 'TI Yanomami Zona Sul (Simulada)',
    municipality: 'Boa Vista',
    state: 'RR',
    coordinates: '2.8200,-62.4500',
    hectares: 22100,
    co2Estimate: 4100,
    initialStatus: 'Rejected',
    issuer: 'Verde Carbono Gestão Ambiental (Simulada)',
    validator: 'EcoAudit Verificações (Simulada)',
  },
  {
    areaName: 'Resex Baixo Rio Branco-Jauaperi (Simulada)',
    municipality: 'Caracaraí',
    state: 'RR',
    coordinates: '0.9123,-61.3841',
    hectares: 9400,
    co2Estimate: 2100,
    initialStatus: 'Transferred',
    issuer: 'Instituto Florestal Amazônia S/A (Simulado)',
    validator: 'CertAmb Certificadora Ltda (Simulada)',
  },
];

const BASE_TS = 1700000000; // timestamp base simulado

export const MOCK_CREDITS: CarbonCredit[] = MOCK_AREA_DATA.map((area, i) => ({
  id: String(i),
  areaName: area.areaName,
  location: `${area.municipality}, ${area.state}`,
  geoCoordinates: area.coordinates,
  co2Tonnes: area.co2Estimate,
  issuer: area.issuer,
  owner: area.initialStatus === 'Transferred'
    ? '0xRecipient000000000000000000000000000000' + i
    : area.issuer,
  validator: area.validator || '(não validado)',
  issuedAt: BASE_TS + i * 86400,
  status: area.initialStatus,
}));

export const MOCK_EVENTS: CreditEvent[] = [
  { creditId: '0', eventType: 'CreditIssued', actor: MOCK_AREA_DATA[0].issuer, timestamp: BASE_TS, metadata: '', txHash: '0xabc123...0001' },
  { creditId: '0', eventType: 'CreditValidated', actor: MOCK_AREA_DATA[0].validator, timestamp: BASE_TS + 3600, metadata: '', txHash: '0xabc123...0002' },
  { creditId: '0', eventType: 'CreditTransferred', actor: MOCK_AREA_DATA[0].issuer, timestamp: BASE_TS + 7200, metadata: '0xRecipient...', txHash: '0xabc123...0003' },
  { creditId: '1', eventType: 'CreditIssued', actor: MOCK_AREA_DATA[1].issuer, timestamp: BASE_TS + 86400, metadata: '', txHash: '0xdef456...0001' },
  { creditId: '1', eventType: 'CreditValidated', actor: MOCK_AREA_DATA[1].validator, timestamp: BASE_TS + 90000, metadata: '', txHash: '0xdef456...0002' },
  { creditId: '2', eventType: 'CreditIssued', actor: MOCK_AREA_DATA[2].issuer, timestamp: BASE_TS + 172800, metadata: '', txHash: '0xghi789...0001' },
  { creditId: '2', eventType: 'CreditValidated', actor: MOCK_AREA_DATA[2].validator, timestamp: BASE_TS + 176400, metadata: '', txHash: '0xghi789...0002' },
  { creditId: '2', eventType: 'CreditRetired', actor: MOCK_AREA_DATA[2].issuer, timestamp: BASE_TS + 180000, metadata: '', txHash: '0xghi789...0003' },
  { creditId: '3', eventType: 'CreditIssued', actor: MOCK_AREA_DATA[3].issuer, timestamp: BASE_TS + 259200, metadata: '', txHash: '0xjkl012...0001' },
  { creditId: '4', eventType: 'CreditIssued', actor: MOCK_AREA_DATA[4].issuer, timestamp: BASE_TS + 345600, metadata: '', txHash: '0xmno345...0001' },
  { creditId: '4', eventType: 'CreditValidated', actor: MOCK_AREA_DATA[4].validator, timestamp: BASE_TS + 349200, metadata: '', txHash: '0xmno345...0002' },
  { creditId: '5', eventType: 'CreditIssued', actor: MOCK_AREA_DATA[5].issuer, timestamp: BASE_TS + 432000, metadata: '', txHash: '0xpqr678...0001' },
  { creditId: '5', eventType: 'CreditValidated', actor: MOCK_AREA_DATA[5].validator, timestamp: BASE_TS + 435600, metadata: '', txHash: '0xpqr678...0002' },
  { creditId: '6', eventType: 'CreditIssued', actor: MOCK_AREA_DATA[6].issuer, timestamp: BASE_TS + 518400, metadata: '', txHash: '0xstu901...0001' },
  { creditId: '6', eventType: 'CreditRejected', actor: MOCK_AREA_DATA[6].validator, timestamp: BASE_TS + 522000, metadata: 'Área não atende critérios mínimos de preservação', txHash: '0xstu901...0002' },
  { creditId: '7', eventType: 'CreditIssued', actor: MOCK_AREA_DATA[7].issuer, timestamp: BASE_TS + 604800, metadata: '', txHash: '0xvwx234...0001' },
  { creditId: '7', eventType: 'CreditValidated', actor: MOCK_AREA_DATA[7].validator, timestamp: BASE_TS + 608400, metadata: '', txHash: '0xvwx234...0002' },
  { creditId: '7', eventType: 'CreditTransferred', actor: MOCK_AREA_DATA[7].issuer, timestamp: BASE_TS + 612000, metadata: '0xRecipient...', txHash: '0xvwx234...0003' },
];
