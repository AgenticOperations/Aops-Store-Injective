/**
 * RING 2 · OWNED STATE — buyer credentials
 * `@repo/access/enrollment` — public contract. Named exports only.
 *
 * Base-enrollment flow — `final-review-docs/04` §7.2-7.3. Callable logic only (no HTTP).
 */

import type { DbClient } from '@repo/database/client'
import { accounts, credentials } from '@repo/database/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { type Address, type Hex, type TypedDataDomain, recoverTypedDataAddress } from 'viem'
import { z } from 'zod'
import {
  AGENT_ENROLLMENT_DOMAIN_NAME,
  AGENT_ENROLLMENT_DOMAIN_VERSION,
  AGENT_ENROLLMENT_TYPES,
  MAX_LIVE_CREDENTIALS,
  VALID_UNTIL_DAYS,
} from '#private/constants'
import { devicePubKeyToBytes32 } from '#private/crypto'
import { NonceStore, nonceExpiresAt } from '#private/nonce-store'
import { type CredentialNet, type CredentialTier, mintCredentialToken } from './token'

export const enrollmentIntentSchema = z.enum(['enroll', 'revoke'])
export type EnrollmentIntent = z.infer<typeof enrollmentIntentSchema>

export interface AccessDeploymentConfig {
  chainId: number
  salt: Hex
  net: CredentialNet
}

export interface AgentEnrollmentMessage {
  intent: EnrollmentIntent
  wallet: Address
  devicePubKey: Hex
  issuedAt: bigint
  nonce: Hex
}

export interface CreateChallengeInput {
  wallet: Address
  devicePubKey: Uint8Array
  config: AccessDeploymentConfig
  nonceStore?: NonceStore
  now?: number
}

export interface CreateChallengeResult {
  eip712_payload: {
    domain: TypedDataDomain
    types: typeof AGENT_ENROLLMENT_TYPES
    primaryType: 'AgentEnrollment'
    message: AgentEnrollmentMessage
  }
  nonce: Hex
  expires_at: Date
}

export interface EnrollInput {
  nonce: Hex
  signature: Hex
  devicePubKey: Uint8Array
  wallet: Address
  tier: CredentialTier
  config: AccessDeploymentConfig
  db: DbClient
  nonceStore?: NonceStore
  now?: number
}

export interface EnrollResult {
  account_id: string
  credential: string
  valid_until: Date
  /** `true` when the wallet already had an account — idempotent re-enroll (`04` §7.2 step 4). */
  isExistingAccount: boolean
}

const defaultNonceStore = new NonceStore()

function buildEnrollmentDomain(config: AccessDeploymentConfig): TypedDataDomain {
  return {
    name: AGENT_ENROLLMENT_DOMAIN_NAME,
    version: AGENT_ENROLLMENT_DOMAIN_VERSION,
    chainId: config.chainId,
    salt: config.salt,
  }
}

function validUntilFrom(now: number): Date {
  return new Date(now + VALID_UNTIL_DAYS * 24 * 60 * 60 * 1000)
}

export function createChallenge(input: CreateChallengeInput): CreateChallengeResult {
  const now = input.now ?? Date.now()
  const nonceStore = input.nonceStore ?? defaultNonceStore
  const nonceBytes = crypto.getRandomValues(new Uint8Array(32))
  const nonce = `0x${Buffer.from(nonceBytes).toString('hex')}` as Hex
  const devicePubKeyHex = devicePubKeyToBytes32(input.devicePubKey)
  const expiresAt = nonceExpiresAt(now)

  const issuedAt = BigInt(Math.floor(now / 1000))

  nonceStore.put(nonce, {
    wallet: input.wallet,
    devicePubKey: devicePubKeyHex,
    issuedAt,
    expiresAt,
  })

  const message: AgentEnrollmentMessage = {
    intent: 'enroll',
    wallet: input.wallet,
    devicePubKey: devicePubKeyHex,
    issuedAt,
    nonce,
  }

  return {
    eip712_payload: {
      domain: buildEnrollmentDomain(input.config),
      types: AGENT_ENROLLMENT_TYPES,
      primaryType: 'AgentEnrollment',
      message,
    },
    nonce,
    expires_at: new Date(expiresAt),
  }
}

export async function enroll(input: EnrollInput): Promise<EnrollResult | { error: string }> {
  const now = input.now ?? Date.now()
  const nonceStore = input.nonceStore ?? defaultNonceStore
  const devicePubKeyHex = devicePubKeyToBytes32(input.devicePubKey)

  const consumed = nonceStore.consume(input.nonce, input.wallet, devicePubKeyHex, now)
  if (!consumed) {
    return { error: 'NONCE_INVALID' }
  }

  const domain = buildEnrollmentDomain(input.config)
  const message: AgentEnrollmentMessage = {
    intent: 'enroll',
    wallet: input.wallet,
    devicePubKey: devicePubKeyHex,
    issuedAt: consumed.issuedAt,
    nonce: input.nonce,
  }

  let recovered: Address
  try {
    recovered = await recoverTypedDataAddress({
      domain,
      types: AGENT_ENROLLMENT_TYPES,
      primaryType: 'AgentEnrollment',
      message,
      signature: input.signature,
    })
  } catch {
    return { error: 'SIGNATURE_INVALID' }
  }

  if (recovered.toLowerCase() !== input.wallet.toLowerCase()) {
    return { error: 'SIGNER_MISMATCH' }
  }

  const existingAccount = await input.db.query.accounts.findFirst({
    where: eq(accounts.walletAddress, input.wallet),
  })

  let accountId: string
  let isExistingAccount: boolean

  if (existingAccount) {
    accountId = existingAccount.id
    isExistingAccount = true

    const liveCount = await input.db
      .select({ count: sql<number>`count(*)::int` })
      .from(credentials)
      .where(
        and(
          eq(credentials.accountId, accountId),
          inArray(credentials.status, ['ACTIVE', 'ROTATING', 'PENDING']),
        ),
      )

    const count = liveCount[0]?.count ?? 0
    if (count >= MAX_LIVE_CREDENTIALS) {
      return { error: 'CREDENTIAL_CEILING' }
    }
  } else {
    const inserted = await input.db
      .insert(accounts)
      .values({ walletAddress: input.wallet, status: 'UNFUNDED' })
      .returning({ id: accounts.id })
    const row = inserted[0]
    if (!row) return { error: 'ACCOUNT_CREATE_FAILED' }
    accountId = row.id
    isExistingAccount = false
  }

  const minted = await mintCredentialToken({ tier: input.tier, net: input.config.net })

  const insertedCredential = await input.db
    .insert(credentials)
    .values({
      accountId,
      devicePubKey: devicePubKeyHex,
      status: 'ACTIVE',
      tier: minted.tier,
      net: minted.net,
      kid: minted.kid,
      secretHash: minted.secretHash,
    })
    .returning({ id: credentials.id })

  if (!insertedCredential[0]) {
    return { error: 'CREDENTIAL_CREATE_FAILED' }
  }

  return {
    account_id: accountId,
    credential: minted.token,
    valid_until: validUntilFrom(now),
    isExistingAccount,
  }
}

export { NonceStore }
