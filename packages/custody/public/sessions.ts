/**
 * RING 3 · IRREVERSIBLE ⚠ — money and authority
 * `@repo/custody/sessions` — public contract. Named exports only.
 *
 * Callable wrappers over an injected Altana client (`final-review-docs/04` §12.2).
 * NOT HTTP — apps/api composes these at a single Ring 3 entry point.
 *
 * Rules (`architecture/00` §6.1):
 *   - simulate by default (`mode` defaults to `'simulate'`)
 *   - broadcast requires explicit `assertNetwork` matching keys config
 *   - mainnet broadcast blocked unless `CUSTODY_ALLOW_MAINNET_BROADCAST=true`
 *   - enforce exactly what the buyer signed — never widen scope/cap (doc 04 §9.2, §12.3)
 *   - vendor failures return `{ ok: false, error }`, never throw
 */
import type { Address, Hex } from 'viem'
import { getAddress, isAddress } from 'viem'
import { z } from 'zod'
import type { AltanaClient } from '#private/altana-client'
import { type CustodyKeys, type CustodyNetwork, loadCustodyKeys } from './keys'

// ---------------------------------------------------------------------------------------------
// Shared result + Keystore shapes — compatible with `@repo/access/bind-session`'s
// `KeystoreEntry` / `ReadKeystoreEntry` injection contract (doc 04 §7.4, §12.5).
// ---------------------------------------------------------------------------------------------

export type CustodyErrorCode =
  | 'INVALID_PARAMS'
  | 'BROADCAST_REQUIRES_NETWORK_ASSERTION'
  | 'NETWORK_ASSERTION_MISMATCH'
  | 'MAINNET_BROADCAST_BLOCKED'
  | 'VENDOR_ERROR'
  | 'EXECUTE_REVERTED'

export interface CustodyError {
  code: CustodyErrorCode
  message: string
}

export type CustodyResult<T> = { ok: true; data: T } | { ok: false; error: CustodyError }

export type KeystoreAuthorizationState = 'valid' | 'revoked' | 'expired'

export interface KeystoreEntry {
  sessionId: string
  authorizedWallet: Address
  state: KeystoreAuthorizationState
  expiresAt: Date | null
}

export type CustodyMode = 'simulate' | 'broadcast'

export interface SpendPermission {
  limit: bigint
  period: 'day' | 'hour'
  token: Address
}

const spendPermissionSchema = z.object({
  limit: z.bigint().nonnegative(),
  period: z.enum(['day', 'hour']),
  token: z.string().refine(isAddress, 'token must be a valid address'),
})

const addressListSchema = z
  .array(z.string().refine(isAddress, 'allowedCalls entries must be valid addresses'))
  .min(1, 'allowedCalls must not be empty')

const grantParamsSchema = z.object({
  allowedCalls: addressListSchema,
  spend: z.array(spendPermissionSchema).min(1, 'spend must include at least one permission'),
  expiry: z.date(),
  authorizedWallet: z.string().refine(isAddress, 'authorizedWallet must be a valid address'),
})

// ---------------------------------------------------------------------------------------------
// Broadcast / simulate guard — Ring 3 protocol (00 §6.1 rules 1–2)
// ---------------------------------------------------------------------------------------------

interface ModeGuardInput {
  mode?: CustodyMode
  assertNetwork?: CustodyNetwork
  keys?: CustodyKeys
}

function resolveMode(
  input: ModeGuardInput,
): CustodyResult<{ simulate: boolean; keys: CustodyKeys }> {
  const mode = input.mode ?? 'simulate'
  const keys = input.keys ?? loadCustodyKeys()

  if (mode === 'simulate') {
    return { ok: true, data: { simulate: true, keys } }
  }

  if (!input.assertNetwork) {
    return {
      ok: false,
      error: {
        code: 'BROADCAST_REQUIRES_NETWORK_ASSERTION',
        message:
          'broadcast mode requires explicit assertNetwork matching CUSTODY_NETWORK — testnet until promoted (00 §6.1)',
      },
    }
  }

  if (input.assertNetwork !== keys.network) {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ASSERTION_MISMATCH',
        message: `assertNetwork ${input.assertNetwork} does not match configured CUSTODY_NETWORK ${keys.network}`,
      },
    }
  }

  if (keys.network === 'bsc_mainnet' && !keys.allowMainnetBroadcast) {
    return {
      ok: false,
      error: {
        code: 'MAINNET_BROADCAST_BLOCKED',
        message:
          'mainnet broadcast blocked — set CUSTODY_ALLOW_MAINNET_BROADCAST=true after explicit human review (00 §6.1)',
      },
    }
  }

  return { ok: true, data: { simulate: false, keys } }
}

function vendorError(message: string): CustodyResult<never> {
  return { ok: false, error: { code: 'VENDOR_ERROR', message } }
}

// ---------------------------------------------------------------------------------------------
// grantSession — mirrors exactly what the buyer signed (doc 04 §12.3)
// ---------------------------------------------------------------------------------------------

export interface GrantSessionInput extends ModeGuardInput {
  client: AltanaClient
  allowedCalls: readonly Address[]
  spend: readonly SpendPermission[]
  expiry: Date
  authorizedWallet: Address
}

export interface GrantSessionData {
  sessionId: string
  sessionKey: Address
  txHash?: Hex | undefined
  mode: CustodyMode
}

/**
 * Grants an Altana session with exactly the signed allowlist, spend cap, and expiry.
 * Never widens scope or cap beyond `params` — custody mirrors, it does not mint authority.
 */
export async function grantSession(
  params: GrantSessionInput,
): Promise<CustodyResult<GrantSessionData>> {
  const modeGuard = resolveMode(params)
  if (!modeGuard.ok) return modeGuard

  const parsed = grantParamsSchema.safeParse({
    allowedCalls: params.allowedCalls,
    spend: params.spend,
    expiry: params.expiry,
    authorizedWallet: params.authorizedWallet,
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PARAMS',
        message: parsed.error.issues.map((i) => i.message).join('; '),
      },
    }
  }

  const allowedCalls = parsed.data.allowedCalls.map((a) => getAddress(a))
  const spend = parsed.data.spend.map((s) => ({
    limit: s.limit,
    period: s.period,
    token: getAddress(s.token),
  }))
  const authorizedWallet = getAddress(parsed.data.authorizedWallet)

  try {
    const result = await params.client.grantSession({
      allowedCalls,
      spend,
      expiry: parsed.data.expiry,
      authorizedWallet,
      simulate: modeGuard.data.simulate,
    })

    return {
      ok: true,
      data: {
        sessionId: result.sessionId,
        sessionKey: result.sessionKey,
        txHash: result.txHash,
        mode: modeGuard.data.simulate ? 'simulate' : 'broadcast',
      },
    }
  } catch (err) {
    return vendorError(err instanceof Error ? err.message : String(err))
  }
}

// ---------------------------------------------------------------------------------------------
// execute — act under an existing session (doc 04 §12.2)
// ---------------------------------------------------------------------------------------------

export interface ExecuteInput extends ModeGuardInput {
  client: AltanaClient
  sessionId: string
  target: Address
  calldata: Hex
  value?: bigint
}

export interface ExecuteData {
  success: boolean
  txHash?: Hex | undefined
  revertReason?: string | undefined
  mode: CustodyMode
}

export async function execute(params: ExecuteInput): Promise<CustodyResult<ExecuteData>> {
  const modeGuard = resolveMode(params)
  if (!modeGuard.ok) return modeGuard

  if (!params.sessionId || !isAddress(params.target)) {
    return {
      ok: false,
      error: { code: 'INVALID_PARAMS', message: 'sessionId and valid target address required' },
    }
  }

  try {
    const result = await params.client.execute({
      sessionId: params.sessionId,
      target: getAddress(params.target),
      calldata: params.calldata,
      value: params.value ?? 0n,
      simulate: modeGuard.data.simulate,
    })

    if (!result.success) {
      return {
        ok: false,
        error: {
          code: 'EXECUTE_REVERTED',
          message: result.revertReason ?? 'execute reverted',
        },
      }
    }

    return {
      ok: true,
      data: {
        success: true,
        txHash: result.txHash,
        mode: modeGuard.data.simulate ? 'simulate' : 'broadcast',
      },
    }
  } catch (err) {
    return vendorError(err instanceof Error ? err.message : String(err))
  }
}

// ---------------------------------------------------------------------------------------------
// revokeSession — one-tx immediate revoke (doc 04 §12.2)
// ---------------------------------------------------------------------------------------------

export interface RevokeSessionInput extends ModeGuardInput {
  client: AltanaClient
  sessionId: string
}

export interface RevokeSessionData {
  sessionId: string
  txHash?: Hex | undefined
  mode: CustodyMode
}

export async function revokeSession(
  params: RevokeSessionInput,
): Promise<CustodyResult<RevokeSessionData>> {
  const modeGuard = resolveMode(params)
  if (!modeGuard.ok) return modeGuard

  if (!params.sessionId) {
    return {
      ok: false,
      error: { code: 'INVALID_PARAMS', message: 'sessionId required' },
    }
  }

  try {
    const result = await params.client.revokeSession({
      sessionId: params.sessionId,
      simulate: modeGuard.data.simulate,
    })

    return {
      ok: true,
      data: {
        sessionId: params.sessionId,
        txHash: result.txHash,
        mode: modeGuard.data.simulate ? 'simulate' : 'broadcast',
      },
    }
  } catch (err) {
    return vendorError(err instanceof Error ? err.message : String(err))
  }
}

// ---------------------------------------------------------------------------------------------
// readKeystoreEntry — authorization state for `@repo/access` bind-session (doc 04 §7.4)
// ---------------------------------------------------------------------------------------------

export interface ReadKeystoreEntryInput {
  sessionId: string
  client: AltanaClient
}

/** Reads Keystore authorization state only — no spend/budget fields (doc 04 §12.5). */
export async function readKeystoreEntry(
  params: ReadKeystoreEntryInput,
): Promise<CustodyResult<KeystoreEntry | null>> {
  if (!params.sessionId) {
    return {
      ok: false,
      error: { code: 'INVALID_PARAMS', message: 'sessionId required' },
    }
  }

  try {
    const raw = await params.client.readKeystoreEntry(params.sessionId)
    if (!raw) {
      return { ok: true, data: null }
    }

    return {
      ok: true,
      data: {
        sessionId: raw.sessionId,
        authorizedWallet: raw.authorizedWallet,
        state: raw.state,
        expiresAt: raw.expiresAt,
      },
    }
  } catch (err) {
    return vendorError(err instanceof Error ? err.message : String(err))
  }
}
