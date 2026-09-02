import type { ApiListingDetail } from './api'
import type {
  Category,
  EvidenceRow,
  Listing,
  ListingStatus,
  Score,
  TrustTier,
} from '../fixtures/listings'

function hyphenCategory(cat: string): Category {
  return cat.replace(/_/g, '-') as Category
}

export function apiToListingView(api: ApiListingDetail): Listing {
  const score: Score | null =
    api.score !== null && api.confidence !== null
      ? {
          value: api.score,
          confidence: api.confidence,
          sampleSize: api.sampleSize,
        }
      : null

  const evidence: EvidenceRow[] = api.evidence.map((row) => ({
    id: row.evidenceId,
    occurredAt: row.createdAt,
    level: `L${row.evidenceLevel}` as EvidenceRow['level'],
    proofType: row.proofType as EvidenceRow['proofType'],
    source: row.source,
    operatorObserved: row.source.includes('marketplace'),
    summary: row.actionType,
    txHash: null,
    permissionsUsed: null,
  }))

  return {
    id: api.id,
    name: api.agentId,
    category: hyphenCategory(api.category),
    status: api.status as ListingStatus,
    trustTier: (api.trustTier ?? 'Low') as TrustTier,
    syncStatus: api.status === 'DEGRADED' ? 'DEGRADED' : 'LIVE',
    provenance: 'self-registered',
    feeBps: 300,
    evidenceCount: api.sampleSize > 0 ? api.sampleSize : null,
    score,
    capabilities: [],
    summary: api.declaredEndpoint ?? 'No endpoint declared',
    strategy: null,
    kpis: null,
    declineLog: [],
    evidence,
  }
}

export async function fetchListingView(id: string): Promise<Listing | null> {
  const { getListing } = await import('./api')
  const api = await getListing(id)
  if (!api) return null
  return apiToListingView(api)
}
