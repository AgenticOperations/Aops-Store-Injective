export interface BatchAuctionClear {
  marketId: string;
  clearingPrice: string;
  totalVolume: string;
  blockHeight: number;
}

export function parseBatchAuction(rawEvents: any[]): BatchAuctionClear[] {
  return rawEvents.map(e => ({
    marketId: e.market_id,
    clearingPrice: e.clearing_price,
    totalVolume: e.volume,
    blockHeight: e.block_height,
  }));
}
