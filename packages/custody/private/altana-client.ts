/**
 * RING 3 · IRREVERSIBLE ⚠ — money and authority
 * `@repo/custody/private/altana-client` — vendor boundary.
 *
 * Altana SDK surface per `final-review-docs/04` §12.2. Real SDK wiring is deferred —
 * the exact `@altananetwork/sdk` API is not confirmed in cited docs for this chunk;
 * callers inject a client; tests use `createFixtureAltanaClient()`.
 *
 * OPEN ITEM: wire `createAltanaClient()` to `@altananetwork/sdk` once API is confirmed.
 */
import type { Address, Hex } from 'viem'

/** Keystore exposes authorization state only — doc 04 §12.5. */
export type FixtureKeystoreState = 'valid' | 'revoked' | 'expired'

export interface FixtureKeystoreRecord {
  sessionId: string
  authorizedWallet: Address
  state: FixtureKeystoreState
  expiresAt: Date | null
  /** Exact grant params stored at grant time — custody never widens these. */
  allowedCalls: readonly Address[]
  spend: readonly FixtureSpendPermission[]
}

export interface FixtureSpendPermission {
  limit: bigint
  period: 'day' | 'hour'
  token: Address
}

export interface AltanaGrantSessionInput {
  allowedCalls: readonly Address[]
  spend: readonly FixtureSpendPermission[]
  expiry: Date
  authorizedWallet: Address
  simulate: boolean
}

export interface AltanaGrantSessionOutput {
  sessionId: string
  sessionKey: Address
  txHash?: Hex | undefined
}

export interface AltanaExecuteInput {
  sessionId: string
  target: Address
  calldata: Hex
  value: bigint
  simulate: boolean
}

export interface AltanaExecuteOutput {
  txHash?: Hex | undefined
  success: boolean
  revertReason?: string | undefined
}

export interface AltanaRevokeSessionInput {
  sessionId: string
  simulate: boolean
}

export interface AltanaRevokeSessionOutput {
  txHash?: Hex | undefined
}

/** Vendor client surface — `final-review-docs/04` §12.2 subset used by custody v1. */
export interface AltanaClient {
  grantSession(input: AltanaGrantSessionInput): Promise<AltanaGrantSessionOutput>
  execute(input: AltanaExecuteInput): Promise<AltanaExecuteOutput>
  revokeSession(input: AltanaRevokeSessionInput): Promise<AltanaRevokeSessionOutput>
  readKeystoreEntry(sessionId: string): Promise<FixtureKeystoreRecord | null>
}

export interface FixtureAltanaClientState {
  sessions: Map<string, FixtureKeystoreRecord>
  sessionKeys: Map<string, Address>
  executeLog: AltanaExecuteInput[]
}

/** In-memory Altana client for unit tests and simulate-mode development. */
export function createFixtureAltanaClient(
  initial?: Partial<FixtureAltanaClientState>,
): AltanaClient & { state: FixtureAltanaClientState } {
  const state: FixtureAltanaClientState = {
    sessions: initial?.sessions ?? new Map(),
    sessionKeys: initial?.sessionKeys ?? new Map(),
    executeLog: initial?.executeLog ?? [],
  }

  let sessionCounter = state.sessions.size

  return {
    state,
    async grantSession(input) {
      sessionCounter += 1
      const sessionId = `fixture-session-${sessionCounter}`
      const sessionKey = `0x${String(sessionCounter).padStart(40, '0')}` as Address

      const record: FixtureKeystoreRecord = {
        sessionId,
        authorizedWallet: input.authorizedWallet,
        state: 'valid',
        expiresAt: input.expiry,
        allowedCalls: [...input.allowedCalls],
        spend: input.spend.map((s) => ({ ...s })),
      }

      state.sessions.set(sessionId, record)
      state.sessionKeys.set(sessionId, sessionKey)

      return {
        sessionId,
        sessionKey,
        txHash: input.simulate ? undefined : (`0xgrant${sessionCounter}` as Hex),
      }
    },

    async execute(input) {
      state.executeLog.push({ ...input })
      const record = state.sessions.get(input.sessionId)
      if (!record || record.state !== 'valid') {
        return { success: false, revertReason: 'SESSION_NOT_VALID', txHash: undefined }
      }
      if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
        return { success: false, revertReason: 'SESSION_EXPIRED', txHash: undefined }
      }
      const allowed = record.allowedCalls.some(
        (a) => a.toLowerCase() === input.target.toLowerCase(),
      )
      if (!allowed) {
        return { success: false, revertReason: 'CALL_NOT_ALLOWED', txHash: undefined }
      }
      return {
        success: true,
        txHash: input.simulate ? undefined : (`0xexec${state.executeLog.length}` as Hex),
      }
    },

    async revokeSession(input) {
      const record = state.sessions.get(input.sessionId)
      if (!record) {
        return { txHash: undefined }
      }
      record.state = 'revoked'
      return {
        txHash: input.simulate ? undefined : (`0xrevoke${input.sessionId.slice(-4)}` as Hex),
      }
    },

    async readKeystoreEntry(sessionId) {
      return state.sessions.get(sessionId) ?? null
    },
  }
}
