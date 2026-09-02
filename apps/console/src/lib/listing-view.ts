import type { ApiListingDetail } from './api'

import type { ListingStatus } from '../fixtures/listings'

export type OwnedListingView = {
  id: string
  name: string
  category: string
  status: ListingStatus
  trustTier: string
  ownerAddress: string
  declaredEndpoint: string | null
  commercialConfig: {
    maxPositionSizeUsd: number
    maxDailyTxCount: number
    maxSlippageBps: number
    autoPauseDrawdownPct: number
    feeBps: number
  }
}

export function apiToOwnedListing(api: ApiListingDetail): OwnedListingView {
  return {
    id: api.id,
    name: api.agentId,
    category: api.category.replace(/_/g, '-'),
    status: api.status as ListingStatus,
    trustTier: api.trustTier ?? 'Low',
    ownerAddress: api.ownerWallet,
    declaredEndpoint: api.declaredEndpoint,
    commercialConfig: {
      maxPositionSizeUsd: 10_000,
      maxDailyTxCount: 50,
      maxSlippageBps: 50,
      autoPauseDrawdownPct: 10,
      feeBps: 300,
    },
  }
}

export async function fetchOwnedListing(id: string): Promise<OwnedListingView | null> {
  const { getListing } = await import('./api')
  const api = await getListing(id)
  if (!api) return null
  return apiToOwnedListing(api)
}
