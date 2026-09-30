/**
 * RING 1 · OBSERVATION — read-only, output is a cache
 * `@repo/market-data/prices` — public contract. Named exports only.
 *
 * `OraclePrice` and `DexQuote` are kept as distinct types here and are never interchanged —
 * `docs/architecture/00-repo-architecture-and-agent-conventions.md` §2.1's package-tree note on
 * `market-data`. An oracle price is the pool's own implied spot price; a DEX quote is an actual
 * executable swap price for a given input amount. Conflating them would silently let a
 * pre-slippage number stand in for one a buyer could actually get.
 */

import type { Address, PublicClient } from 'viem'
import { z } from 'zod'
import { readPoolSlot0, readPoolTokens } from '#private/pancake-v3'

export class PriceReadError extends Error {
  override readonly name = 'PriceReadError'
}

const addressSchema = z.custom<Address>(
  (value): value is Address => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value),
  { message: 'expected a 20-byte hex address' },
)

// -------------------------------------------------------------------------------------------
// OraclePrice — implemented. Derived from pool `slot0`, `03` §3.3's exact convention.
// -------------------------------------------------------------------------------------------

export interface OraclePrice {
  poolAddress: Address
  token0: Address
  token1: Address
  tick: number
  sqrtPriceX96: bigint
  /** `(sqrtPriceX96 / 2^96)^2` — price of token1 denominated in token0, BEFORE any decimals
   * adjustment (`03` §3.3: "the decimals trap ... will bite on any pair involving USDC-style
   * tokens"). Callers must apply token decimals themselves — this package has no ERC-20
   * metadata read, and none is needed by `03` §7's KPI set. */
  price1Per0Raw: number
}

const oraclePriceSchema = z.object({
  poolAddress: addressSchema,
  token0: addressSchema,
  token1: addressSchema,
  tick: z.number().int(),
  sqrtPriceX96: z.bigint().positive(),
  price1Per0Raw: z.number().finite().nonnegative(),
})

/** The pool's own implied spot price at the current block — NOT an executable quote. See
 * `DexQuote` below for why the two are never returned by the same function. */
export async function getOraclePrice(
  client: PublicClient,
  poolAddress: Address,
): Promise<OraclePrice> {
  let slot0: Awaited<ReturnType<typeof readPoolSlot0>>
  let tokens: Awaited<ReturnType<typeof readPoolTokens>>
  try {
    ;[slot0, tokens] = await Promise.all([
      readPoolSlot0(client, poolAddress),
      readPoolTokens(client, poolAddress),
    ])
  } catch (cause) {
    throw new PriceReadError(`failed to read oracle price at ${poolAddress}`, { cause })
  }

  const [sqrtPriceX96, tick] = slot0
  // price(token1/token0) = (sqrtPriceX96 / 2^96)^2 — `03` §3.3's exact worked example.
  const price1Per0Raw = (Number(sqrtPriceX96) / 2 ** 96) ** 2

  const candidate = {
    poolAddress,
    token0: tokens.token0,
    token1: tokens.token1,
    tick,
    sqrtPriceX96,
    price1Per0Raw,
  }

  const parsed = oraclePriceSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new PriceReadError(
      `oracle price at ${poolAddress} failed validation: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

// -------------------------------------------------------------------------------------------
// DexQuote — type declared, NOT implemented this chunk.
// -------------------------------------------------------------------------------------------

/**
 * An actual executable swap price for a given input amount — e.g. a `QuoterV2.quoteExactInput`
 * simulation. Distinct from `OraclePrice` on purpose: an oracle price ignores slippage and pool
 * depth, a DEX quote does not.
 *
 * NOT IMPLEMENTED in this chunk. `final-review-docs/03` §7.1's five independence-rule reads
 * (the scope this package is built to) do not require an executable quote, only the
 * pool-implied spot price (`getOraclePrice` above) — `pool_viability_margin` and every other
 * `03` §7.2 KPI are computed from `slot0`/`feeGrowthGlobal`/`ticks`/positions, never from a
 * quote. No verified `QuoterV2` (or equivalent) address exists in `03` or `docs/RESEARCH.md` at
 * time of writing, so one is not guessed here — `CLAUDE.md`'s "no vendor invention" hard stop.
 *
 * The type is declared now, exported, and left unimplemented so a later addition cannot
 * silently reuse `OraclePrice` in `DexQuote`'s place.
 */
export interface DexQuote {
  poolAddress: Address
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  amountOut: bigint
}
