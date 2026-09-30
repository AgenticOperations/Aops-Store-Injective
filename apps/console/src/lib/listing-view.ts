import type { ApiListingDetail, ApiListingSummary } from './api'

import type {
  Category,
  ListingStatus,
  SandboxAttempt,
  SyncStatus,
  TrustTier,
} from '../fixtures/listings'

export type OwnedListingView = {
  id: string
  name: string
  category: Category
  status: ListingStatus
  trustTier: TrustTier
  syncStatus: SyncStatus
  ownerAddress: string
  endpoint: string
  sandboxAttempts: SandboxAttempt[]
  hasIndependentAttestation: boolean
  commercialConfig: {
    maxPositionSizeUsd: number
    maxDailyTxCount: number
    maxSlippageBps: number
    autoPauseDrawdownPct: number
    feeBps: number
  }
  evidenceCount: number | null
  activeHires: number
}

function hyphenCategory(cat: string): Category {
  return cat.replace(/_/g, '-') as Category
}

function syncFromStatus(status: string): SyncStatus {
  return status === 'DEGRADED' ? 'DEGRADED' : 'LIVE'
}

export function apiToOwnedListing(api: ApiListingDetail): OwnedListingView {
  return {
    id: api.id,
    name: api.agentId,
    category: hyphenCategory(api.category),
    status: api.status as ListingStatus,
    trustTier: (api.trustTier ?? 'Low') as TrustTier,
    syncStatus: syncFromStatus(api.status),
    ownerAddress: api.ownerWallet,
    endpoint: api.declaredEndpoint ?? '',
    sandboxAttempts: [],
    hasIndependentAttestation: false,
    commercialConfig: {
      maxPositionSizeUsd: 10_000,
      maxDailyTxCount: 50,
      maxSlippageBps: 50,
      autoPauseDrawdownPct: 10,
      feeBps: 300,
    },
    evidenceCount: api.sampleSize > 0 ? api.sampleSize : null,
    activeHires: 0,
  }
}

export function summaryToOwnedListing(summary: ApiListingSummary): OwnedListingView {
  return {
    id: summary.id,
    name: summary.agentId,
    category: hyphenCategory(summary.category),
    status: summary.status as ListingStatus,
    trustTier: (summary.trustTier ?? 'Low') as TrustTier,
    syncStatus: syncFromStatus(summary.status),
    ownerAddress: summary.ownerWallet,
    endpoint: summary.declaredEndpoint ?? '',
    sandboxAttempts: [],
    hasIndependentAttestation: false,
    commercialConfig: {
      maxPositionSizeUsd: 10_000,
      maxDailyTxCount: 50,
      maxSlippageBps: 50,
      autoPauseDrawdownPct: 10,
      feeBps: 300,
    },
    evidenceCount: summary.sampleSize > 0 ? summary.sampleSize : null,
    activeHires: summary.activeHires,
  }
}

export async function fetchOwnedListing(id: string): Promise<OwnedListingView | null> {
  const { getListing } = await import('./api')
  const api = await getListing(id)
  if (!api) return null
  return apiToOwnedListing(api)
}

export async function fetchAllOwnedListings(): Promise<OwnedListingView[]> {
  const { listListings } = await import('./api')
  const rows = await listListings()
  return rows.map(summaryToOwnedListing)
}
