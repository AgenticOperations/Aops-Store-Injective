import { CAPITAL_LADDER_TIERS, LadderTierConfig } from './ladder';

export function evaluateLadderPromotion(currentTier: number, pnlPct: number, minFills: number): { canPromote: boolean; nextTier?: LadderTierConfig } {
  const current = CAPITAL_LADDER_TIERS.find(t => t.tierLevel === currentTier);
  if (!current || minFills < 20) return { canPromote: false };
  if (pnlPct >= current.profitTargetPct) {
    const next = CAPITAL_LADDER_TIERS.find(t => t.tierLevel === currentTier + 1);
    if (next) return { canPromote: true, nextTier: next };
  }
  return { canPromote: false };
}
