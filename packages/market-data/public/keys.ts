/**
 * RING 1 · OBSERVATION — read-only, output is a cache
 * `@repo/market-data/keys` — environment contract.
 *
 * Validates this package's own variables at startup and fails LOUDLY if any are
 * missing (00 §3.7). Nothing outside this file may read `process.env`.
 * A misconfigured money-tier package must fail at boot, not at signing time.
 *
 * Defaults to the same public BSC endpoints `final-review-docs/03` §3's verification log used
 * (`https://bsc-dataseed.bnbchain.org` / `https://bsc-testnet-dataseed.bnbchain.org`), so an
 * unconfigured environment still works for read-only calls. A genuinely malformed override
 * (not a URL) fails loudly here, not at the first `eth_call`.
 */

import { http, type PublicClient, createPublicClient } from 'viem'
import { bsc, bscTestnet } from 'viem/chains'
import { z } from 'zod'
import type { MarketDataNetwork } from '#private/pancake-v3'

const envSchema = z.object({
  BSC_MAINNET_RPC_URL: z.string().url().default('https://bsc-dataseed.bnbchain.org'),
  BSC_TESTNET_RPC_URL: z.string().url().default('https://bsc-testnet-dataseed.bnbchain.org'),
})

export type MarketDataEnv = z.infer<typeof envSchema>

let cachedEnv: MarketDataEnv | null = null

/** Parses and memoizes this package's environment. Throws with the zod error message on a
 * malformed override — never silently falls back past a value the caller explicitly set wrong. */
export function getMarketDataEnv(): MarketDataEnv {
  if (cachedEnv) return cachedEnv
  const parsed = envSchema.safeParse({
    BSC_MAINNET_RPC_URL: process.env.BSC_MAINNET_RPC_URL,
    BSC_TESTNET_RPC_URL: process.env.BSC_TESTNET_RPC_URL,
  })
  if (!parsed.success) {
    throw new Error(`@repo/market-data: invalid environment — ${parsed.error.message}`)
  }
  cachedEnv = parsed.data
  return cachedEnv
}

/**
 * Ready-to-use `viem` `PublicClient` for the given network, built from the validated
 * environment above (`00` §3.6 — an instance, since the package can configure itself).
 *
 * Every `positions`/`pools`/`prices` read function takes a `PublicClient` as a parameter
 * instead of constructing its own, specifically so this package's own tests can supply a
 * fixture transport in place of this one. Real callers (`apps/watch`, later chunks) use this
 * factory; this package's tests never do.
 */
export function createMarketDataClient(network: MarketDataNetwork): PublicClient {
  const env = getMarketDataEnv()
  const chain = network === 'mainnet' ? bsc : bscTestnet
  const rpcUrl = network === 'mainnet' ? env.BSC_MAINNET_RPC_URL : env.BSC_TESTNET_RPC_URL
  return createPublicClient({ chain, transport: http(rpcUrl) })
}
