/**
 * RING 2 · OWNED STATE — buyer credentials
 * `@repo/access/proof` — public contract. Named exports only.
 *
 * `AOPS-PoP` / `AOPS-Proof` verification — `final-review-docs/04` §8.2.
 * Seven-step order, cheapest first. **No bearer fallback path exists in this module.**
 */

import type { DbClient } from '@repo/database/client'
import { credentials } from '@repo/database/schema'
import { type AccessTier, accessTierSatisfies, computeAccessTier } from '@repo/domain/guards'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { base64UrlDecode } from '#private/base64url'
import { getBoundSession } from '#private/bound-session-store'
import { IAT_SKEW_SECONDS } from '#private/constants'
import { constantTimeEqual, hashSecret, sha256Hex, verifyEd25519Signature } from '#private/crypto'
import { JtiCache } from '#private/jti-cache'
import { BoundSessionCache, checkFreshAuthorization } from './authorization'
import { type CredentialNet, parseToken } from './token'

export const AOPS_POP_SCHEME = 'AOPS-PoP'

const proofPayloadSchema = z.object({
  kid: z.string().length(22),
  htm: z.string(),
  htu: z.string().url(),
  ath: z.string(),
  bh: z.string(),
  iat: z.number().int(),
  jti: z.string().min(1),
})

export type ProofFailureStep =
  | 'PROOF_REQUIRED'
  | 'STEP1_TOKEN'
  | 'STEP2_LOOKUP'
  | 'STEP3_STATUS'
  | 'STEP4_DEVICE_KEY'
  | 'STEP5_REPLAY'
  | 'STEP6_BINDING'
  | 'STEP7_TIER'

export interface VerifyProofRequest {
  method: string
  url: string
  body: Uint8Array | string
}

export interface VerifyProofInput {
  authorizationHeader: string | undefined
  proofHeader: string | undefined
  request: VerifyProofRequest
  deploymentNet: CredentialNet
  requiredTier: AccessTier
  db: DbClient
  serverTime?: number
  jtiCache?: JtiCache
  boundSessionCache?: BoundSessionCache
  /** Required when `requiredTier` is `Fresh` — authoritative session liveness probe. */
  liveSessionCheck?: (credentialId: string, sessionId: string) => Promise<boolean>
}

export interface VerifyProofSuccess {
  ok: true
  credentialId: string
  accountId: string
  tier: AccessTier
  kid: string
}

export interface VerifyProofFailure {
  ok: false
  step: ProofFailureStep
  server_time?: number
}

export type VerifyProofResult = VerifyProofSuccess | VerifyProofFailure

const defaultJtiCache = new JtiCache()

function normalizeBody(body: Uint8Array | string): Uint8Array {
  return typeof body === 'string' ? new TextEncoder().encode(body) : body
}

function parseAuthorizationHeader(header: string | undefined): string | null {
  if (!header) return null
  const trimmed = header.trim()
  if (!trimmed.startsWith(`${AOPS_POP_SCHEME} `)) return null
  return trimmed.slice(AOPS_POP_SCHEME.length + 1).trim()
}

function parseProofHeader(
  header: string | undefined,
): { payload: string; signature: string } | null {
  if (!header) return null
  const parts = header.split('.')
  if (parts.length !== 2) return null
  const payload = parts[0]
  const signature = parts[1]
  if (!payload || !signature) return null
  return { payload, signature }
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(normalized.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export async function verifyProofOfPossession(input: VerifyProofInput): Promise<VerifyProofResult> {
  const serverTime = input.serverTime ?? Math.floor(Date.now() / 1000)

  // No bearer fallback — proof header is mandatory (`04` §8.2).
  const proofParts = parseProofHeader(input.proofHeader)
  if (!proofParts) {
    return { ok: false, step: 'PROOF_REQUIRED', server_time: serverTime }
  }

  const tokenRaw = parseAuthorizationHeader(input.authorizationHeader)
  if (!tokenRaw) {
    return { ok: false, step: 'STEP1_TOKEN', server_time: serverTime }
  }

  // Step 1 — parse token, verify crc, verify net matches deployment.
  const parsed = parseToken(tokenRaw)
  if ('error' in parsed) {
    return { ok: false, step: 'STEP1_TOKEN', server_time: serverTime }
  }
  if (parsed.net !== input.deploymentNet) {
    return { ok: false, step: 'STEP1_TOKEN', server_time: serverTime }
  }

  // Step 2 — look up by kid; constant-time compare SHA-256(secret).
  const row = await input.db.query.credentials.findFirst({
    where: eq(credentials.kid, parsed.kid),
    with: { account: true },
  })
  if (!row) {
    return { ok: false, step: 'STEP2_LOOKUP', server_time: serverTime }
  }

  const secretHash = await hashSecret(parsed.secret)
  if (!constantTimeEqual(secretHash, row.secretHash)) {
    return { ok: false, step: 'STEP2_LOOKUP', server_time: serverTime }
  }

  // Step 3 — credential is ACTIVE or ROTATING.
  if (row.status !== 'ACTIVE' && row.status !== 'ROTATING') {
    return { ok: false, step: 'STEP3_STATUS', server_time: serverTime }
  }

  const account = row.account
  if (!account) {
    return { ok: false, step: 'STEP3_STATUS', server_time: serverTime }
  }
  if (account.status === 'SUSPENDED') {
    return { ok: false, step: 'STEP3_STATUS', server_time: serverTime }
  }

  // Step 4 — verify Ed25519 proof against bound device_pubkey.
  let payloadJson: z.infer<typeof proofPayloadSchema>
  try {
    const payloadBytes = base64UrlDecode(proofParts.payload)
    const payloadText = new TextDecoder().decode(payloadBytes)
    payloadJson = proofPayloadSchema.parse(JSON.parse(payloadText))
  } catch {
    return { ok: false, step: 'STEP4_DEVICE_KEY', server_time: serverTime }
  }

  if (payloadJson.kid !== parsed.kid) {
    return { ok: false, step: 'STEP4_DEVICE_KEY', server_time: serverTime }
  }

  let devicePubKeyBytes: Uint8Array
  try {
    devicePubKeyBytes = hexToBytes(row.devicePubKey)
  } catch {
    return { ok: false, step: 'STEP4_DEVICE_KEY', server_time: serverTime }
  }

  let signatureBytes: Uint8Array
  try {
    signatureBytes = base64UrlDecode(proofParts.signature)
  } catch {
    return { ok: false, step: 'STEP4_DEVICE_KEY', server_time: serverTime }
  }

  const signedPayloadBytes = new TextEncoder().encode(proofParts.payload)
  const ed25519Valid = await verifyEd25519Signature(
    devicePubKeyBytes,
    signedPayloadBytes,
    signatureBytes,
  )
  if (!ed25519Valid) {
    return { ok: false, step: 'STEP4_DEVICE_KEY', server_time: serverTime }
  }

  // Step 5 — iat within ±90s; jti unseen in window.
  if (Math.abs(payloadJson.iat - serverTime) > IAT_SKEW_SECONDS) {
    return { ok: false, step: 'STEP5_REPLAY', server_time: serverTime }
  }

  const jtiCache = input.jtiCache ?? defaultJtiCache
  if (!jtiCache.markSeen(payloadJson.jti, serverTime * 1000)) {
    return { ok: false, step: 'STEP5_REPLAY', server_time: serverTime }
  }

  // Step 6 — htm/htu match request; bh matches body; ath matches token hash.
  if (payloadJson.htm.toUpperCase() !== input.request.method.toUpperCase()) {
    return { ok: false, step: 'STEP6_BINDING', server_time: serverTime }
  }
  if (payloadJson.htu !== input.request.url) {
    return { ok: false, step: 'STEP6_BINDING', server_time: serverTime }
  }

  const bodyBytes = normalizeBody(input.request.body)
  const bodyHash = await sha256Hex(bodyBytes)
  if (payloadJson.bh !== bodyHash) {
    return { ok: false, step: 'STEP6_BINDING', server_time: serverTime }
  }

  const tokenHash = await sha256Hex(tokenRaw)
  if (payloadJson.ath !== tokenHash) {
    return { ok: false, step: 'STEP6_BINDING', server_time: serverTime }
  }

  // Step 7 — tier permits route; Fresh calls require live bound session (`04` §9.1/§9.3).
  const bound = getBoundSession(row.id)
  let hasLiveBoundSession = false

  if (input.requiredTier === 'Fresh') {
    if (!bound) {
      return { ok: false, step: 'STEP7_TIER', server_time: serverTime }
    }
    if (!input.liveSessionCheck) {
      return { ok: false, step: 'STEP7_TIER', server_time: serverTime }
    }

    const liveSessionCheck = input.liveSessionCheck
    const cache = input.boundSessionCache ?? new BoundSessionCache()
    const freshResult = await checkFreshAuthorization({
      credentialId: row.id,
      sessionId: bound.sessionId,
      liveCheck: () => liveSessionCheck(row.id, bound.sessionId),
      cache,
    })
    hasLiveBoundSession = freshResult.approved
    if (!hasLiveBoundSession) {
      return { ok: false, step: 'STEP7_TIER', server_time: serverTime }
    }
  } else if (bound && input.liveSessionCheck) {
    const liveSessionCheck = input.liveSessionCheck
    const cache = input.boundSessionCache ?? new BoundSessionCache()
    const freshResult = await checkFreshAuthorization({
      credentialId: row.id,
      sessionId: bound.sessionId,
      liveCheck: () => liveSessionCheck(row.id, bound.sessionId),
      cache,
    })
    hasLiveBoundSession = freshResult.approved
  }

  const actualTier = computeAccessTier({
    accountStatus: account.status,
    hasLiveBoundSessionCoveringCall: hasLiveBoundSession,
  })

  if (!accessTierSatisfies(actualTier, input.requiredTier)) {
    return { ok: false, step: 'STEP7_TIER', server_time: serverTime }
  }

  return {
    ok: true,
    credentialId: row.id,
    accountId: account.id,
    tier: actualTier,
    kid: parsed.kid,
  }
}

export { JtiCache }
