import { JTI_TTL_MS } from './constants'

export class JtiCache {
  private readonly seen = new Map<string, number>()

  /** Returns `true` if this `jti` is fresh (unseen), `false` if it is a replay. */
  markSeen(jti: string, now = Date.now()): boolean {
    this.purge(now)
    if (this.seen.has(jti)) return false
    this.seen.set(jti, now + JTI_TTL_MS)
    return true
  }

  purge(now = Date.now()): void {
    for (const [jti, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(jti)
    }
  }

  clear(): void {
    this.seen.clear()
  }
}
