export interface OnChainSeatCreatedEvent {
  seatId: string;
  firmAdmin: string;
  capital: string;
  blockHeight: number;
}

export interface OnChainOrderApprovedEvent {
  seatId: string;
  marketId: string;
  notional: string;
  blockHeight: number;
}
