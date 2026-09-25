export interface ExecutionFill {
  fillId: string;
  subaccountId: string;
  marketId: string;
  orderHash: string;
  price: string;
  quantity: string;
  fee: string;
  feeRecipient: string;
  blockHeight: number;
  timestamp: number;
}
