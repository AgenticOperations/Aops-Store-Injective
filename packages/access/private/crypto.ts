export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Buffer.from(digest).toString('hex')
}

/** Stores `SHA-256(secret)` as a 64-char hex digest — `04` §8.1. */
export async function hashSecret(secret: string): Promise<string> {
  return sha256Hex(secret)
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  return crypto.timingSafeEqual(bufA, bufB)
}

export function devicePubKeyToBytes32(devicePubKey: Uint8Array): `0x${string}` {
  if (devicePubKey.length !== 32) {
    throw new Error('device public key must be 32 bytes for bytes32 encoding')
  }
  return `0x${Buffer.from(devicePubKey).toString('hex')}` as `0x${string}`
}

export async function verifyEd25519Signature(
  publicKeyRaw: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    publicKeyRaw,
    { name: 'Ed25519', namedCurve: 'Ed25519' },
    false,
    ['verify'],
  )
  return crypto.subtle.verify({ name: 'Ed25519' }, key, signature, message)
}
