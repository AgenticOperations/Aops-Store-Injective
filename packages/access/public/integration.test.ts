/**
 * Integration tests — enrollment → bindSession → revoke round-trip.
 * Skips when `DATABASE_URL` is unset (`04` Chunk 3e verify note).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createDbClient } from '@repo/database/client'
import { getDatabaseUrl } from '@repo/database/keys'
import { accounts, credentials } from '@repo/database/schema'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import type { Address, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { clearAllBoundSessions } from '#private/bound-session-store'
import { type KeystoreEntry, type ReadKeystoreEntry, bindSession } from './bind-session'
import { type AccessDeploymentConfig, NonceStore, createChallenge, enroll } from './enrollment'
import { revokeCredential } from './revoke'
import { exportEd25519PublicKeyRaw, generateEd25519KeyPair } from './test-helpers'
import { parseToken } from './token'

function tryGet(fn: () => string): string | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

const databaseUrl = tryGet(getDatabaseUrl)
const MIGRATIONS_FOLDER = new URL('../../database/migrations', import.meta.url).pathname

const SIGNER_PRIVATE_KEY =
  '0xead08b3eb71273915a50506c312fc1d8411661e8bb592eaaff46dacb7a1b6a04' as const

const CONFIG: AccessDeploymentConfig = {
  chainId: 97,
  salt: `0x${'aa'.repeat(32)}` as Hex,
  net: 'tbsc',
}

describe.skipIf(!databaseUrl)(
  'enrollment → bindSession → revoke round-trip (fixture Keystore read)',
  () => {
    const url = databaseUrl as string
    let admin: ReturnType<typeof postgres>
    let db: ReturnType<typeof createDbClient>['db']
    let sql: ReturnType<typeof createDbClient>['sql']

    beforeAll(async () => {
      admin = postgres(url, { max: 1, onnotice: () => {} })
      await admin.unsafe('DROP SCHEMA IF EXISTS public CASCADE')
      await admin.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE')
      await admin.unsafe('CREATE SCHEMA public')
      await admin.end()

      const client = createDbClient(url)
      db = client.db
      sql = client.sql
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
      clearAllBoundSessions()
    })

    afterAll(async () => {
      clearAllBoundSessions()
      await sql.end()
    })

    test('wallet enrolls, binds a fixture session, then revokes the credential', async () => {
      const walletAccount = privateKeyToAccount(SIGNER_PRIVATE_KEY)
      const deviceKeyPair = await generateEd25519KeyPair()
      const devicePubKeyRaw = await exportEd25519PublicKeyRaw(deviceKeyPair)
      const nonceStore = new NonceStore()

      const challenge = createChallenge({
        wallet: walletAccount.address as Address,
        devicePubKey: devicePubKeyRaw,
        config: CONFIG,
        nonceStore,
      })

      const signature = await walletAccount.signTypedData({
        domain: challenge.eip712_payload.domain,
        types: challenge.eip712_payload.types,
        primaryType: 'AgentEnrollment',
        message: challenge.eip712_payload.message,
      })

      const enrolled = await enroll({
        nonce: challenge.nonce,
        signature,
        devicePubKey: devicePubKeyRaw,
        wallet: walletAccount.address as Address,
        tier: 'dlg',
        config: CONFIG,
        db,
        nonceStore,
      })

      expect('error' in enrolled).toBe(false)
      if ('error' in enrolled) return

      expect(enrolled.credential.startsWith('aops_dlg_tbsc_')).toBe(true)

      const parsed = parseToken(enrolled.credential)
      expect('error' in parsed).toBe(false)
      if ('error' in parsed) return

      const credentialRow = await db.query.credentials.findFirst({
        where: eq(credentials.kid, parsed.kid),
      })
      expect(credentialRow).toBeDefined()
      if (!credentialRow) return

      const credential = credentialRow

      const sessionId = 'fixture-session-001'
      const readKeystoreEntry: ReadKeystoreEntry = async (id): Promise<KeystoreEntry | null> => {
        if (id !== sessionId) return null
        return {
          sessionId,
          authorizedWallet: walletAccount.address as Address,
          state: 'valid',
          expiresAt: new Date(Date.now() + 86_400_000),
        }
      }

      const bound = await bindSession({
        sessionId,
        credentialId: credential.id,
        db,
        readKeystoreEntry,
      })

      expect('error' in bound).toBe(false)
      if ('error' in bound) return
      expect(bound.fresh).toBe(true)

      const revoked = await revokeCredential({ credentialId: credential.id, db })
      expect('error' in revoked).toBe(false)
      if ('error' in revoked) return
      expect(revoked.status).toBe('REVOKED')

      const accountRow = await db.query.accounts.findFirst({
        where: eq(accounts.id, enrolled.account_id),
      })
      expect(accountRow?.walletAddress.toLowerCase()).toBe(walletAccount.address.toLowerCase())
    })
  },
)
