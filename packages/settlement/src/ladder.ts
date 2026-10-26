export interface LadderTierConfig {
  tierLevel: number;
  allocatedCapitalUsd: number;
  profitTargetPct: number;
  maxTrailingDrawdownPct: number;
  profitSplitAgentBps: number;
}

export const CAPITAL_LADDER_TIERS: LadderTierConfig[] = [
  { tierLevel: 0, allocatedCapitalUsd: 100, profitTargetPct: 6, maxTrailingDrawdownPct: 4, profitSplitAgentBps: 0 },
  { tierLevel: 1, allocatedCapitalUsd: 1000, profitTargetPct: 10, maxTrailingDrawdownPct: 8, profitSplitAgentBps: 8000 },
  { tierLevel: 2, allocatedCapitalUsd: 10000, profitTargetPct: 15, maxTrailingDrawdownPct: 10, profitSplitAgentBps: 8500 }
];
