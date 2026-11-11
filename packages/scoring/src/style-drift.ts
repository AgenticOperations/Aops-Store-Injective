export interface OrderHistoryRecord {
  isBuy: boolean;
  notionalUsd: number;
  holdingDurationSeconds: number;
}

export function detectStyleDrift(declaredCategory: string, orders: OrderHistoryRecord[]): boolean {
  if (declaredCategory === 'MARKET_MAKING') {
    const buyCount = orders.filter(o => o.isBuy).length;
    const ratio = buyCount / orders.length;
    // Market makers must maintain relatively balanced two-sided flow
    if (ratio > 0.85 || ratio < 0.15) return true; // Style drift detected!
  }
  return false;
}
