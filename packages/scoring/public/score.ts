/**
 * RING 0 · PURE — no I/O, imports nothing
 * `@repo/scoring/score` — public contract. Named exports only.
 *
 * weight() / score() / confidence() / sybil-independence math. Versioned: every result carries the methodology version that produced it.
 */

import { SCORING_METHODOLOGY_VERSION } from './version'

/**
 * One already-weighted, already-normalized observation feeding `score()`/`confidence()`.
 * `normalizedValue` requires prior classification into the canonical metric ontology
 * (`architecture/01` §1.9) — unclassifiable feedback is excluded before it ever reaches this
 * package, never coerced here.
 */
export interface WeightedObservation {
  normalizedValue: number
  weight: number
  evidenceLevel: number
}

/**
 * `score = Σ(e.normalized_value × weight(e)) / Σ(weight(e))` — `architecture/01` §1.9.
 * Returns `null` when there is nothing to average over (zero observations, or every weight is
 * zero) — callers use this to route into the "no evidence" tagged state, never a bare `0`.
 */
export function score(observations: readonly WeightedObservation[]): number | null {
  const totalWeight = observations.reduce((sum, o) => sum + o.weight, 0)
  if (totalWeight === 0) return null
  const weightedSum = observations.reduce((sum, o) => sum + o.normalizedValue * o.weight, 0)
  return weightedSum / totalWeight
}

// -------------------------------------------------------------------------------------------
// confidence — `architecture/01` §1.9: "f(sample_size, evidence_level_diversity, Σweight) —
// saturating: 3×L6 outranks 400×L0."
//
// A naive Σweight fails that invariant outright: with `sourceRank` at its stated endpoints
// (L6=1.0, L0=0.1), 3×L6 sums to 3.0 while 400×L0 sums to 40.0 — the *low*-quality sample would
// win. Cubing each weight before summing ("strength") fixes this by constitution: 3×(1.0^3)=3
// vs. 400×(0.1^3)=0.4, so a handful of top-tier evidence dominates a flood of self-attestation,
// exactly as required. `strength` is then run through a saturating (Michaelis-Menten-shaped)
// curve so confidence approaches but never reaches 1. Concrete constants are an open tuning
// value (`final-review-docs/01` §11's "deferred to implementation" standard), named below so
// they're easy to retune.
// -------------------------------------------------------------------------------------------

export const CONFIDENCE_QUALITY_EXPONENT = 3
export const CONFIDENCE_SATURATION_CONSTANT = 1
/** Bounded nudge from evidence-level diversity — diversity alone can never manufacture
 * confidence, it only ever adjusts the strength-driven base by a few percent. */
export const CONFIDENCE_DIVERSITY_STEP = 0.02
export const MAX_EVIDENCE_LEVEL_DIVERSITY = 7 // L0..L6

export function confidence(params: {
  weights: readonly number[]
  /** Count of distinct `evidence_level` values represented in the sample (0–7). */
  evidenceLevelDiversity: number
}): number {
  const strength = params.weights.reduce((sum, w) => sum + w ** CONFIDENCE_QUALITY_EXPONENT, 0)
  const diversity = Math.min(
    Math.max(params.evidenceLevelDiversity, 0),
    MAX_EVIDENCE_LEVEL_DIVERSITY,
  )
  // Diversity is folded in before the saturating divide (rather than multiplying the result
  // after) so the output can never be pushed past the curve's own asymptote — it stays
  // strictly < 1 by construction, not by an ad hoc clamp.
  const adjustedStrength = strength * (1 + diversity * CONFIDENCE_DIVERSITY_STEP)
  return adjustedStrength / (adjustedStrength + CONFIDENCE_SATURATION_CONSTANT)
}

// -------------------------------------------------------------------------------------------
// The tagged result — `architecture/05` §5.2's empty-state rule: zero-evidence is a distinct
// state from a computed low score, never a bare 0 and never omitted.
// -------------------------------------------------------------------------------------------

export type ScoreResult =
  | { kind: 'no_evidence'; methodologyVersion: string }
  | {
      kind: 'scored'
      score: number
      confidence: number
      sampleSize: number
      methodologyVersion: string
    }

export function computeScoreResult(
  observations: readonly WeightedObservation[],
  methodologyVersion: string = SCORING_METHODOLOGY_VERSION,
): ScoreResult {
  const scoreValue = score(observations)
  if (scoreValue === null) return { kind: 'no_evidence', methodologyVersion }

  const evidenceLevelDiversity = new Set(observations.map((o) => o.evidenceLevel)).size
  const confidenceValue = confidence({
    weights: observations.map((o) => o.weight),
    evidenceLevelDiversity,
  })

  return {
    kind: 'scored',
    score: scoreValue,
    confidence: confidenceValue,
    sampleSize: observations.length,
    methodologyVersion,
  }
}
