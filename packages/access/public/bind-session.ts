/**
 * RING 2 · OWNED STATE — buyer credentials
 * `@repo/access/bind-session` — public contract. Named exports only.
 *
 * Session binding — `final-review-docs/04` §7.4. Keystore read is injected; no `@repo/custody`.
 */

import type { DbClient } from '@repo/database/client'
import { credentials } from '@repo/database/schema'
import { eq } from 'drizzle-orm'
import type { Address } from 'viem'
import { setBoundSession } from '#private/bound-session-store'

/** Keystore exposes authorization state only — `04` §12.5. No spend/budget fields. */
export type KeystoreAuthorizationState = 'valid' | 'revoked' | 'expired'

export interface KeystoreEntry {
  sessionId: string
  /** Wallet (or controlling delegate) named as authorised party in the Keystore entry. */
  authorizedWallet: Address
  state: KeystoreAuthorizationState
  /** Session wall expiry when known — may be `null` if the reader cannot determine it. */
  expiresAt: Date | null
}

export type ReadKeystoreEntry = (sessionId: string) => Promise<KeystoreEntry | null>

export interface BindSessionInput {
  sessionId: string
  credentialId: string
  db: DbClient
  readKeystoreEntry: ReadKeystoreEntry
  now?: number
}

export interface BindSessionResult {
  fresh: true
  session_expires_at: Date | null
}

export async function bindSession(
  input: BindSessionInput,
): Promise<BindSessionResult | { error: string }> {
  const credential = await input.db.query.credentials.findFirst({
    where: eq(credentials.id, input.credentialId),
    with: { account: true },
  })

  if (!credential) return { error: 'CREDENTIAL_NOT_FOUND' }
  if (credential.status === 'REVOKED' || credential.status === 'EXPIRED') {
    return { error: 'CREDENTIAL_INACTIVE' }
  }

  const account = credential.account
  if (!account) return { error: 'ACCOUNT_NOT_FOUND' }

  const keystore = await input.readKeystoreEntry(input.sessionId)
  if (!keystore) return { error: 'KEYSTORE_NOT_FOUND' }

  if (keystore.state !== 'valid') {
    return { error: 'SESSION_NOT_LIVE' }
  }

  if (keystore.authorizedWallet.toLowerCase() !== account.walletAddress.toLowerCase()) {
    return { error: 'WALLET_MISMATCH' }
  }

  const now = input.now ?? Date.now()
  if (keystore.expiresAt && keystore.expiresAt.getTime() <= now) {
    return { error: 'SESSION_EXPIRED' }
  }

  setBoundSession(input.credentialId, {
    sessionId: input.sessionId,
    sessionExpiresAt: keystore.expiresAt,
    boundAt: now,
  })

  return {
    fresh: true,
    session_expires_at: keystore.expiresAt,
  }
}

export { getBoundSession, findCredentialIdsBySession } from '#private/bound-session-store'
