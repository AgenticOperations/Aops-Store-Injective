const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export type ApiListingSummary = {
  id: string
  category: string
  trustTier: string
  weightedScore: number
  score: number | null
  confidence: number | null
  feeBps: number
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
  executionStatus: string
  settlementStatus: string
  providerAgentId: string
  createdAt: string
}

export async function searchListings(category: string): Promise<{
  results: ApiListingSummary[]
  methodologyVersion: string
}> {
  const res = await fetch(`${API_BASE}/v1/search?category=${encodeURIComponent(category)}`, {
    next: { revalidate: 30 },
  })
  if (!res.ok) throw new Error(`search failed: ${res.status}`)
  return res.json()
}

export async function getListing(id: string): Promise<ApiListingDetail | null> {
  const res = await fetch(`${API_BASE}/v1/agents/${id}`, { next: { revalidate: 30 } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`get failed: ${res.status}`)
  return res.json()
}

export async function getJobFromMeJobs(jobId: string): Promise<ApiJob | null> {
  const res = await fetch(`${API_BASE}/v1/me/jobs`, { cache: 'no-store' })
  if (!res.ok) return null
  const body = (await res.json()) as { jobs: ApiJob[] }
  return body.jobs.find((j) => j.jobId === jobId) ?? null
}
