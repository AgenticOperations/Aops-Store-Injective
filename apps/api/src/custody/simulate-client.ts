import type { Address, Hex } from 'viem'

type KeystoreState = 'valid' | 'revoked' | 'expired'

interface KeystoreRecord {
  sessionId: string
  authorizedWallet: Address
  state: KeystoreState
  expiresAt: Date | null
  allowedCalls: readonly Address[]
  spend: readonly { limit: bigint; period: 'day' | 'hour'; token: Address }[]
}

/** Minimal in-memory Altana client for simulate-mode API composition (doc 04 §12.2). */
export interface SimulateAltanaClient {
  grantSession(input: {
    allowedCalls: readonly Address[]
    spend: readonly { limit: bigint; period: 'day' | 'hour'; token: Address }[]
    expiry: Date
    authorizedWallet: Address
    simulate: boolean
  }): Promise<{ sessionId: string; sessionKey: Address; txHash?: Hex }>
  execute(input: {
    sessionId: string
    target: Address
    calldata: Hex
    value: bigint
    simulate: boolean
  }): Promise<{ success: boolean; txHash?: Hex; revertReason?: string }>
  revokeSession(input: { sessionId: string; simulate: boolean }): Promise<{ txHash?: Hex }>
  readKeystoreEntry(sessionId: string): Promise<KeystoreRecord | null>
}

export function createSimulateAltanaClient(): SimulateAltanaClient {
  const sessions = new Map<string, KeystoreRecord>()
  let sessionCounter = 0

  return {
    async grantSession(input) {
      sessionCounter += 1
      const sessionId = `sim-session-${sessionCounter}`
      const sessionKey = `0x${String(sessionCounter).padStart(40, '0')}` as Address
      sessions.set(sessionId, {
        sessionId,
        authorizedWallet: input.authorizedWallet,
        state: 'valid',
        expiresAt: input.expiry,
        allowedCalls: [...input.allowedCalls],
        spend: input.spend.map((s) => ({ ...s })),
      })
      return input.simulate ? { sessionId, sessionKey } : { sessionId, sessionKey, txHash: `0xgrant${sessionCounter}` as Hex }
    },

    async execute(input) {
      const record = sessions.get(input.sessionId)
      if (!record || record.state !== 'valid') {
        return { success: false, revertReason: 'SESSION_NOT_VALID' }
      }
      return input.simulate ? { success: true } : { success: true, txHash: '0xexec' as Hex }
    },

    async revokeSession(input) {
      const record = sessions.get(input.sessionId)
      if (record) record.state = 'revoked'
      return input.simulate ? {} : { txHash: '0xrevoke' as Hex }
    },

    async readKeystoreEntry(sessionId) {
      return sessions.get(sessionId) ?? null
    },
  }
}
