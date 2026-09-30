/**
 * RING 0 · PURE — no I/O, imports nothing
 * `@repo/scoring/version` — public contract. Named exports only.
 *
 * weight() / score() / confidence() / sybil-independence math. Versioned: every result carries the methodology version that produced it.
 */

/** Bump whenever `weight()`, `score()`, or `confidence()`'s formula/constants change — every
 * `Performance` row pins the version that produced it so it stays re-derivable from raw
 * Evidence (`architecture/01` §1.6, §1.9). */
export const SCORING_METHODOLOGY_VERSION = '2026-09-02.1'
