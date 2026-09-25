export type SeatStatus = 'OPEN' | 'CHALLENGE_ACTIVE' | 'FUNDED' | 'BREACHED' | 'SETTLED' | 'REVOKED';

export interface PropSeat {
  id: string;
  firmAddress: string;
  subaccountId: string;
  initialCapitalUsd: number;
  currentCapitalUsd: number;
  status: SeatStatus;
  profitSplitFirmBps: number;
  profitSplitAgentBps: number;
  createdAt: number;
  updatedAt: number;
}
