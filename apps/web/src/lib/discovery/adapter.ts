/**
 * Boundary adapter between `apps/web` fixture vocabulary (hyphenated categories) and
 * `@repo/discovery`'s canonical `@repo/domain` underscored categories.
 */

import { filterCandidates } from '@repo/discovery/query'
import type { DiscoveryCandidate } from '@repo/discovery/query'
import type { Category as DomainCategory } from '@repo/domain/types'
import { FIXTURE_LISTINGS } from '../../fixtures/listings'
import type {
  Category as FixtureCategory,
  Listing as FixtureListing,
  TrustTier,
} from '../../fixtures/listings'

const HYPHEN_TO_DOMAIN: Record<FixtureCategory, DomainCategory> = {
  rebalancing: 'rebalancing',
  'grid-trading': 'grid_trading',
  'yield-optimization': 'yield_optimization',
  'health-factor-monitoring': 'health_factor_monitoring',
}

export function fixtureCategoryToDomain(category: FixtureCategory): DomainCategory {
  return HYPHEN_TO_DOMAIN[category]
}

export function fixtureToCandidate(listing: FixtureListing): DiscoveryCandidate {
  return {
    id: listing.id,
    category: HYPHEN_TO_DOMAIN[listing.category],
    status: listing.status,
    trustTier: listing.trustTier,
    capabilities: listing.capabilities,
    score: listing.score?.value ?? null,
    confidence: listing.score?.confidence ?? null,
    feeBps: listing.feeBps,
    availability: listing.syncStatus === 'LIVE' ? 1 : 0.5,
  }
}

export function allFixtureCandidates(): DiscoveryCandidate[] {
  return FIXTURE_LISTINGS.map(fixtureToCandidate)
}

export function candidatesToListings(candidates: DiscoveryCandidate[]): FixtureListing[] {
  const ids = new Set(candidates.map((c) => c.id))
  return FIXTURE_LISTINGS.filter((listing) => ids.has(listing.id))
}

export type FixtureFilterInput = {
  category: FixtureCategory
  minTrustTier?: TrustTier
  capabilityRequirements?: string[]
}

/** Filter fixture listings via `@repo/discovery`, preserving fixture shape for UI components. */
export function filterFixtureListings(
  listings: FixtureListing[],
  query: FixtureFilterInput,
): FixtureListing[] {
  const candidates = listings.map(fixtureToCandidate)
  const filtered = filterCandidates(candidates, {
    category: HYPHEN_TO_DOMAIN[query.category],
    ...(query.minTrustTier ? { minTrustTier: query.minTrustTier } : {}),
    ...(query.capabilityRequirements?.length
      ? { capabilityRequirements: query.capabilityRequirements }
      : {}),
  })
  const ids = new Set(filtered.map((c) => c.id))
  return listings.filter((listing) => ids.has(listing.id))
}
