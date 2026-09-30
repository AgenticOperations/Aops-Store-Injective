import type { TrustTier } from '@repo/domain/types'
import type { DiscoveryQuery } from '../public/schema'
import type { DiscoveryCandidate } from '../public/types'

const TRUST_RANK: Record<TrustTier, number> = { Low: 0, Medium: 1, High: 2 }

export type FilterInput = Partial<Pick<DiscoveryQuery, 'category' | 'capability_requirements'>> & {
  category: DiscoveryQuery['category'] | NonNullable<DiscoveryQuery['category']>
  minTrustTier?: TrustTier
  capabilityRequirements?: string[]
}

/**
 * The single deterministic filter both the chat box and the plain category grid call. Never
 * ranks (that's E9) — only narrows candidates, same as E8's executor (discovery-engine-ryuk.md §4).
 * Only LIVE listings are hireable; DISCOVERED (unclaimed) listings surface on the separate
 * `/unclaimed` directory, never here.
 */
export function filterCandidates(
  candidates: DiscoveryCandidate[],
  query: FilterInput,
): DiscoveryCandidate[] {
  return candidates.filter((candidate) => {
    if (candidate.status !== 'LIVE') return false
    if (candidate.category !== query.category) return false
    if (query.minTrustTier && TRUST_RANK[candidate.trustTier] < TRUST_RANK[query.minTrustTier]) {
      return false
    }
    if (query.capabilityRequirements?.length) {
      const hasAll = query.capabilityRequirements.every((req) =>
        candidate.capabilities.some((cap) => cap.toLowerCase().includes(req.toLowerCase())),
      )
      if (!hasAll) return false
    }
    return true
  })
}
