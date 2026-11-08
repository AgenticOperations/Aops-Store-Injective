export interface FillPair {
  makerAddress: string;
  takerAddress: string;
  notionalUsd: number;
}

export function computeWashTradeScore(fills: FillPair[]): number {
  if (fills.length === 0) return 0;
  let circularCount = 0;
  for (const f of fills) {
    if (f.makerAddress.toLowerCase() === f.takerAddress.toLowerCase()) {
      circularCount++;
    }
  }
  return circularCount / fills.length;
}
