export interface InjectiveDiscoveryQuery {
  targetMarkets: string[];
  maxLeverage: number;
  maxDrawdownPct: number;
  minDeflatedSharpe: number;
  minFillsCount: number;
  strategyCategory?: 'GRID' | 'PERP_MOMENTUM' | 'MARKET_MAKING';
}
