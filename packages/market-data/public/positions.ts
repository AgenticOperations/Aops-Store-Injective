/**
 * RING 1 · OBSERVATION — read-only, output is a cache
 * `@repo/market-data/positions` — public contract. Named exports only.
 *
 * `NonfungiblePositionManager.positions(tokenId)` and, for a staked position,
 * `MasterChefV3.userPositionInfos(tokenId)` / `pendingCake(tokenId)` — two of `final-review-docs/
 * 03` §7.1's five independence-rule reads. Any tokenId is readable with no permission and no
 * cooperation from its owner (`03` §3.5) — this is the technical basis of §7.4's shadow
 * measurement.
 *
 * `03` §3.7/§6.6: a large share of managed V3 liquidity on mainnet is owned by `MasterChefV3`,
 * not by the person who created it. `getPosition` reports whether a position is staked there;
 * callers must call `getStakedPositionInfo` too for a staked position's live liquidity/reward
 * state (`NPM.positions()` alone is stale/uninformative for CAKE emissions).
 *
 * Every response is hostile input, validated at this file's boundary (`00` §6.3) — a malformed
 * or nonsensical response throws a `PositionReadError` here rather than propagating downstream.
 */

import type { Address, PublicClient } from 'viem'
import { z } from 'zod'
import {
  MASTER_CHEF_V3_ADDRESS_MAINNET,
  type MarketDataNetwork,
  readNpmOwner,
  readNpmPosition,
  readPendingCake,
  readStakedPositionInfo,
} from '#private/pancake-v3'

export type { MarketDataNetwork } from '#private/pancake-v3'

export class PositionReadError extends Error {
  override readonly name = 'PositionReadError'
}

const addressSchema = z.custom<Address>(
  (value): value is Address => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value),
  { message: 'expected a 20-byte hex address' },
)

// -------------------------------------------------------------------------------------------
// NPM.positions() + ownerOf() — `03` §3.1, §3.5, §3.7
//
// `tickLower`/`tickUpper` here are the exact shape `@repo/metrics`'s `PositionRange` expects
// (`packages/metrics/public/kpi.ts`), so a later chunk can pass this straight through without
// remapping — this package does not import `@repo/metrics` itself (Ring 1 may not import
// Ring 0's sibling that way; wiring is a later chunk's job, not this one's).
// -------------------------------------------------------------------------------------------

export interface PositionState {
  tokenId: bigint
  owner: Address
  /** `true` iff `owner` is `MasterChefV3` on mainnet (`03` §3.7). Always `false` on testnet —
   * no verified `MasterChefV3` testnet address exists to check against. */
  isStakedInMasterChef: boolean
  token0: Address
  token1: Address
  fee: number
  tickLower: number
  tickUpper: number
  liquidity: bigint
  feeGrowthInside0LastX128: bigint
  feeGrowthInside1LastX128: bigint
  tokensOwed0: bigint
  tokensOwed1: bigint
}

const positionStateSchema = z
  .object({
    tokenId: z.bigint().nonnegative(),
    owner: addressSchema,
    isStakedInMasterChef: z.boolean(),
    token0: addressSchema,
    token1: addressSchema,
    fee: z.number().int().positive(),
    tickLower: z.number().int(),
    tickUpper: z.number().int(),
    liquidity: z.bigint().nonnegative(),
    feeGrowthInside0LastX128: z.bigint().nonnegative(),
    feeGrowthInside1LastX128: z.bigint().nonnegative(),
    tokensOwed0: z.bigint().nonnegative(),
    tokensOwed1: z.bigint().nonnegative(),
  })
  .refine((p) => p.tickUpper > p.tickLower, { message: 'tickUpper must be greater than tickLower' })

export async function getPosition(
  client: PublicClient,
  network: MarketDataNetwork,
  tokenId: bigint,
): Promise<PositionState> {
  let rawPosition: Awaited<ReturnType<typeof readNpmPosition>>
  let owner: Address
  try {
    ;[rawPosition, owner] = await Promise.all([
      readNpmPosition(client, network, tokenId),
      readNpmOwner(client, network, tokenId),
    ])
  } catch (cause) {
    throw new PositionReadError(`failed to read NPM position ${tokenId} on ${network}`, { cause })
  }

  const [
    ,
    ,
    token0,
    token1,
    fee,
    tickLower,
    tickUpper,
    liquidity,
    feeGrowthInside0LastX128,
    feeGrowthInside1LastX128,
    tokensOwed0,
    tokensOwed1,
  ] = rawPosition

  const isStakedInMasterChef =
    network === 'mainnet' && owner.toLowerCase() === MASTER_CHEF_V3_ADDRESS_MAINNET.toLowerCase()

  const candidate = {
    tokenId,
    owner,
    isStakedInMasterChef,
    token0,
    token1,
    fee,
    tickLower,
    tickUpper,
    liquidity,
    feeGrowthInside0LastX128,
    feeGrowthInside1LastX128,
    tokensOwed0,
    tokensOwed1,
  }

  const parsed = positionStateSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new PositionReadError(
      `NPM position ${tokenId} failed validation: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

// -------------------------------------------------------------------------------------------
// MasterChefV3.userPositionInfos() + pendingCake() — `03` §3.7, §6.6, §7.1. Mainnet only — see
// `MASTER_CHEF_V3_ADDRESS_MAINNET`'s citation in `private/pancake-v3.ts`.
// -------------------------------------------------------------------------------------------

export interface StakedPositionState {
  tokenId: bigint
  liquidity: bigint
  boostLiquidity: bigint
  tickLower: number
  tickUpper: number
  rewardGrowthInside: bigint
  /** Live-computed pending CAKE (`03` §3.7's `pendingCake` read) — this is the number `03`
   * §7.2's `net_of_cost_apr` cites, not `userPositionInfos`'s stored `reward` field. */
  pendingRewardCakeAmount: bigint
  /** The account that staked the position — `userPositionInfos`'s `user` field. Not
   * `MasterChefV3` itself; that's the on-chain NFT owner, this is who it's staked for. */
  staker: Address
  poolId: bigint
  boostMultiplier: bigint
}

const stakedPositionStateSchema = z
  .object({
    tokenId: z.bigint().nonnegative(),
    liquidity: z.bigint().nonnegative(),
    boostLiquidity: z.bigint().nonnegative(),
    tickLower: z.number().int(),
    tickUpper: z.number().int(),
    rewardGrowthInside: z.bigint().nonnegative(),
    pendingRewardCakeAmount: z.bigint().nonnegative(),
    staker: addressSchema,
    poolId: z.bigint().nonnegative(),
    boostMultiplier: z.bigint().nonnegative(),
  })
  .refine((p) => p.tickUpper > p.tickLower, { message: 'tickUpper must be greater than tickLower' })

/**
 * A staked position can be live (`liquidity > 0`) or a stale, emptied-but-still-staked shell
 * (`liquidity === 0`, `pendingRewardCakeAmount === 0`) — `03` §3.7 observed both on live
 * mainnet data. Both are valid, honest results; this function does not filter either out.
 */
export async function getStakedPositionInfo(
  client: PublicClient,
  tokenId: bigint,
): Promise<StakedPositionState> {
  let raw: Awaited<ReturnType<typeof readStakedPositionInfo>>
  let pendingRewardCakeAmount: bigint
  try {
    ;[raw, pendingRewardCakeAmount] = await Promise.all([
      readStakedPositionInfo(client, tokenId),
      readPendingCake(client, tokenId),
    ])
  } catch (cause) {
    throw new PositionReadError(`failed to read MasterChefV3 position ${tokenId}`, { cause })
  }

  const [
    liquidity,
    boostLiquidity,
    tickLower,
    tickUpper,
    rewardGrowthInside,
    ,
    staker,
    poolId,
    boostMultiplier,
  ] = raw

  const candidate = {
    tokenId,
    liquidity,
    boostLiquidity,
    tickLower,
    tickUpper,
    rewardGrowthInside,
    pendingRewardCakeAmount,
    staker,
    poolId,
    boostMultiplier,
  }

  const parsed = stakedPositionStateSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new PositionReadError(
      `MasterChefV3 position ${tokenId} failed validation: ${parsed.error.message}`,
    )
  }
  return parsed.data
}
