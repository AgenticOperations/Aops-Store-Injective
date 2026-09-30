// packages/access/public/test-helpers.ts — fixtures for access package tests only.
import { base64UrlEncode } from '#private/base64url'
import { sha256Hex } from '#private/crypto'
import { AOPS_POP_SCHEME } from './proof'
import { buildTokenString } from './token'

export async function generateEd25519KeyPair(): Promise<CryptoKeyPair> {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  return keyPair as CryptoKeyPair
}

export async function exportEd25519PublicKeyRaw(keyPair: CryptoKeyPair): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
}

export async function signProofPayload(
  keyPair: CryptoKeyPair,
  payload: Record<string, unknown>,
): Promise<string> {
  const payloadJson = JSON.stringify(payload)
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payloadJson))
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' },
    keyPair.privateKey,
    new TextEncoder().encode(payloadB64),
  )
  const sigB64 = base64UrlEncode(new Uint8Array(signature))
  return `${payloadB64}.${sigB64}`
}

export async function buildProofHeaders(params: {
  keyPair: CryptoKeyPair
  token: string
  kid: string
  method: string
  url: string
  body: string
  iat: number
  jti: string
}): Promise<{ authorization: string; proof: string }> {
  const bodyHash = await sha256Hex(new TextEncoder().encode(params.body))
  const tokenHash = await sha256Hex(params.token)
  const proof = await signProofPayload(params.keyPair, {
    kid: params.kid,
    htm: params.method,
    htu: params.url,
    ath: tokenHash,
    bh: bodyHash,
    iat: params.iat,
    jti: params.jti,
  })
  return {
    authorization: `${AOPS_POP_SCHEME} ${params.token}`,
    proof,
  }
}

export function tokenFromParts(parts: {
  tier: 'dlg' | 'svc'
  net: 'bsc' | 'tbsc'
  kid: string
  secret: string
}): string {
  return buildTokenString(parts)
}
