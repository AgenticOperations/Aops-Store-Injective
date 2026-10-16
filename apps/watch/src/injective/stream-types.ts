export interface ChainStreamTradeEvent {
  subaccountId: string;
  marketId: string;
  orderHash: string;
  price: string;
  quantity: string;
  isBuy: bool;
  blockHeight: number;
}
