/**
 * E14a — endpoint liveness detection. Probes declared endpoints and enqueues transitions.
 */

import { probeEndpoint, type LivenessResult, type ProbeOptions } from '@repo/census/probe'
import type { DbClient } from '@repo/database/client'
import { listings } from '@repo/database/schema'
import { and, inArray, isNotNull } from 'drizzle-orm'
import { enqueueTask } from './enqueue'

/** Matches `tickEndpointProbe` in `@repo/listings/lifecycle` — three in a row recovers DEGRADED. */
export const CONSECUTIVE_PROBE_SUCCESS_THRESHOLD = 3

const LISTINGS_TRANSITION_TASK = 'listings.transition'

export type ProbeEndpointFn = (url: string, options?: ProbeOptions) => Promise<LivenessResult>

export interface EndpointLivenessDeps {
  db: DbClient
  probe?: ProbeEndpointFn
}

export interface EndpointLivenessListing {
  id: string
  status: 'LIVE' | 'DEGRADED'
  declaredEndpoint: string
  endpointProbeSuccessCount: number
}

interface ListingProbeState {
  consecutiveSuccesses: number
  deathEventCheckedAt: string | null
  recoveryStartedAt: string | null
  recoveryEnqueued: boolean
}

export interface EndpointCheckResult {
  listingId: string
  live: boolean
  enqueuedDegraded: boolean
  enqueuedLive: boolean
}

export interface EndpointLivenessState {
  byListingId: Map<string, ListingProbeState>
}

export function createEndpointLivenessState(): EndpointLivenessState {
  return { byListingId: new Map() }
}

function getProbeState(state: EndpointLivenessState, listing: EndpointLivenessListing): ListingProbeState {
  const existing = state.byListingId.get(listing.id)
  if (existing) return existing

  const initial: ListingProbeState = {
    consecutiveSuccesses: listing.endpointProbeSuccessCount,
    deathEventCheckedAt: null,
    recoveryStartedAt: null,
    recoveryEnqueued: false,
  }
  state.byListingId.set(listing.id, initial)
  return initial
}

/** Loads LIVE and DEGRADED listings that declare a probe target. */
export async function loadMonitoredListings(db: DbClient): Promise<EndpointLivenessListing[]> {
  const rows = await db
    .select({
      id: listings.id,
      status: listings.status,
      declaredEndpoint: listings.declaredEndpoint,
      endpointProbeSuccessCount: listings.endpointProbeSuccessCount,
    })
    .from(listings)
    .where(
      and(
        inArray(listings.status, ['LIVE', 'DEGRADED']),
        isNotNull(listings.declaredEndpoint),
      ),
    )

  return rows.map((row) => ({
    id: row.id,
    status: row.status as 'LIVE' | 'DEGRADED',
    declaredEndpoint: row.declaredEndpoint as string,
    endpointProbeSuccessCount: row.endpointProbeSuccessCount,
  }))
}

/** Probes one listing and enqueues at most one transition task per death or recovery event. */
export async function checkListingEndpoint(
  deps: EndpointLivenessDeps,
  state: EndpointLivenessState,
  listing: EndpointLivenessListing,
): Promise<EndpointCheckResult> {
  const probe = deps.probe ?? probeEndpoint
  const probeState = getProbeState(state, listing)
  const result = await probe(listing.declaredEndpoint)
  const checkedAt = result.checkedAt

  let enqueuedDegraded = false
  let enqueuedLive = false

  if (listing.status === 'LIVE') {
    if (result.live) {
      probeState.deathEventCheckedAt = null
    } else if (probeState.deathEventCheckedAt === null) {
      probeState.deathEventCheckedAt = checkedAt
      enqueuedDegraded = await enqueueTask(deps.db, {
        taskName: LISTINGS_TRANSITION_TASK,
        idempotencyKey: `endpoint-death:${listing.id}:${checkedAt}`,
        payload: { listingId: listing.id, action: 'markDegraded' },
      })
    } else {
      enqueuedDegraded = await enqueueTask(deps.db, {
        taskName: LISTINGS_TRANSITION_TASK,
        idempotencyKey: `endpoint-death:${listing.id}:${probeState.deathEventCheckedAt}`,
        payload: { listingId: listing.id, action: 'markDegraded' },
      })
    }
    return { listingId: listing.id, live: result.live, enqueuedDegraded, enqueuedLive }
  }

  // DEGRADED — track consecutive successes; jobs applies markLive once threshold is met.
  if (!result.live) {
    probeState.consecutiveSuccesses = 0
    probeState.recoveryStartedAt = null
    probeState.recoveryEnqueued = false
    return { listingId: listing.id, live: false, enqueuedDegraded, enqueuedLive }
  }

  probeState.consecutiveSuccesses += 1
  if (probeState.recoveryStartedAt === null) {
    probeState.recoveryStartedAt = checkedAt
  }

  if (
    probeState.consecutiveSuccesses >= CONSECUTIVE_PROBE_SUCCESS_THRESHOLD &&
    !probeState.recoveryEnqueued
  ) {
    enqueuedLive = await enqueueTask(deps.db, {
      taskName: LISTINGS_TRANSITION_TASK,
      idempotencyKey: `endpoint-recovery:${listing.id}:${probeState.recoveryStartedAt}`,
      payload: { listingId: listing.id, action: 'markLive' },
    })
    probeState.recoveryEnqueued = true
  }

  return { listingId: listing.id, live: true, enqueuedDegraded, enqueuedLive }
}

/** Runs one endpoint-liveness pass over all monitored listings. */
export async function runEndpointLivenessCheck(
  deps: EndpointLivenessDeps,
  state: EndpointLivenessState,
): Promise<EndpointCheckResult[]> {
  const monitored = await loadMonitoredListings(deps.db)
  const results: EndpointCheckResult[] = []
  for (const listing of monitored) {
    results.push(await checkListingEndpoint(deps, state, listing))
  }
  return results
}
