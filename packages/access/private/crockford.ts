/** Crockford base32 alphabet — `04` §8.1 (`kid`, 22 chars, no I/L/O/U). */
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function encodeCrockfordBase32(bytes: Uint8Array, length: number): string {
  let value = 0n
  let bits = 0
  let output = ''

  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte)
    bits += 8
    while (bits >= 5 && output.length < length) {
      bits -= 5
      const index = Number((value >> BigInt(bits)) & 0x1fn)
      output += CROCKFORD_ALPHABET[index]
    }
  }

  if (output.length < length && bits > 0) {
    const index = Number((value << BigInt(5 - bits)) & 0x1fn)
    output += CROCKFORD_ALPHABET[index]
  }

  while (output.length < length) {
    output += CROCKFORD_ALPHABET[0]
  }

  return output.slice(0, length)
}

export function generateKid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return encodeCrockfordBase32(bytes, 22)
}
