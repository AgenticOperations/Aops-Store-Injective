/**
 * RING 2 · OWNED STATE — our database
 * `@repo/discovery/types` — public contract. Named exports only.
 */

import type { ListingStatus } from '@repo/domain/entities'
import type { Category, TrustTier } from '@repo/domain/types'

/** Minimal listing projection for E8 filter and E9 rank — domain categories, never fixture hyphenation. */
export type DiscoveryCandidate = {
  id: string
  category: Category
  status: ListingStatus
  trustTier: TrustTier
  capabilities: string[]
  /** Normalized trust score 0–100, or null when no evidence exists yet. */
  score: number | null
  /** 0–1 confidence from E6, or null when no evidence exists yet. */
  confidence: number | null
  /** Owner-declared fee in basis points — used for relative price_value within a category set. */
  feeBps: number
  /** Normalized 0–1 availability signal (sync health / uptime). */
  availability: number
}

export type RankFactor =
  | 'capability_match'
  | 'risk_fit'
  | 'trust_evidence_strength'
  | 'outcome_quality'
  | 'price_value'
  | 'availability'

export type RankWeights = Record<RankFactor, number>

export type RankFactorBreakdown = Record<RankFactor, number>

export type RankedCandidate = {
  candidate: DiscoveryCandidate
  weightedScore: number
  factors: RankFactorBreakdown
  /** Per-factor weighted contribution — the only inputs `explain` may use. */
  breakdown: RankFactorBreakdown
}

export const DISCOVERY_METHODOLOGY_VERSION = 'e9-v1' as const
