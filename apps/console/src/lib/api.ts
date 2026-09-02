const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

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
  evidence: unknown[]
}

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
}

export async function getListing(id: string): Promise<ApiListingDetail | null> {
  const res = await fetch(`${API_BASE}/v1/agents/${id}`, { next: { revalidate: 10 } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`get listing failed: ${res.status}`)
  return (await res.json()) as ApiListingDetail
}

export async function listListings(opts?: {
  status?: string
  category?: string
}): Promise<ApiListingSummary[]> {
  const params = new URLSearchParams()
  if (opts?.status) params.set('status', opts.status)
  if (opts?.category) params.set('category', opts.category.replace(/-/g, '_'))
  const qs = params.toString()
  const res = await fetch(`${API_BASE}/v1/listings${qs ? `?${qs}` : ''}`, { next: { revalidate: 10 } })
  if (!res.ok) return []
  const body = (await res.json()) as { listings: ApiListingSummary[] }
  return body.listings
}
