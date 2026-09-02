/**
 * RING 1 · OBSERVATION — read-only, output is a cache
 * `@repo/market-data/pools` — public contract. Named exports only.
 *
 * PancakeSwap V3 pool state reads, scoped to exactly what `final-review-docs/03` §7.1's
 * independence-rule read set needs: pool `slot0`, `feeGrowthGlobal{0,1}X128`, and `ticks()`.
 * Point-in-time reads only — this package does not backfill history; that is `apps/watch`'s job
 * (`03` §7.3's ~98-minute oracle-buffer finding).
 *
 * Every response is treated as hostile input and validated at this file's boundary (`00` §6.3) —
 * a malformed or nonsensical response throws a `PoolReadError` here rather than propagating a
 * silently-wrong `PoolState` downstream into `metrics/`.
 */

import type { Address, PublicClient } from 'viem'
import { z } from 'zod'
import {
  readPoolAddress,
  readPoolFeeGrowthGlobal,
  readPoolLiquidity,
  readPoolSlot0,
  readPoolTick,
  readPoolTokensAndFee,
  readTickSpacing,
} from '#private/pancake-v3'

export class PoolReadError extends Error {
  override readonly name = 'PoolReadError'
}

const addressSchema = z.custom<Address>(
  (value): value is Address => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value),
  { message: 'expected a 20-byte hex address' },
)

// -------------------------------------------------------------------------------------------
// slot0 + feeGrowthGlobal + liquidity + tickSpacing — `03` §3.1–§3.3, §7.1
// -------------------------------------------------------------------------------------------

export interface PoolState {
  poolAddress: Address
  token0: Address
  token1: Address
  fee: number
  tickSpacing: number
  sqrtPriceX96: bigint
  tick: number
  observationIndex: number
  observationCardinality: number
  feeGrowthGlobal0X128: bigint
  feeGrowthGlobal1X128: bigint
  liquidity: bigint
}

const poolStateSchema = z
  .object({
    poolAddress: addressSchema,
    token0: addressSchema,
    token1: addressSchema,
    fee: z.number().int().positive(),
    tickSpacing: z.number().int().positive(),
    sqrtPriceX96: z.bigint().nonnegative(),
    tick: z.number().int(),
    observationIndex: z.number().int().nonnegative(),
    observationCardinality: z.number().int().nonnegative(),
    feeGrowthGlobal0X128: z.bigint().nonnegative(),
    feeGrowthGlobal1X128: z.bigint().nonnegative(),
    liquidity: z.bigint().nonnegative(),
  })
  .refine((pool) => pool.token0.toLowerCase() !== pool.token1.toLowerCase(), {
    message: 'token0 and token1 must differ',
  })

/** Point-in-time pool state. `poolAddress` must already be resolved (see `getPoolAddress`
 * below) — this function does not look one up. */
export async function getPoolState(client: PublicClient, poolAddress: Address): Promise<PoolState> {
  let slot0: Awaited<ReturnType<typeof readPoolSlot0>>
  let feeGrowth: Awaited<ReturnType<typeof readPoolFeeGrowthGlobal>>
  let liquidity: Awaited<ReturnType<typeof readPoolLiquidity>>
  let tokensAndFee: Awaited<ReturnType<typeof readPoolTokensAndFee>>
  try {
    ;[slot0, feeGrowth, liquidity, tokensAndFee] = await Promise.all([
      readPoolSlot0(client, poolAddress),
      readPoolFeeGrowthGlobal(client, poolAddress),
      readPoolLiquidity(client, poolAddress),
      readPoolTokensAndFee(client, poolAddress),
    ])
  } catch (cause) {
    throw new PoolReadError(`failed to read pool state at ${poolAddress}`, { cause })
  }

  let tickSpacing: number
  try {
    tickSpacing = await readTickSpacing(client, tokensAndFee.fee)
  } catch (cause) {
    throw new PoolReadError(`failed to read tick spacing for fee ${tokensAndFee.fee}`, { cause })
  }

  const [sqrtPriceX96, tick, observationIndex, observationCardinality] = slot0

  const candidate = {
    poolAddress,
    token0: tokensAndFee.token0,
    token1: tokensAndFee.token1,
    fee: tokensAndFee.fee,
    tickSpacing,
    sqrtPriceX96,
    tick,
    observationIndex,
    observationCardinality,
    feeGrowthGlobal0X128: feeGrowth.feeGrowthGlobal0X128,
    feeGrowthGlobal1X128: feeGrowth.feeGrowthGlobal1X128,
    liquidity,
  }

  const parsed = poolStateSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new PoolReadError(
      `pool response at ${poolAddress} failed validation: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

// -------------------------------------------------------------------------------------------
// ticks() — needed alongside feeGrowthGlobal to compute a LIVE feeGrowthInside for
// `fee_share_achieved` (`03` §7.1, §7.2). `NPM.positions()`'s own
// `feeGrowthInside{0,1}LastX128` is only as fresh as the position's last on-chain interaction.
// -------------------------------------------------------------------------------------------

export interface TickInfo {
  tick: number
  liquidityGross: bigint
  liquidityNet: bigint
  feeGrowthOutside0X128: bigint
  feeGrowthOutside1X128: bigint
  initialized: boolean
}

const tickInfoSchema = z.object({
  tick: z.number().int(),
  liquidityGross: z.bigint().nonnegative(),
  liquidityNet: z.bigint(),
  feeGrowthOutside0X128: z.bigint().nonnegative(),
  feeGrowthOutside1X128: z.bigint().nonnegative(),
  initialized: z.boolean(),
})

export async function getTickInfo(
  client: PublicClient,
  poolAddress: Address,
  tick: number,
): Promise<TickInfo> {
  let raw: Awaited<ReturnType<typeof readPoolTick>>
  try {
    raw = await readPoolTick(client, poolAddress, tick)
  } catch (cause) {
    throw new PoolReadError(`failed to read tick ${tick} at ${poolAddress}`, { cause })
  }
  const [
    liquidityGross,
    liquidityNet,
    feeGrowthOutside0X128,
    feeGrowthOutside1X128,
    ,
    ,
    ,
    initialized,
  ] = raw

  const parsed = tickInfoSchema.safeParse({
    tick,
    liquidityGross,
    liquidityNet,
    feeGrowthOutside0X128,
    feeGrowthOutside1X128,
    initialized,
  })
  if (!parsed.success) {
    throw new PoolReadError(
      `tick response at ${poolAddress}:${tick} failed validation: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

// -------------------------------------------------------------------------------------------
// Factory lookup — `03` §3.1, §3.2. Resolves a pool address from a token pair + fee tier so a
// caller never has to hardcode one.
// -------------------------------------------------------------------------------------------

const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000'

export async function getPoolAddress(
  client: PublicClient,
  tokenA: Address,
  tokenB: Address,
  fee: number,
): Promise<Address> {
  let raw: Address
  try {
    raw = await readPoolAddress(client, tokenA, tokenB, fee)
  } catch (cause) {
    throw new PoolReadError(`failed to resolve pool address for ${tokenA}/${tokenB} fee ${fee}`, {
      cause,
    })
  }
  const parsed = addressSchema.safeParse(raw)
  if (!parsed.success || parsed.data.toLowerCase() === ZERO_ADDRESS) {
    throw new PoolReadError(`factory has no pool for ${tokenA}/${tokenB} fee ${fee}`)
  }
  return parsed.data
}
