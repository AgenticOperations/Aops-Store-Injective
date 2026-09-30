/**
 * E14a — execute listing lifecycle transitions enqueued by `apps/watch`.
 */

import {
  type ListingLifecycleDeps,
  markDegraded,
  markLive,
  revoke,
  suspend,
  tickEndpointProbe,
} from '@repo/listings/lifecycle'

export type ListingsTransitionAction =
  | 'markDegraded'
  | 'markLive'
  | 'suspend'
  | 'revoke'
  | 'tickEndpointProbe'

export interface ListingsTransitionPayload {
  listingId: string
  action: ListingsTransitionAction
}

export async function runListingsTransition(
  deps: ListingLifecycleDeps,
  payload: ListingsTransitionPayload,
) {
  switch (payload.action) {
    case 'markDegraded':
      return markDegraded(deps, { listingId: payload.listingId })
    case 'markLive':
      return markLive(deps, { listingId: payload.listingId })
    case 'suspend':
      return suspend(deps, { listingId: payload.listingId })
    case 'revoke':
      return revoke(deps, { listingId: payload.listingId })
    case 'tickEndpointProbe':
      return tickEndpointProbe(deps, { listingId: payload.listingId })
    default:
      throw new Error(`unsupported listings.transition action: ${String(payload.action)}`)
  }
}
