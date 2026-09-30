/** In-process binding of a credential to an on-chain session id — written by `bindSession`. */
export interface BoundSessionRecord {
  sessionId: string
  sessionExpiresAt: Date | null
  boundAt: number
}

const bindings = new Map<string, BoundSessionRecord>()

export function setBoundSession(credentialId: string, record: BoundSessionRecord): void {
  bindings.set(credentialId, record)
}

export function getBoundSession(credentialId: string): BoundSessionRecord | undefined {
  return bindings.get(credentialId)
}

export function clearBoundSession(credentialId: string): void {
  bindings.delete(credentialId)
}

export function findCredentialIdsBySession(sessionId: string): string[] {
  const ids: string[] = []
  for (const [credentialId, record] of bindings) {
    if (record.sessionId === sessionId) ids.push(credentialId)
  }
  return ids
}

/** Test helper. */
export function clearAllBoundSessions(): void {
  bindings.clear()
}
