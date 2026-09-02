/**
 * RING 2 · OWNED STATE — our database
 * `@repo/listings/lifecycle` — public contract. Named exports only.
 *
 * Listing lifecycle orchestration. Calls `domain/` guards; holds no guard logic of its own.
 */

import type { RegistryResult } from '@repo/agent-registry/registry'
import type { LivenessResult, ProbeOptions } from '@repo/census/probe'
import type { DbClient } from '@repo/database/client'
import { listings } from '@repo/database/schema'
import type { ListingStatus } from '@repo/domain/entities'
import { type ClaimSignatureParams, verifyClaimSignature } from '@repo/domain/guards'
import {
  INITIAL_TRUST_TIER_ON_LIVE,
  LISTING_TRANSITIONS,
  transition,
} from '@repo/domain/state-machines'
import type { TrustTier, WalletAddress } from '@repo/domain/types'
import { eq } from 'drizzle-orm'
import type { Address, Hex, PublicClient } from 'viem'

// ---------------------------------------------------------------------------------------------
// Dependency injection — `getAgentOwner` and `probeEndpoint` are caller-supplied so tests never
// hit the real network and production callers wire the real Ring 1 implementations.
// ---------------------------------------------------------------------------------------------

export type GetAgentOwnerFn = (params: {
  client: PublicClient
  tokenId: bigint
  chainId?: number
}) => Promise<RegistryResult<Address>>

export type ProbeEndpointFn = (url: string, options?: ProbeOptions) => Promise<LivenessResult>

export interface ListingLifecycleDeps {
  db: DbClient
  getAgentOwner: GetAgentOwnerFn
  probeEndpoint: ProbeEndpointFn
}

/** Three consecutive successful probes gate flaky-transient recovery and the claim-time
 * `OWNERSHIP_VERIFIED → ENDPOINT_VERIFIED` step (`architecture/01` §1.2). */
export const CONSECUTIVE_PROBE_SUCCESS_THRESHOLD = 3

// ---------------------------------------------------------------------------------------------
// Result shape — every transition returns data or a typed error, never a thrown vendor failure.
// ---------------------------------------------------------------------------------------------

export interface LifecycleError {
  code:
    | 'NOT_FOUND'
    | 'INVALID_STATE'
    | 'OWNERSHIP_VERIFICATION_FAILED'
    | 'REGISTRY_ERROR'
    | 'MISSING_ENDPOINT'
    | 'MISSING_ERC8004_REF'
    | 'ENDPOINT_PROBE_PENDING'
  message: string
}

export type LifecycleResult<T> = { ok: true; data: T } | { ok: false; error: LifecycleError }

export interface ListingLifecycleRow {
  id: string
  agentId: string
  status: ListingStatus
  trustTier: TrustTier | null
  ownerWallet: WalletAddress
  declaredEndpoint: string | null
  endpointProbeSuccessCount: number
  erc8004ChainId: number | null
  erc8004TokenId: string | null
}

export type ClaimSignatureInput = Omit<ClaimSignatureParams, 'onChainOwner'>

// ---------------------------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------------------------

async function loadListing(
  deps: ListingLifecycleDeps,
  listingId: string,
): Promise<LifecycleResult<ListingLifecycleRow>> {
  const rows = await deps.db
    .select({
      id: listings.id,
      agentId: listings.agentId,
      status: listings.status,
      trustTier: listings.trustTier,
      ownerWallet: listings.ownerWallet,
      declaredEndpoint: listings.declaredEndpoint,
      endpointProbeSuccessCount: listings.endpointProbeSuccessCount,
      erc8004ChainId: listings.erc8004ChainId,
      erc8004TokenId: listings.erc8004TokenId,
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1)

  const row = rows[0]
  if (!row) {
    return { ok: false, error: { code: 'NOT_FOUND', message: `listing ${listingId} not found` } }
  }

  return {
    ok: true,
    data: {
      ...row,
      ownerWallet: row.ownerWallet as WalletAddress,
    },
  }
}

async function persistListingTransition(
  deps: ListingLifecycleDeps,
  listingId: string,
  from: ListingStatus,
  to: ListingStatus,
  patch: {
    trustTier?: TrustTier | null
    declaredEndpoint?: string | null
    endpointProbeSuccessCount?: number
    ownerWallet?: WalletAddress
  } = {},
): Promise<LifecycleResult<ListingLifecycleRow>> {
  const loaded = await loadListing(deps, listingId)
  if (!loaded.ok) return loaded

  if (loaded.data.status !== from) {
    return {
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message: `expected status ${from}, found ${loaded.data.status}`,
      },
    }
  }

  let nextStatus: ListingStatus
  try {
    nextStatus = transition(LISTING_TRANSITIONS, from, to)
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message: err instanceof Error ? err.message : `invalid transition ${from} -> ${to}`,
      },
    }
  }

  const updated = await deps.db
    .update(listings)
    .set({
      status: nextStatus,
      ...(patch.trustTier !== undefined ? { trustTier: patch.trustTier } : {}),
      ...(patch.declaredEndpoint !== undefined ? { declaredEndpoint: patch.declaredEndpoint } : {}),
      ...(patch.endpointProbeSuccessCount !== undefined
        ? { endpointProbeSuccessCount: patch.endpointProbeSuccessCount }
        : {}),
      ...(patch.ownerWallet !== undefined ? { ownerWallet: patch.ownerWallet } : {}),
    })
    .where(eq(listings.id, listingId))
    .returning({
      id: listings.id,
      agentId: listings.agentId,
      status: listings.status,
      trustTier: listings.trustTier,
      ownerWallet: listings.ownerWallet,
      declaredEndpoint: listings.declaredEndpoint,
      endpointProbeSuccessCount: listings.endpointProbeSuccessCount,
      erc8004ChainId: listings.erc8004ChainId,
      erc8004TokenId: listings.erc8004TokenId,
    })

  const row = updated[0]
  if (!row) {
    return { ok: false, error: { code: 'NOT_FOUND', message: `listing ${listingId} not found` } }
  }

  return {
    ok: true,
    data: {
      ...row,
      ownerWallet: row.ownerWallet as WalletAddress,
    },
  }
}

async function persistProbeCount(
  deps: ListingLifecycleDeps,
  listingId: string,
  endpointProbeSuccessCount: number,
): Promise<LifecycleResult<ListingLifecycleRow>> {
  const updated = await deps.db
    .update(listings)
    .set({ endpointProbeSuccessCount })
    .where(eq(listings.id, listingId))
    .returning({
      id: listings.id,
      agentId: listings.agentId,
      status: listings.status,
      trustTier: listings.trustTier,
      ownerWallet: listings.ownerWallet,
      declaredEndpoint: listings.declaredEndpoint,
      endpointProbeSuccessCount: listings.endpointProbeSuccessCount,
      erc8004ChainId: listings.erc8004ChainId,
      erc8004TokenId: listings.erc8004TokenId,
    })

  const row = updated[0]
  if (!row) {
    return { ok: false, error: { code: 'NOT_FOUND', message: `listing ${listingId} not found` } }
  }

  return {
    ok: true,
    data: {
      ...row,
      ownerWallet: row.ownerWallet as WalletAddress,
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Claim ladder — `final-review-docs/01` §4.1–4.4
// ---------------------------------------------------------------------------------------------

export async function claimListing(
  deps: ListingLifecycleDeps,
  params: {
    listingId: string
    ownerWallet: WalletAddress
    declaredEndpoint: string
  },
): Promise<LifecycleResult<ListingLifecycleRow>> {
  return persistListingTransition(deps, params.listingId, 'DISCOVERED', 'CLAIMED', {
    ownerWallet: params.ownerWallet,
    declaredEndpoint: params.declaredEndpoint,
    endpointProbeSuccessCount: 0,
  })
}

export async function verifyOwnership(
  deps: ListingLifecycleDeps,
  params: {
    listingId: string
    client: PublicClient
    claimSignature: ClaimSignatureInput
  },
): Promise<LifecycleResult<ListingLifecycleRow>> {
  const loaded = await loadListing(deps, params.listingId)
  if (!loaded.ok) return loaded

  if (loaded.data.status !== 'CLAIMED') {
    return {
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message: `verifyOwnership requires CLAIMED, found ${loaded.data.status}`,
      },
    }
  }

  if (loaded.data.erc8004TokenId === null) {
    return {
      ok: false,
      error: {
        code: 'MISSING_ERC8004_REF',
        message: 'listing has no erc8004 token id for on-chain owner lookup',
      },
    }
  }

  const ownerResult = await deps.getAgentOwner({
    client: params.client,
    tokenId: BigInt(loaded.data.erc8004TokenId),
    ...(loaded.data.erc8004ChainId !== null ? { chainId: loaded.data.erc8004ChainId } : {}),
  })

  if (!ownerResult.ok) {
    return {
      ok: false,
      error: {
        code: 'REGISTRY_ERROR',
        message: ownerResult.error.message,
      },
    }
  }

  const signatureValid = await verifyClaimSignature({
    ...params.claimSignature,
    onChainOwner: ownerResult.data,
  })

  if (!signatureValid) {
    return {
      ok: false,
      error: {
        code: 'OWNERSHIP_VERIFICATION_FAILED',
        message: 'EIP-712 signature does not match the on-chain owner of record',
      },
    }
  }

  return persistListingTransition(deps, params.listingId, 'CLAIMED', 'OWNERSHIP_VERIFIED', {
    ownerWallet: ownerResult.data as WalletAddress,
    endpointProbeSuccessCount: 0,
  })
}

export async function tickEndpointProbe(
  deps: ListingLifecycleDeps,
  params: { listingId: string },
): Promise<LifecycleResult<ListingLifecycleRow>> {
  const loaded = await loadListing(deps, params.listingId)
  if (!loaded.ok) return loaded

  const { status, declaredEndpoint } = loaded.data

  if (status !== 'OWNERSHIP_VERIFIED' && status !== 'LIVE' && status !== 'DEGRADED') {
    return {
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message: `tickEndpointProbe does not apply to status ${status}`,
      },
    }
  }

  if (!declaredEndpoint) {
    return {
      ok: false,
      error: {
        code: 'MISSING_ENDPOINT',
        message: 'listing has no declared endpoint to probe',
      },
    }
  }

  const probe = await deps.probeEndpoint(declaredEndpoint)

  if (!probe.live) {
    const reset = await persistProbeCount(deps, params.listingId, 0)
    if (!reset.ok) return reset

    if (status === 'LIVE') {
      return markDegraded(deps, { listingId: params.listingId })
    }

    return reset
  }

  const nextCount = Math.min(
    loaded.data.endpointProbeSuccessCount + 1,
    CONSECUTIVE_PROBE_SUCCESS_THRESHOLD,
  )
  const counted = await persistProbeCount(deps, params.listingId, nextCount)
  if (!counted.ok) return counted

  if (status === 'OWNERSHIP_VERIFIED' && nextCount >= CONSECUTIVE_PROBE_SUCCESS_THRESHOLD) {
    return persistListingTransition(
      deps,
      params.listingId,
      'OWNERSHIP_VERIFIED',
      'ENDPOINT_VERIFIED',
      { endpointProbeSuccessCount: nextCount },
    )
  }

  if (status === 'DEGRADED' && nextCount >= CONSECUTIVE_PROBE_SUCCESS_THRESHOLD) {
    return markLive(deps, { listingId: params.listingId })
  }

  if (status === 'OWNERSHIP_VERIFIED' || status === 'DEGRADED') {
    return {
      ok: false,
      error: {
        code: 'ENDPOINT_PROBE_PENDING',
        message: `${nextCount}/${CONSECUTIVE_PROBE_SUCCESS_THRESHOLD} consecutive live probes`,
      },
    }
  }

  return counted
}

export async function promoteToLive(
  deps: ListingLifecycleDeps,
  params: { listingId: string },
): Promise<LifecycleResult<ListingLifecycleRow>> {
  return persistListingTransition(deps, params.listingId, 'ENDPOINT_VERIFIED', 'LIVE', {
    trustTier: INITIAL_TRUST_TIER_ON_LIVE,
  })
}

// ---------------------------------------------------------------------------------------------
// Post-LIVE transitions — `final-review-docs/01` §10
// ---------------------------------------------------------------------------------------------

export async function markDegraded(
  deps: ListingLifecycleDeps,
  params: { listingId: string },
): Promise<LifecycleResult<ListingLifecycleRow>> {
  return persistListingTransition(deps, params.listingId, 'LIVE', 'DEGRADED', {
    endpointProbeSuccessCount: 0,
  })
}

export async function markLive(
  deps: ListingLifecycleDeps,
  params: { listingId: string },
): Promise<LifecycleResult<ListingLifecycleRow>> {
  const loaded = await loadListing(deps, params.listingId)
  if (!loaded.ok) return loaded

  const trustTier = loaded.data.trustTier ?? INITIAL_TRUST_TIER_ON_LIVE

  return persistListingTransition(deps, params.listingId, 'DEGRADED', 'LIVE', {
    trustTier,
    endpointProbeSuccessCount: CONSECUTIVE_PROBE_SUCCESS_THRESHOLD,
  })
}

export async function suspend(
  deps: ListingLifecycleDeps,
  params: { listingId: string },
): Promise<LifecycleResult<ListingLifecycleRow>> {
  const loaded = await loadListing(deps, params.listingId)
  if (!loaded.ok) return loaded

  const from = loaded.data.status
  if (!LISTING_TRANSITIONS[from].includes('SUSPENDED')) {
    return {
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message: `cannot suspend listing in status ${from}`,
      },
    }
  }

  return persistListingTransition(deps, params.listingId, from, 'SUSPENDED')
}

export async function revoke(
  deps: ListingLifecycleDeps,
  params: { listingId: string },
): Promise<LifecycleResult<ListingLifecycleRow>> {
  const loaded = await loadListing(deps, params.listingId)
  if (!loaded.ok) return loaded

  const from = loaded.data.status
  if (!LISTING_TRANSITIONS[from].includes('REVOKED')) {
    return {
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message: `cannot revoke listing in status ${from}`,
      },
    }
  }

  return persistListingTransition(deps, params.listingId, from, 'REVOKED')
}

// ---------------------------------------------------------------------------------------------
// Self-registration — DISCOVERED → LIVE end-to-end for the console claim page (Chunk 5d wiring).
// ---------------------------------------------------------------------------------------------

export async function selfRegister(
  deps: ListingLifecycleDeps,
  params: {
    listingId: string
    ownerWallet: WalletAddress
    declaredEndpoint: string
    client: PublicClient
    claimSignature: ClaimSignatureInput
  },
): Promise<LifecycleResult<ListingLifecycleRow>> {
  const claimed = await claimListing(deps, {
    listingId: params.listingId,
    ownerWallet: params.ownerWallet,
    declaredEndpoint: params.declaredEndpoint,
  })
  if (!claimed.ok) return claimed

  const verified = await verifyOwnership(deps, {
    listingId: params.listingId,
    client: params.client,
    claimSignature: params.claimSignature,
  })
  if (!verified.ok) return verified

  for (let tick = 0; tick < CONSECUTIVE_PROBE_SUCCESS_THRESHOLD; tick++) {
    const probe = await tickEndpointProbe(deps, { listingId: params.listingId })
    if (!probe.ok && probe.error.code !== 'ENDPOINT_PROBE_PENDING') return probe
    if (probe.ok && probe.data.status === 'ENDPOINT_VERIFIED') break
  }

  const loaded = await loadListing(deps, params.listingId)
  if (!loaded.ok) return loaded
  if (loaded.data.status !== 'ENDPOINT_VERIFIED') {
    return {
      ok: false,
      error: {
        code: 'ENDPOINT_PROBE_PENDING',
        message: `endpoint not verified after ${CONSECUTIVE_PROBE_SUCCESS_THRESHOLD} probe ticks`,
      },
    }
  }

  return promoteToLive(deps, { listingId: params.listingId })
}
