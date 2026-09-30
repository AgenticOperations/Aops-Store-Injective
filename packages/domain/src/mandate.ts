export interface RiskEnvelope {
  allowedMarketIds: string[];
  maxNotionalPerOrderUsd: number;
  maxNetLeverage: number;
  maxDailyLossPct: number;
  maxTrailingDrawdownPct: number;
  closeOnlyOnBreach: boolean;
}

export interface SeatMandate {
  seatId: string;
  agentId: string;
  envelope: RiskEnvelope;
  expiresAt: number;
  highWaterMarkUsd: number;
}
