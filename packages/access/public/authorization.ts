/**
 * RING 2 · OWNED STATE — buyer credentials
 * `@repo/access/authorization` — public contract. Named exports only.
 *
 * Bound-session read-through cache — `final-review-docs/04` §9.3.
 * A stale cache may false-reject; it must never false-approve — live check is always required.
 */

import { BoundSessionCache } from '#private/bound-session-cache'

export { BoundSessionCache }

export type FreshAuthorizationSource = 'live' | 'cache_reject'

export interface CheckFreshAuthorizationInput {
  credentialId: string
  sessionId: string
  /** Authoritative on-chain/session liveness probe — the only path that may approve. */
  liveCheck: () => Promise<boolean>
  cache: BoundSessionCache
}

export interface CheckFreshAuthorizationResult {
  approved: boolean
  source: FreshAuthorizationSource
}

/**
 * Fast-fail courtesy cache (`04` §9.3). Approval always requires `liveCheck()` to return
 * `true` — a cache entry reporting live is never sufficient on its own.
 */
export async function checkFreshAuthorization(
  input: CheckFreshAuthorizationInput,
): Promise<CheckFreshAuthorizationResult> {
  const cached = input.cache.get(input.credentialId)

  if (cached && !cached.isLive) {
    return { approved: false, source: 'cache_reject' }
  }

  const live = await input.liveCheck()

  if (live) {
    input.cache.set(input.credentialId, { isLive: true, checkedAt: Date.now() })
    return { approved: true, source: 'live' }
  }

  input.cache.set(input.credentialId, { isLive: false, checkedAt: Date.now() })
  return { approved: false, source: 'live' }
}
