/**
 * RING 2 · OWNED STATE — buyer credentials
 * `@repo/access/token` — public contract. Named exports only.
 *
 * Token mint/format (`aops_<tier>_<net>_<kid>_<secret>_<crc>`) and hash-store — `04` §8.1.
 */

import { z } from 'zod'
import { generateSecret } from '#private/base64url'
import { TOKEN_PREFIX } from '#private/constants'
import { crc32 } from '#private/crc32'
import { generateKid } from '#private/crockford'
import { hashSecret } from '#private/crypto'

export const credentialTierSchema = z.enum(['dlg', 'svc'])
export const credentialNetSchema = z.enum(['bsc', 'tbsc'])

export type CredentialTier = z.infer<typeof credentialTierSchema>
export type CredentialNet = z.infer<typeof credentialNetSchema>

export interface ParsedToken {
  tier: CredentialTier
  net: CredentialNet
  kid: string
  secret: string
  crc: string
  raw: string
}

export interface MintCredentialTokenResult {
  token: string
  kid: string
  secret: string
  secretHash: string
  tier: CredentialTier
  net: CredentialNet
}

export function buildTokenString(params: {
  tier: CredentialTier
  net: CredentialNet
  kid: string
  secret: string
}): string {
  const body = `${TOKEN_PREFIX}${params.tier}_${params.net}_${params.kid}_${params.secret}`
  const checksum = crc32(body)
  return `${body}_${checksum}`
}

export async function mintCredentialToken(params: {
  tier: CredentialTier
  net: CredentialNet
}): Promise<MintCredentialTokenResult> {
  const kid = generateKid()
  const secret = generateSecret()
  const token = buildTokenString({ tier: params.tier, net: params.net, kid, secret })
  const secretHash = await hashSecret(secret)
  return { token, kid, secret, secretHash, tier: params.tier, net: params.net }
}

export function parseToken(raw: string): ParsedToken | { error: string } {
  if (!raw.startsWith(TOKEN_PREFIX)) {
    return { error: 'TOKEN_PREFIX' }
  }

  const withoutPrefix = raw.slice(TOKEN_PREFIX.length)
  const crcSep = withoutPrefix.lastIndexOf('_')
  if (crcSep <= 0) {
    return { error: 'TOKEN_FORMAT' }
  }

  const crc = withoutPrefix.slice(crcSep + 1)
  if (!/^[0-9a-f]{8}$/.test(crc)) {
    return { error: 'TOKEN_FORMAT' }
  }

  const bodyAndSecret = withoutPrefix.slice(0, crcSep)
  if (bodyAndSecret.length < 22 + 1 + 43) {
    return { error: 'TOKEN_FORMAT' }
  }

  const secretStart = bodyAndSecret.length - 43
  if (bodyAndSecret[secretStart - 1] !== '_') {
    return { error: 'TOKEN_FORMAT' }
  }

  const secret = bodyAndSecret.slice(secretStart)
  const upToKid = bodyAndSecret.slice(0, secretStart - 1)
  if (upToKid.length < 22) {
    return { error: 'TOKEN_FORMAT' }
  }

  const kid = upToKid.slice(-22)
  const tierNetPart = upToKid.slice(0, -22)
  const tierNetMatch = tierNetPart.match(/^(dlg|svc)_(bsc|tbsc)_$/)
  if (!tierNetMatch) {
    return { error: 'TOKEN_VOCABULARY' }
  }

  const tierResult = credentialTierSchema.safeParse(tierNetMatch[1])
  const netResult = credentialNetSchema.safeParse(tierNetMatch[2])
  if (!tierResult.success || !netResult.success) {
    return { error: 'TOKEN_VOCABULARY' }
  }

  if (kid.length !== 22) {
    return { error: 'KID_LENGTH' }
  }

  if (secret.length !== 43) {
    return { error: 'SECRET_LENGTH' }
  }

  const body = `${TOKEN_PREFIX}${tierResult.data}_${netResult.data}_${kid}_${secret}`
  const expectedCrc = crc32(body)
  if (expectedCrc !== crc) {
    return { error: 'CRC_MISMATCH' }
  }

  return {
    tier: tierResult.data,
    net: netResult.data,
    kid,
    secret,
    crc,
    raw,
  }
}

export { hashSecret }
