/**
 * RING 0 · PURE — no I/O, imports nothing
 * `@repo/domain/guards` — public contract. Named exports only.
 *
 * Entities, state machines, transition guards, shared types. The vocabulary of the whole system.
 */

import { type Address, type Hex, type TypedDataDomain, recoverTypedDataAddress } from 'viem'
import type { AccountStatus } from './entities'
import type { TrustTier } from './types'

// ---------------------------------------------------------------------------------------------
// Claim guard — `final-review-docs/01` §4.1: EIP-712 recover vs. on-chain owner.
// This package does zero I/O — `listings` (Ring 2) reads the on-chain owner via
// `agent-registry` and passes it in; `recoverTypedDataAddress` is pure ECDSA math, not a
// network call.
// ---------------------------------------------------------------------------------------------

export interface ClaimSignatureParams {
  domain: TypedDataDomain
  types: Record<string, readonly { name: string; type: string }[]>
  primaryType: string
  message: Record<string, unknown>
  signature: Hex
  onChainOwner: Address
}

export async function verifyClaimSignature(params: ClaimSignatureParams): Promise<boolean> {
  const recovered = await recoverTypedDataAddress({
    domain: params.domain,
    types: params.types,
    primaryType: params.primaryType,
    message: params.message,
    signature: params.signature,
  })
  return recovered.toLowerCase() === params.onChainOwner.toLowerCase()
}

// ---------------------------------------------------------------------------------------------
// Standing/Fresh tier predicate — `final-review-docs/04` §9.1. Pure function of Account state
// plus whether a live bound session covers the call; no I/O here — the session-liveness check
// itself happens in `access`/`custody` and is passed in as a boolean.
// ---------------------------------------------------------------------------------------------

export type AccessTier = 'Public' | 'Standing' | 'Fresh'

const ACCESS_TIER_RANK: Readonly<Record<AccessTier, number>> = { Public: 0, Standing: 1, Fresh: 2 }

export interface AccessTierParams {
  /** `null` = not enrolled (no Account exists yet). */
  accountStatus: AccountStatus | null
  /** Is there currently a live on-chain session bound to this Account that covers this exact
   * call (`04` §7.4, §9.1)? */
  hasLiveBoundSessionCoveringCall: boolean
}

export function computeAccessTier(params: AccessTierParams): AccessTier {
  if (params.accountStatus === null || params.accountStatus === 'SUSPENDED') return 'Public'
  if (params.hasLiveBoundSessionCoveringCall) return 'Fresh'
  return 'Standing'
}

/** `actual` tier must be at least `required` — `Public < Standing < Fresh` (`04` §9.1's table). */
export function accessTierSatisfies(actual: AccessTier, required: AccessTier): boolean {
  return ACCESS_TIER_RANK[actual] >= ACCESS_TIER_RANK[required]
}

// ---------------------------------------------------------------------------------------------
// Hiring gate — the only gate in the system (decomposition E12; `architecture/01` §1.3).
// A buyer's stated minimum trust tier vs. `Listing.trustTier`, and nothing else.
// ---------------------------------------------------------------------------------------------

const TRUST_TIER_RANK: Readonly<Record<TrustTier, number>> = { Low: 0, Medium: 1, High: 2 }

export interface HiringGateParams {
  /** `null` = the listing has not reached `LIVE` yet and therefore cannot be hired at all. */
  listingTrustTier: TrustTier | null
  buyerMinimumTrustTier: TrustTier
}

export function passesHiringGate(params: HiringGateParams): boolean {
  if (params.listingTrustTier === null) return false
  return TRUST_TIER_RANK[params.listingTrustTier] >= TRUST_TIER_RANK[params.buyerMinimumTrustTier]
}
