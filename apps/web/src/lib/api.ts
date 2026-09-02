import type { DiscoveryCandidate } from '@repo/discovery/query'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export type ApiListingSummary = {
  id: string
  agentId: string
  category: string
  status: string
  trustTier: string | null
  ownerWallet: string
  declaredEndpoint: string | null
  score: number | null
  confidence: number | null
  sampleSize: number
  activeHires: number
  feeBps?: number
}

export type ApiListingDetail = {
  id: string
  agentId: string
  category: string
  status: string
  trustTier: string | null
  ownerWallet: string
  declaredEndpoint: string | null
  score: number | null
  confidence: number | null
  sampleSize: number
  evidence: Array<{
    evidenceId: string
    proofType: string
    evidenceLevel: number
    actionType: string
    source: string
    createdAt: string
  }>
}

export type ApiJob = {
  jobId: string
  authorizationId: string
  listingId: string
  providerAgentId: string
  executionStatus: string
  settlementStatus: string
  rail: string
  createdAt: string
  feeBps: number | null
  feeChargedAmount: string | null
  measuredPerformanceFee: string | null
}

const DOMAIN_CATEGORIES = [
  'rebalancing',
  'grid_trading',
  'yield_optimization',
  'health_factor_monitoring',
] as const

export function hyphenCategoryToDomain(category: string): string {
  return category.replace(/-/g, '_')
}

export function domainCategoryToHyphen(category: string): string {
  return category.replace(/_/g, '-')
}

export async function searchListings(category: string): Promise<{
  results: Array<Omit<ApiListingSummary, 'agentId' | 'status' | 'ownerWallet' | 'declaredEndpoint' | 'sampleSize' | 'activeHires'> & { weightedScore: number }>
  methodologyVersion: string
}> {
  try {
    const domainCategory = hyphenCategoryToDomain(category)
    const res = await fetch(`${API_BASE}/v1/search?category=${encodeURIComponent(domainCategory)}`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) throw new Error(`search failed: ${res.status}`)
    return res.json()
  } catch {
    return { results: [], methodologyVersion: 'unavailable' }
  }
}

export async function listListings(opts?: {
  status?: string
  category?: string
}): Promise<ApiListingSummary[]> {
  try {
    const params = new URLSearchParams()
    if (opts?.status) params.set('status', opts.status)
    if (opts?.category) params.set('category', hyphenCategoryToDomain(opts.category))
    const qs = params.toString()
    const res = await fetch(`${API_BASE}/v1/listings${qs ? `?${qs}` : ''}`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) return []
    const body = (await res.json()) as { listings: ApiListingSummary[] }
    return body.listings
  } catch {
    return []
  }
}

export async function getListing(id: string): Promise<ApiListingDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/agents/${id}`, { next: { revalidate: 30 } })
    if (res.status === 404) return null
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function getJob(jobId: string): Promise<ApiJob | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/jobs/${jobId}`, { next: { revalidate: 10 } })
    if (res.status === 404) return null
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function fetchCategoryListingViews(category: string) {
  const { results } = await searchListings(category)
  const details = await Promise.all(results.map((r) => getListing(r.id)))
  const { apiToListingView } = await import('./listing-view')
  return details
    .filter((d): d is ApiListingDetail => d !== null)
    .map((d) => apiToListingView(d))
}

export async function loadLiveDiscoveryCandidates(): Promise<DiscoveryCandidate[]> {
  const live = await listListings({ status: 'LIVE,DEGRADED' })
  return live.map(
    (row): DiscoveryCandidate => ({
      id: row.id,
      category: row.category as DiscoveryCandidate['category'],
      status: row.status as DiscoveryCandidate['status'],
      trustTier: (row.trustTier ?? 'Low') as DiscoveryCandidate['trustTier'],
      capabilities: [],
      score: row.score,
      confidence: row.confidence,
      feeBps: row.feeBps ?? 300,
      availability: row.status === 'LIVE' ? 1 : 0.3,
    }),
  )
}

export async function fetchMarketStats() {
  const all = await listListings({ status: 'LIVE,DEGRADED' })
  const live = all.filter((l) => l.status === 'LIVE')
  const evidenceRows = all.reduce((n, l) => n + l.sampleSize, 0)
  return { liveCount: live.length, evidenceRows }
}

export { DOMAIN_CATEGORIES }
