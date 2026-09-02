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

export async function getListing(id: string): Promise<ApiListingDetail | null> {
  const res = await fetch(`${API_BASE}/v1/agents/${id}`, { next: { revalidate: 10 } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`get listing failed: ${res.status}`)
  return (await res.json()) as ApiListingDetail
}

export async function searchListings(category = 'rebalancing'): Promise<ApiListingDetail[]> {
  const res = await fetch(`${API_BASE}/v1/search?category=${category}`, { next: { revalidate: 10 } })
  if (!res.ok) return []
  const body = (await res.json()) as { results: Array<{ id: string }> }
  const details = await Promise.all(body.results.map((r) => getListing(r.id)))
  return details.filter((d): d is ApiListingDetail => d !== null)
}
