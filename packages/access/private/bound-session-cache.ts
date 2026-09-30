/** Read-through cache of bound-session liveness — `04` §9.3. May false-reject, never false-approve. */
export interface BoundSessionCacheEntry {
  isLive: boolean
  checkedAt: number
}

export class BoundSessionCache {
  private readonly entries = new Map<string, BoundSessionCacheEntry>()

  get(credentialId: string): BoundSessionCacheEntry | undefined {
    return this.entries.get(credentialId)
  }

  set(credentialId: string, entry: BoundSessionCacheEntry): void {
    this.entries.set(credentialId, entry)
  }

  delete(credentialId: string): void {
    this.entries.delete(credentialId)
  }

  clear(): void {
    this.entries.clear()
  }
}
