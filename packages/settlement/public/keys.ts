/**
 * RING 3 · IRREVERSIBLE ⚠ — money and authority
 * `@repo/settlement/keys` — environment contract.
 *
 * Validates this package's own variables at startup and fails LOUDLY if any are
 * missing (00 §3.7). Nothing outside this file may read `process.env`.
 * A misconfigured money-tier package must fail at boot, not at signing time.
 */

import { z } from 'zod'

const settlementConfigSchema = z.object({
  /** Flat `PLAIN` escrow fee — milestone plan §2.1 mandates 3–5% (300–500 bps). */
  SETTLEMENT_FEE_BPS: z.coerce.number().int().min(300).max(500).default(400),
  /** `ALTANA_SESSION` performance fee — 10% of net-positive PnL (1000 bps). */
  SETTLEMENT_PERFORMANCE_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(1000),
})

type SettlementConfig = z.infer<typeof settlementConfigSchema>

let cachedConfig: SettlementConfig | null = null

function loadSettlementConfig(): SettlementConfig {
  const parsed = settlementConfigSchema.safeParse(process.env)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`@repo/settlement: invalid configuration — ${details}`)
  }
  return parsed.data
}

function getConfig(): SettlementConfig {
  cachedConfig ??= loadSettlementConfig()
  return cachedConfig
}

/** Basis points for the flat fee taken at `ERC8183_ESCROW` (`PLAIN`) release (default 400 = 4%). */
export function getSettlementFeeBps(): number {
  return getConfig().SETTLEMENT_FEE_BPS
}

/** Basis points for the stated-not-collected `ALTANA_SESSION` performance fee (default 1000 = 10%). */
export function getSettlementPerformanceFeeBps(): number {
  return getConfig().SETTLEMENT_PERFORMANCE_FEE_BPS
}

/** Eager validation for callers that want a hard fail at process boot. */
export function validateSettlementConfig(): SettlementConfig {
  return getConfig()
}

/** Test-only — clears cached config so env changes take effect between test cases. */
export function __resetSettlementConfigCacheForTests(): void {
  cachedConfig = null
}
