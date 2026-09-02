import { CHALLENGE_TTL_MS } from './constants'

export interface StoredNonce {
  wallet: string
  devicePubKey: string
  issuedAt: bigint
  expiresAt: number
  used: boolean
}

export class NonceStore {
  private readonly entries = new Map<string, StoredNonce>()

  put(nonce: string, entry: Omit<StoredNonce, 'used'>): void {
    this.entries.set(nonce, { ...entry, used: false })
  }

  consume(
    nonce: string,
    wallet: string,
    devicePubKey: string,
    now = Date.now(),
  ): StoredNonce | null {
    const entry = this.entries.get(nonce)
    if (!entry) return null
    if (entry.used) return null
    if (entry.expiresAt <= now) return null
    if (entry.wallet.toLowerCase() !== wallet.toLowerCase()) return null
    if (entry.devicePubKey !== devicePubKey) return null
    entry.used = true
    return entry
  }

  purgeExpired(now = Date.now()): void {
    for (const [nonce, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(nonce)
    }
  }

  /** Test helper — not part of the public contract. */
  clear(): void {
    this.entries.clear()
  }
}

export function nonceExpiresAt(now = Date.now()): number {
  return now + CHALLENGE_TTL_MS
}
