export type CreditStatus = 'Created' | 'Validated' | 'Transferred' | 'Retired' | 'Rejected';

export interface CarbonCredit {
  id: string;
  areaName: string;
  location: string;
  geoCoordinates: string;
  co2Tonnes: number;
  issuer: string;
  owner: string;
  validator: string;
  issuedAt: number; // Unix timestamp
  status: CreditStatus;
}

export interface CreditEvent {
  creditId: string;
  eventType: string;
  actor: string;
  timestamp: number;
  metadata: string;
  txHash?: string;
}

export interface DashboardStats {
  totalCredits: number;
  created: number;
  validated: number;
  transferred: number;
  retired: number;
  rejected: number;
  totalCO2: number;
  totalAreas: number;
}

export interface IssueFormData {
  areaName: string;
  location: string;
  geoCoordinates: string;
  co2Tonnes: number;
}

export interface MockAreaData {
  areaName: string;
  municipality: string;
  state: string;
  coordinates: string;
  hectares: number;
  co2Estimate: number;
  initialStatus: CreditStatus;
  issuer: string;
  validator: string;
}
