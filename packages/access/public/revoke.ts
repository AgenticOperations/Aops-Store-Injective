/**
 * RING 2 · OWNED STATE — buyer credentials
 * `@repo/access/revoke` — public contract. Named exports only.
 *
 * Credential revocation — `final-review-docs/04` §11.3.
 */

import type { DbClient } from '@repo/database/client'
import { credentials } from '@repo/database/schema'
import { eq } from 'drizzle-orm'
import type { BoundSessionCache } from '#private/bound-session-cache'
import { clearBoundSession, findCredentialIdsBySession } from '#private/bound-session-store'

export interface RevokeCredentialInput {
  credentialId: string
  db: DbClient
  cache?: BoundSessionCache
}

export interface RevokeCredentialResult {
  credentialId: string
  status: 'REVOKED'
}

export async function revokeCredential(
  input: RevokeCredentialInput,
): Promise<RevokeCredentialResult | { error: string }> {
  const updated = await input.db
    .update(credentials)
    .set({ status: 'REVOKED' })
    .where(eq(credentials.id, input.credentialId))
    .returning({ id: credentials.id })

  if (!updated[0]) return { error: 'CREDENTIAL_NOT_FOUND' }

  clearBoundSession(input.credentialId)
  input.cache?.delete(input.credentialId)

  return { credentialId: updated[0].id, status: 'REVOKED' }
}

/** Hook shape for `apps/watch` → `apps/jobs` cascade — `04` §11.3. */
export interface OnChainRevokeCascadeInput {
  sessionId: string
  db: DbClient
  cache?: BoundSessionCache
}

export interface OnChainRevokeCascadeResult {
  sessionId: string
  revokedCredentialIds: string[]
}

/**
 * When an on-chain session revoke is observed, revoke every off-chain credential bound to it.
 * The chain is the source of truth; the off-chain record follows (`04` §11.3).
 */
export async function onChainRevokeCascade(
  input: OnChainRevokeCascadeInput,
): Promise<OnChainRevokeCascadeResult> {
  const credentialIds = findCredentialIdsBySession(input.sessionId)
  const revokedCredentialIds: string[] = []

  for (const credentialId of credentialIds) {
    const revokeInput: RevokeCredentialInput = { credentialId, db: input.db }
    if (input.cache) revokeInput.cache = input.cache
    const result = await revokeCredential(revokeInput)
    if ('credentialId' in result) {
      revokedCredentialIds.push(result.credentialId)
    }
  }

  return { sessionId: input.sessionId, revokedCredentialIds }
}
