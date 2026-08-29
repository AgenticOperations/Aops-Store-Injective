// apps/web/src/lib/discovery/filter.ts
import type { Listing, TrustTier } from '../../fixtures/listings'
import type { DiscoveryQuery } from './schema'

const TRUST_RANK: Record<TrustTier, number> = { Low: 0, Medium: 1, High: 2 }

export type FilterInput = Partial<
  Pick<DiscoveryQuery, 'category' | 'capability_requirements'>
> & {
  category: DiscoveryQuery['category'] | NonNullable<DiscoveryQuery['category']>
  minTrustTier?: TrustTier
  capabilityRequirements?: string[]
}

/**
 * The single deterministic filter both the chat box and the plain category grid call. Never
 * ranks (that's E9, out of scope here) — only narrows LISTINGS to a candidate set, same as
 * E8's executor (discovery-engine-ryuk.md §4). Only LIVE listings are hireable; DISCOVERED
 * (unclaimed) listings surface on the separate `/unclaimed` directory, never here.
 */
export function filterListings(listings: Listing[], query: FilterInput): Listing[] {
  return listings.filter((listing) => {
    if (listing.status !== 'LIVE') return false
    if (listing.category !== query.category) return false
    if (query.minTrustTier && TRUST_RANK[listing.trustTier] < TRUST_RANK[query.minTrustTier]) {
      return false
    }
    if (query.capabilityRequirements?.length) {
      const hasAll = query.capabilityRequirements.every((req) =>
        listing.capabilities.some((cap) => cap.toLowerCase().includes(req.toLowerCase())),
      )
      if (!hasAll) return false
    }
    return true
  })
}
