/**
 * RING 0 · PURE — no I/O, imports nothing
 * `@repo/scoring/independence` — public contract. Named exports only.
 *
 * weight() / score() / confidence() / sybil-independence math. Versioned: every result carries the methodology version that produced it.
 */

/**
 * `independence_confidence(e) = 1 − suspicion_score` — `architecture/01` §1.10. The combination
 * formula is settled; the *signal computation* that produces `suspicionScore` (wallet-cluster
 * hop-walk, timing z-score, reciprocal-cycle detection) is `final-review-docs/02`
 * (fraud/sybil), explicitly hackathon-deferred and out of Chunk 1 scope. Until that ships,
 * callers pass `0` (no suspicion detected) via {@link DEFAULT_SUSPICION_SCORE}.
 *
 * Continuous 0–1, never a binary flag — a suspicious review is discounted toward irrelevance,
 * not deleted.
 */
export function independenceConfidence(suspicionScore: number): number {
  if (suspicionScore < 0 || suspicionScore > 1) {
    throw new Error(`suspicionScore must be in [0, 1], got ${suspicionScore}`)
  }
  return 1 - suspicionScore
}

/** Used until `02`'s sybil signals are wired in — no suspicion detected. */
export const DEFAULT_SUSPICION_SCORE = 0
