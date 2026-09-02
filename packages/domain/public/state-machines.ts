/**
 * RING 0 · PURE — no I/O, imports nothing
 * `@repo/domain/state-machines` — public contract. Named exports only.
 *
 * Entities, state machines, transition guards, shared types. The vocabulary of the whole system.
 */

import type { AccountStatus, CredentialStatus, JobStatus, ListingStatus } from './entities'
import type { TrustTier } from './types'

/** Generic transition-graph check. Every entity's graph below is a `from -> allowed-to[]` map,
 * so orchestrating packages (`listings`, `access`, …) call this instead of re-deriving the shape
 * of the ladder themselves (00 §3.5 — those packages hold no guard logic of their own). */
export function isValidTransition<S extends string>(
  graph: Readonly<Record<S, readonly S[]>>,
  from: S,
  to: S,
): boolean {
  return graph[from].includes(to)
}

export function transition<S extends string>(
  graph: Readonly<Record<S, readonly S[]>>,
  from: S,
  to: S,
): S {
  if (!isValidTransition(graph, from, to)) {
    throw new Error(`Invalid transition: ${from} -> ${to}`)
  }
  return to
}

// ---------------------------------------------------------------------------------------------
// Listing — DISCOVERED -> ... -> LIVE, then DEGRADED/SUSPENDED/REVOKED
// `final-review-docs/01` §4, `architecture/01` §1.2's transition table.
// ---------------------------------------------------------------------------------------------

export const LISTING_TRANSITIONS: Readonly<Record<ListingStatus, readonly ListingStatus[]>> = {
  DISCOVERED: ['CLAIMED', 'SUSPENDED', 'REVOKED'],
  CLAIMED: ['OWNERSHIP_VERIFIED', 'SUSPENDED', 'REVOKED'],
  OWNERSHIP_VERIFIED: ['ENDPOINT_VERIFIED', 'SUSPENDED', 'REVOKED'],
  ENDPOINT_VERIFIED: ['LIVE', 'SUSPENDED', 'REVOKED'],
  // `LIVE <-> DEGRADED` auto-recovers symmetrically on sustained endpoint failure/recovery (01 §10).
  LIVE: ['DEGRADED', 'SUSPENDED', 'REVOKED'],
  DEGRADED: ['LIVE', 'SUSPENDED', 'REVOKED'],
  SUSPENDED: ['REVOKED'],
  REVOKED: [],
}

/** Trust tier is a separate axis from `status` (never blocks it) — `Listing.trustTier` starts
 * `null`, becomes `'Low'` the instant `status` reaches `LIVE` (compulsory, `01` §4.4), and only
 * ever climbs further by owner opt-in (`01` §5-7). */
export const TRUST_TIER_TRANSITIONS: Readonly<Record<TrustTier, readonly TrustTier[]>> = {
  Low: ['Medium'],
  Medium: ['High'],
  High: [],
}

export const INITIAL_TRUST_TIER_ON_LIVE: TrustTier = 'Low'

// ---------------------------------------------------------------------------------------------
// Account — UNFUNDED -> FUNDED / RESTRICTED -> SUSPENDED (`final-review-docs/04` §6.1)
// ---------------------------------------------------------------------------------------------

export const ACCOUNT_TRANSITIONS: Readonly<Record<AccountStatus, readonly AccountStatus[]>> = {
  UNFUNDED: ['FUNDED', 'SUSPENDED'],
  FUNDED: ['RESTRICTED', 'SUSPENDED'],
  RESTRICTED: ['FUNDED', 'SUSPENDED'],
  SUSPENDED: [],
}

// ---------------------------------------------------------------------------------------------
// Credential — PENDING -> ACTIVE -> ROTATING -> EXPIRED/REVOKED (`final-review-docs/04` §6.2)
// ---------------------------------------------------------------------------------------------

export const CREDENTIAL_TRANSITIONS: Readonly<
  Record<CredentialStatus, readonly CredentialStatus[]>
> = {
  PENDING: ['ACTIVE'],
  ACTIVE: ['ROTATING', 'REVOKED'],
  ROTATING: ['EXPIRED', 'REVOKED'],
  EXPIRED: [],
  REVOKED: [],
}

// ---------------------------------------------------------------------------------------------
// Job (persistent-service) — `architecture/01` §1.4
// ---------------------------------------------------------------------------------------------

export const JOB_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  CONFIGURED: ['AUTHORIZED'],
  AUTHORIZED: ['ACTIVE'],
  ACTIVE: ['RUNNING'],
  // PAUSED is user-initiated only; DEGRADED is worker-detected infra failure; ATTENTION_REQUIRED
  // is a boundary hit (spend cap near-exhausted, health-factor breach past auto-react threshold).
  // All three resume to RUNNING once resolved, mirroring 01 §10's stated symmetric recovery for
  // Listing's LIVE<->DEGRADED — not spelled out verbatim for Job, but the same operational shape.
  RUNNING: ['PAUSED', 'DEGRADED', 'ATTENTION_REQUIRED', 'EXPIRED', 'REVOKED'],
  PAUSED: ['RUNNING', 'EXPIRED', 'REVOKED'],
  DEGRADED: ['RUNNING', 'EXPIRED', 'REVOKED'],
  ATTENTION_REQUIRED: ['RUNNING', 'EXPIRED', 'REVOKED'],
  // Renewal reactivates under a new Authorization, same Evidence/Performance continuity
  // (`architecture/01` §1.3) — the one explicitly-stated EXPIRED edge.
  EXPIRED: ['RUNNING', 'ARCHIVED'],
  REVOKED: ['ARCHIVED'],
  ARCHIVED: [],
}
