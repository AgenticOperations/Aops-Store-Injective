/**
 * `@app/watch` environment — validated once at startup.
 */

import { z } from 'zod'
import type { MarketDataNetwork } from '@repo/market-data/positions'

/** WBNB/USDT 0.01% on BSC testnet — `final-review-docs/03` §7.3 verification log. */
export const DEFAULT_WATCH_POOL_ADDRESS =
  '0x6805E0E5333c5c3acCF2930Be4734E2b98f4Ce06' as const

const envSchema = z.object({
  WATCH_POOL_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default(DEFAULT_WATCH_POOL_ADDRESS),
  WATCH_NETWORK: z.enum(['mainnet', 'testnet']).default('testnet'),
  WATCH_POOL_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  WATCH_ENDPOINT_INTERVAL_MS: z.coerce.number().int().positive().default(120_000),
})

export interface WatchConfig {
  poolAddress: `0x${string}`
  network: MarketDataNetwork
  poolIntervalMs: number
  endpointIntervalMs: number
}

let cachedConfig: WatchConfig | null = null

export function getWatchConfig(): WatchConfig {
  if (cachedConfig) return cachedConfig

  const parsed = envSchema.safeParse({
    WATCH_POOL_ADDRESS: process.env.WATCH_POOL_ADDRESS,
    WATCH_NETWORK: process.env.WATCH_NETWORK,
    WATCH_POOL_INTERVAL_MS: process.env.WATCH_POOL_INTERVAL_MS,
    WATCH_ENDPOINT_INTERVAL_MS: process.env.WATCH_ENDPOINT_INTERVAL_MS,
  })

  if (!parsed.success) {
    throw new Error(`@app/watch: invalid environment — ${parsed.error.message}`)
  }

  cachedConfig = {
    poolAddress: parsed.data.WATCH_POOL_ADDRESS as `0x${string}`,
    network: parsed.data.WATCH_NETWORK,
    poolIntervalMs: parsed.data.WATCH_POOL_INTERVAL_MS,
    endpointIntervalMs: parsed.data.WATCH_ENDPOINT_INTERVAL_MS,
  }
  return cachedConfig
}

/** Test-only reset so env changes between cases are observed. */
export function resetWatchConfigForTests(): void {
  cachedConfig = null
}
