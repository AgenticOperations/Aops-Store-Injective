/**
 * RING 0 · PURE — no I/O, imports nothing
 * `@repo/domain/entities` — public contract. Named exports only.
 *
 * Entities, state machines, transition guards, shared types. The vocabulary of the whole system.
 */

import type { Category, TrustTier, WalletAddress } from './types'

// ---------------------------------------------------------------------------------------------
// Listing — `final-review-docs/01` §4-5, `architecture/01` §1.2
// ---------------------------------------------------------------------------------------------

export type ListingStatus =
  | 'DISCOVERED'
  | 'CLAIMED'
  | 'OWNERSHIP_VERIFIED'
  | 'ENDPOINT_VERIFIED'
  | 'LIVE'
  | 'DEGRADED'
  | 'SUSPENDED'
  | 'REVOKED'

/** Trust tier is a separate, non-blocking axis from `status` — a `LIVE` listing always carries
 * at least `'Low'`; `null` before `LIVE` is ever reached (`final-review-docs/01` §5). */
export interface Listing {
  id: string
  agentId: string
  category: Category
  status: ListingStatus
  trustTier: TrustTier | null
  ownerWallet: WalletAddress
  erc8004Ref: { chainId: number; tokenId: string } | null
  createdAt: Date
}

// ---------------------------------------------------------------------------------------------
// Account — `final-review-docs/04` §6.1
// ---------------------------------------------------------------------------------------------

export type AccountStatus = 'UNFUNDED' | 'FUNDED' | 'RESTRICTED' | 'SUSPENDED'

/** One per wallet address. Never authenticated against directly and holds no secret — spend
 * caps and expiry live exactly once, on-chain (`04` §6.1). */
export interface Account {
  id: string
  walletAddress: WalletAddress
  status: AccountStatus
  createdAt: Date
}

// ---------------------------------------------------------------------------------------------
// Credential — `final-review-docs/04` §6.2
// ---------------------------------------------------------------------------------------------

export type CredentialStatus = 'PENDING' | 'ACTIVE' | 'ROTATING' | 'EXPIRED' | 'REVOKED'

/** One per running instance, never shared — three replicas of the same agent take three
 * credentials (`04` §6.2). The device key itself (§6.3) never leaves the caller's machine and
 * is never modeled here. */
export interface Credential {
  id: string
  accountId: string
  devicePubKey: string
  status: CredentialStatus
  createdAt: Date
}

// ---------------------------------------------------------------------------------------------
// Authorization — `architecture/01` §1.3
// ---------------------------------------------------------------------------------------------

/** Only `ALTANA_SESSION` and `ERC8183_ESCROW` (`PLAIN`) need real guards for v1 (Chunk 1 scope
 * note). `AACP_PROGRAM` and `X402_PAYMENT` are modeled as inert variants — no guard logic yet. */
export type AuthorizationRail =
  | 'ALTANA_SESSION'
  | 'ERC8183_ESCROW'
  | 'AACP_PROGRAM'
  | 'X402_PAYMENT'

export type EscrowVariant = 'PLAIN' | 'AACP_PROGRAM'

export type AuthorizationStatus = 'PENDING' | 'GRANTED' | 'EXPIRED' | 'REVOKED'

export interface AltanaSessionScope {
  contractAllowlist: WalletAddress[]
  spendCap: { amount: bigint; tokenDecimals: number }
  expiry: Date
}

export interface Erc8183EscrowScope {
  escrowContract: WalletAddress
  fundedAmount: bigint
  disputeWindowSeconds: number
  escrowVariant: EscrowVariant
}

/** `AACP_PROGRAM` and `X402_PAYMENT` carry no scope fields yet — inert variants, per Chunk 1's
 * explicit scope note. */
export type AuthorizationScope =
  | { rail: 'ALTANA_SESSION'; scope: AltanaSessionScope }
  | { rail: 'ERC8183_ESCROW'; scope: Erc8183EscrowScope }
  | { rail: 'AACP_PROGRAM'; scope: Record<string, never> }
  | { rail: 'X402_PAYMENT'; scope: Record<string, never> }

/** The hiring gate lives here as data (`buyerMinimumTrustTier`); `guards.ts`'s
 * `passesHiringGate` is the only function permitted to evaluate it (E12 — "the only gate in the
 * system"). */
export interface Authorization {
  id: string
  listingId: string
  buyerWallet: WalletAddress
  buyerMinimumTrustTier: TrustTier
  status: AuthorizationStatus
  authorization: AuthorizationScope
  createdAt: Date
}

// ---------------------------------------------------------------------------------------------
// Job — `architecture/01` §1.4, persistent-service lifecycle only (the priority flow; other
// `listing_type`s adopt their own lifecycle out of Chunk 1 scope, per the milestone plan §4).
// ---------------------------------------------------------------------------------------------

export type JobStatus =
  | 'CONFIGURED'
  | 'AUTHORIZED'
  | 'ACTIVE'
  | 'RUNNING'
  | 'PAUSED'
  | 'DEGRADED'
  | 'ATTENTION_REQUIRED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'ARCHIVED'

export interface Job {
  id: string
  authorizationId: string
  listingId: string
  status: JobStatus
  createdAt: Date
}
