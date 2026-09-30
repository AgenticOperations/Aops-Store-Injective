/**
 * RING 0 · PURE — no I/O, imports nothing
 * `@repo/scoring/weight` — public contract. Named exports only.
 *
 * weight() / score() / confidence() / sybil-independence math. Versioned: every result carries the methodology version that produced it.
 */

import type { EvidenceLevel } from '@repo/domain/types'
import { independenceConfidence } from './independence'

// -------------------------------------------------------------------------------------------
// source_rank — `architecture/01` §1.9: "0.1 self-attest -> 1.0 marketplace-benchmark", which
// are `01`'s own L0/L6 endpoints (`architecture/01` §1.5's evidence source table). The doc
// states only the two endpoints; intermediate levels are linearly interpolated pending a
// documented curve (no finer-grained spec exists to invent from).
// -------------------------------------------------------------------------------------------

const SOURCE_RANK_MIN = 0.1 // L0 — self-declared agentURI capability
const SOURCE_RANK_MAX = 1.0 // L6 — marketplace-run controlled benchmark

export function sourceRank(evidenceLevel: EvidenceLevel): number {
  return SOURCE_RANK_MIN + evidenceLevel * ((SOURCE_RANK_MAX - SOURCE_RANK_MIN) / 6)
}

// -------------------------------------------------------------------------------------------
// recency_decay — `architecture/01` §1.9: "per-category half-life". The half-life value itself
// is a per-category tuning input the caller supplies (not hardcoded here — `01` §11 flags
// exact threshold numbers as deferred-to-implementation, category by category, not a single
// constant this package should assume).
// -------------------------------------------------------------------------------------------

export function recencyDecay(params: { createdAt: Date; now: Date; halfLifeDays: number }): number {
  const ageDays = (params.now.getTime() - params.createdAt.getTime()) / 86_400_000
  if (ageDays <= 0) return 1
  return 0.5 ** (ageDays / params.halfLifeDays)
}

// -------------------------------------------------------------------------------------------
// economic_relationship_tier — `architecture/01` §1.9's "NO_INTERACTION..VALIDATOR ladder",
// confirmed by `architecture/05` §5.4: a reviewer wallet moves NO_INTERACTION -> COMPLETED_JOB
// on its first Settlement Review against an agent, -> REPEATED_CUSTOMER on a second engagement.
// VALIDATOR is the named ceiling (01 §1.9) — an independent, non-buyer verifier (e.g. an AACP
// Evaluator). Concrete multipliers are an open tuning value (`01` §11's "deferred to
// implementation, not unresolved design" standard) — defaults below, easy to retune later.
// -------------------------------------------------------------------------------------------

export type EconomicRelationshipTier =
  | 'NO_INTERACTION'
  | 'COMPLETED_JOB'
  | 'REPEATED_CUSTOMER'
  | 'VALIDATOR'

export const ECONOMIC_RELATIONSHIP_TIER_MULTIPLIER: Readonly<
  Record<EconomicRelationshipTier, number>
> = {
  NO_INTERACTION: 1.0,
  COMPLETED_JOB: 1.15,
  REPEATED_CUSTOMER: 1.3,
  VALIDATOR: 1.5,
}

export function economicRelationshipTier(tier: EconomicRelationshipTier): number {
  return ECONOMIC_RELATIONSHIP_TIER_MULTIPLIER[tier]
}

// -------------------------------------------------------------------------------------------
// version_continuity — `architecture/01` §1.1, §1.9: "1.0 normally; fades up from a lower
// floor for pre-change evidence in the window right after a detected version_hash change —
// never drops to 0, since history isn't erased." Exact curve shape/window is named an open
// tuning value, "deferred to implementation, not unresolved design" (`final-review-docs/01`
// §11) — linear fade from floor back to 1.0 over the window below.
// -------------------------------------------------------------------------------------------

export const VERSION_CONTINUITY_FLOOR = 0.5
export const VERSION_CONTINUITY_WINDOW_DAYS = 14

export function versionContinuity(params: {
  /** When the Evidence row this factor applies to was created. */
  evidenceCreatedAt: Date
  /** When a version_hash change was detected for this (agent_id, category); `null` if none. */
  versionChangedAt: Date | null
  now: Date
  windowDays?: number
  floor?: number
}): number {
  const { evidenceCreatedAt, versionChangedAt, now } = params
  // Only pre-change evidence is discounted — evidence created after the detected change is the
  // new version's own (unproven-but-not-discounted-by-this-factor) track record.
  if (versionChangedAt === null || evidenceCreatedAt >= versionChangedAt) return 1
  const windowDays = params.windowDays ?? VERSION_CONTINUITY_WINDOW_DAYS
  const floor = params.floor ?? VERSION_CONTINUITY_FLOOR
  const daysSinceChange = (now.getTime() - versionChangedAt.getTime()) / 86_400_000
  if (daysSinceChange <= 0) return floor
  if (daysSinceChange >= windowDays) return 1
  return floor + (1 - floor) * (daysSinceChange / windowDays)
}

// -------------------------------------------------------------------------------------------
// weight(e) — `architecture/01` §1.9, verbatim formula.
// -------------------------------------------------------------------------------------------

export interface WeightInput {
  evidenceLevel: EvidenceLevel
  /** 0–1; see `independence.ts`. Pass {@link DEFAULT_SUSPICION_SCORE} until `02` ships. */
  suspicionScore: number
  createdAt: Date
  now: Date
  halfLifeDays: number
  economicRelationshipTier: EconomicRelationshipTier
  versionChangedAt: Date | null
}

export function weight(input: WeightInput): number {
  return (
    sourceRank(input.evidenceLevel) *
    independenceConfidence(input.suspicionScore) *
    recencyDecay({ createdAt: input.createdAt, now: input.now, halfLifeDays: input.halfLifeDays }) *
    economicRelationshipTier(input.economicRelationshipTier) *
    versionContinuity({
      evidenceCreatedAt: input.createdAt,
      versionChangedAt: input.versionChangedAt,
      now: input.now,
    })
  )
}
