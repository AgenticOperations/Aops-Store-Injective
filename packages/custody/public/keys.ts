/**
 * RING 3 · IRREVERSIBLE ⚠ — money and authority
 * `@repo/custody/keys` — environment contract.
 *
 * Validates this package's own variables at startup and fails LOUDLY if any are
 * missing or malformed (`architecture/00` §6.1 rules 2 & 4, §3.7). Nothing outside
 * this file may read `process.env`. A misconfigured money-tier package must fail at
 * boot, not at signing time.
 */
import { z } from 'zod'

export const CUSTODY_NETWORKS = ['bsc_testnet', 'bsc_mainnet'] as const
export type CustodyNetwork = (typeof CUSTODY_NETWORKS)[number]

const EnvSchema = z.object({
  /** Target chain for custody operations. Defaults to testnet until an explicit,
   * separate promotion (`architecture/00` §6.1 rule 2). */
  CUSTODY_NETWORK: z.enum(CUSTODY_NETWORKS).default('bsc_testnet'),
  /** Mainnet broadcast is blocked unless this is the literal string `true`. Testnet
   * broadcast does not require this flag. */
  CUSTODY_ALLOW_MAINNET_BROADCAST: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

export interface CustodyKeys {
  network: CustodyNetwork
  allowMainnetBroadcast: boolean
}

/**
 * Reads and validates this package's own environment variables. Fails loudly (throws)
 * if anything required is missing or malformed — call once at process startup from the
 * composing app, not per-request. Accepts an explicit `env` for testability; defaults
 * to `process.env`.
 */
export function loadCustodyKeys(
  env: Record<string, string | undefined> = process.env,
): CustodyKeys {
  const parsed = EnvSchema.safeParse({
    CUSTODY_NETWORK: env.CUSTODY_NETWORK,
    CUSTODY_ALLOW_MAINNET_BROADCAST: env.CUSTODY_ALLOW_MAINNET_BROADCAST,
  })
  if (!parsed.success) {
    throw new Error(
      `@repo/custody: invalid or missing environment variables — ${parsed.error.message}`,
    )
  }
  return {
    network: parsed.data.CUSTODY_NETWORK,
    allowMainnetBroadcast: parsed.data.CUSTODY_ALLOW_MAINNET_BROADCAST ?? false,
  }
}

/** Boot-time config — importing this module validates env immediately. */
export const custodyKeys = loadCustodyKeys()
