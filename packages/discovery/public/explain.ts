/**
 * RING 2 · OWNED STATE — our database
 * `@repo/discovery/explain` — public contract. Named exports only.
 *
 * Explanation strings derived only from the same weight breakdown that produced the rank.
 */

import type { RankWeights, RankedCandidate } from './types'

const FACTOR_LABELS = {
  capability_match: 'capability match',
  risk_fit: 'risk fit',
  trust_evidence_strength: 'trust & evidence',
  outcome_quality: 'outcome quality',
  price_value: 'price value',
  availability: 'availability',
} as const

/**
 * Builds a human-readable explanation from `rank`'s per-factor weighted breakdown — never a
 * separately computed decorative string (discovery-engine-ryuk.md §5, decomposition E9).
 */
export function explain(ranked: RankedCandidate, weights: RankWeights): string {
  const factors = Object.keys(FACTOR_LABELS) as Array<keyof typeof FACTOR_LABELS>
  factors.sort((a, b) => ranked.breakdown[b] - ranked.breakdown[a])

  const lines = factors.map((factor) => {
    const label = FACTOR_LABELS[factor]
    const contribution = ranked.breakdown[factor]
    const weight = weights[factor]
    const raw = ranked.factors[factor]
    return `${label}: ${(contribution * 100).toFixed(1)} pts (raw ${(raw * 100).toFixed(0)}% × weight ${(weight * 100).toFixed(0)}%)`
  })

  return `Weighted score ${(ranked.weightedScore * 100).toFixed(1)} — ${lines.join('; ')}.`
}

export function explainTopFactor(ranked: RankedCandidate): keyof typeof FACTOR_LABELS {
  const entries = Object.entries(ranked.breakdown) as Array<[keyof typeof FACTOR_LABELS, number]>
  entries.sort((a, b) => b[1] - a[1])
  return entries[0]?.[0] ?? 'capability_match'
}
