/**
 * RING 2 · OWNED STATE — our database
 * `@repo/discovery/rank` — public contract. Named exports only.
 *
 * E9 deterministic weighted sum — discovery-engine-ryuk.md §5.
 */

import type { Category } from '@repo/domain/types'
import { assertSameCategory } from '#private/compare'
import {
  DISCOVERY_METHODOLOGY_VERSION,
  type DiscoveryCandidate,
  type RankFactorBreakdown,
  type RankWeights,
  type RankedCandidate,
} from './types'

export { DISCOVERY_METHODOLOGY_VERSION }

/** Per-category default weights — discovery-engine-ryuk.md §5.3. Each set sums to 1.00. */
export const DEFAULT_CATEGORY_WEIGHTS: Record<Category, RankWeights> = {
  rebalancing: {
    capability_match: 0.2,
    risk_fit: 0.2,
    trust_evidence_strength: 0.25,
    outcome_quality: 0.2,
    price_value: 0.1,
    availability: 0.05,
  },
  yield_optimization: {
    capability_match: 0.2,
    risk_fit: 0.2,
    trust_evidence_strength: 0.25,
    outcome_quality: 0.2,
    price_value: 0.1,
    availability: 0.05,
  },
  grid_trading: {
    capability_match: 0.15,
    risk_fit: 0.2,
    trust_evidence_strength: 0.25,
    outcome_quality: 0.15,
    price_value: 0.2,
    availability: 0.05,
  },
  health_factor_monitoring: {
    capability_match: 0.15,
    risk_fit: 0.1,
    trust_evidence_strength: 0.35,
    outcome_quality: 0.25,
    price_value: 0.05,
    availability: 0.1,
  },
}

export type RankResult =
  | {
      ok: true
      ranked: RankedCandidate[]
      category: Category
      weights: RankWeights
      methodologyVersion: string
    }
  | { ok: false; reason: 'cross-category'; detail: string }

const ZERO_EVIDENCE_TRUST_FLOOR = 0.5

function trustEvidenceStrength(candidate: DiscoveryCandidate): number {
  if (candidate.score === null || candidate.confidence === null) {
    return ZERO_EVIDENCE_TRUST_FLOOR
  }
  return (candidate.score / 100) * candidate.confidence
}

function outcomeQuality(candidate: DiscoveryCandidate): number {
  if (candidate.score === null) return ZERO_EVIDENCE_TRUST_FLOOR
  return candidate.score / 100
}

function priceValue(
  candidate: DiscoveryCandidate,
  candidates: readonly DiscoveryCandidate[],
): number {
  const fees = candidates.map((c) => c.feeBps)
  const minFee = Math.min(...fees)
  const maxFee = Math.max(...fees)
  if (maxFee === minFee) return 1
  return 1 - (candidate.feeBps - minFee) / (maxFee - minFee)
}

function computeFactors(
  candidate: DiscoveryCandidate,
  candidates: readonly DiscoveryCandidate[],
): RankFactorBreakdown {
  return {
    capability_match: 1,
    risk_fit: ZERO_EVIDENCE_TRUST_FLOOR,
    trust_evidence_strength: trustEvidenceStrength(candidate),
    outcome_quality: outcomeQuality(candidate),
    price_value: priceValue(candidate, candidates),
    availability: candidate.availability,
  }
}

function weightedSum(
  factors: RankFactorBreakdown,
  weights: RankWeights,
): {
  score: number
  breakdown: RankFactorBreakdown
} {
  const breakdown: RankFactorBreakdown = {
    capability_match: factors.capability_match * weights.capability_match,
    risk_fit: factors.risk_fit * weights.risk_fit,
    trust_evidence_strength: factors.trust_evidence_strength * weights.trust_evidence_strength,
    outcome_quality: factors.outcome_quality * weights.outcome_quality,
    price_value: factors.price_value * weights.price_value,
    availability: factors.availability * weights.availability,
  }
  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0)
  return { score, breakdown }
}

/**
 * `weighted_score = w1·capability_match + … + w6·availability` — deterministic given fixed inputs.
 * Rejects cross-category candidate sets at this layer (`architecture/05` §5.2 Layer 4).
 */
export function rank(
  candidates: readonly DiscoveryCandidate[],
  weights: RankWeights,
  methodologyVersion: string = DISCOVERY_METHODOLOGY_VERSION,
): RankResult {
  const categoryCheck = assertSameCategory(candidates)
  if (!categoryCheck.ok) {
    return { ok: false, reason: 'cross-category', detail: categoryCheck.detail }
  }

  const ranked = [...candidates]
    .map((candidate) => {
      const factors = computeFactors(candidate, candidates)
      const { score, breakdown } = weightedSum(factors, weights)
      return { candidate, weightedScore: score, factors, breakdown }
    })
    .sort((a, b) => b.weightedScore - a.weightedScore)

  return {
    ok: true,
    ranked,
    category: categoryCheck.category,
    weights,
    methodologyVersion,
  }
}

export function rankWithCategoryDefaults(
  candidates: readonly DiscoveryCandidate[],
  methodologyVersion: string = DISCOVERY_METHODOLOGY_VERSION,
): RankResult {
  const categoryCheck = assertSameCategory(candidates)
  if (!categoryCheck.ok) {
    return { ok: false, reason: 'cross-category', detail: categoryCheck.detail }
  }
  return rank(candidates, DEFAULT_CATEGORY_WEIGHTS[categoryCheck.category], methodologyVersion)
}
