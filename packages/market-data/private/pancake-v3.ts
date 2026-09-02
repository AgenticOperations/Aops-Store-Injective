/**
 * RING 1 · OBSERVATION — read-only, output is a cache
 * `@repo/market-data` — PRIVATE. Not listed in `package.json` `exports`, therefore not
 * importable from outside this package by module resolution, not by convention (`00` §3.1,
 * §3.2: "Name the package after the job. The vendor that currently performs that job lives in
 * `private/` and is never mentioned in an import path outside its own package.").
 *
 * PancakeSwap V3 vendor client: contract addresses, ABIs, and thin `readContract` wrappers.
 * Every address below was checked live against chain (block 117,930,771 mainnet /
 * 127,074,010 testnet) on 2026-08-25 — `docs/final-review-docs/03-category-agent-rebalancing.md`
 * §3. Do not add or change an address here without a citation in `03` or `docs/RESEARCH.md` —
 * `CLAUDE.md`'s "no vendor invention" hard stop.
 *
 * This file returns raw ABI-decoded tuples only. Shaping into a validated, typed public
 * contract (and rejecting a malformed response at the boundary) is `public/pools.ts` /
 * `public/positions.ts` / `public/prices.ts`'s job, not this file's.
 */

import { type Address, type PublicClient, parseAbi } from 'viem'

export type MarketDataNetwork = 'mainnet' | 'testnet'

// -------------------------------------------------------------------------------------------
// Addresses — `03` §3.1, §3.2, §3.7
// -------------------------------------------------------------------------------------------

/** Same address on both BSC mainnet (56) and testnet (97) — `03` §3.1. */
export const PANCAKE_V3_FACTORY_ADDRESS: Address = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865'

export const NPM_ADDRESS: Readonly<Record<MarketDataNetwork, Address>> = {
  mainnet: '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364',
  testnet: '0x427bF5b37357632377eCbEC9de3626C71A5396c1',
}

/**
 * Mainnet only. No verified testnet `MasterChefV3` address exists in `03` §3.7 — do not guess
 * one. (Not a practical gap: `03` §3.6 — testnet liquidity is unstaked/organic, no farmed
 * population there to measure anyway.)
 */
export const MASTER_CHEF_V3_ADDRESS_MAINNET: Address = '0x556B9306565093C855AEA9AE92A594704c2Cd59e'

/** Mainnet only, same citation as above — `03` §3.7. */
export const CAKE_ADDRESS_MAINNET: Address = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82'

// -------------------------------------------------------------------------------------------
// ABIs — human-readable fragments, scoped to exactly the fields `03` §7.1's five reads need.
// Field order verified against `03` §3.1, §3.5, §3.7's live `cast` output.
// -------------------------------------------------------------------------------------------

export const NPM_ABI = parseAbi([
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
])

export const FACTORY_ABI = parseAbi([
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)',
  'function feeAmountTickSpacing(uint24 fee) view returns (int24)',
])

export const POOL_ABI = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint32 feeProtocol, bool unlocked)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)',
  'function liquidity() view returns (uint128)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)',
])

/** `03` §3.7, §6.6 — required in the surface for any staked position; `NPM.decreaseLiquidity`
 * reverts for a position MasterChefV3 owns. */
export const MASTER_CHEF_V3_ABI = parseAbi([
  'function userPositionInfos(uint256 tokenId) view returns (uint128 liquidity, uint128 boostLiquidity, int24 tickLower, int24 tickUpper, uint256 rewardGrowthInside, uint256 reward, address user, uint256 pid, uint256 boostMultiplier)',
  'function pendingCake(uint256 tokenId) view returns (uint256 reward)',
])

// -------------------------------------------------------------------------------------------
// Thin read wrappers — one `readContract` call each, no shaping, no validation. `client` is
// always a parameter, never constructed here, so callers (and this package's own tests) can
// supply either a real `viem` client or a fixture `custom()` transport.
// -------------------------------------------------------------------------------------------

export function readNpmPosition(client: PublicClient, network: MarketDataNetwork, tokenId: bigint) {
  return client.readContract({
    address: NPM_ADDRESS[network],
    abi: NPM_ABI,
    functionName: 'positions',
    args: [tokenId],
  })
}

export function readNpmOwner(client: PublicClient, network: MarketDataNetwork, tokenId: bigint) {
  return client.readContract({
    address: NPM_ADDRESS[network],
    abi: NPM_ABI,
    functionName: 'ownerOf',
    args: [tokenId],
  })
}

export function readPoolSlot0(client: PublicClient, poolAddress: Address) {
  return client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'slot0' })
}

export async function readPoolFeeGrowthGlobal(client: PublicClient, poolAddress: Address) {
  const [feeGrowthGlobal0X128, feeGrowthGlobal1X128] = await Promise.all([
    client.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'feeGrowthGlobal0X128',
    }),
    client.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'feeGrowthGlobal1X128',
    }),
  ])
  return { feeGrowthGlobal0X128, feeGrowthGlobal1X128 }
}

export function readPoolLiquidity(client: PublicClient, poolAddress: Address) {
  return client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'liquidity' })
}

export async function readPoolTokensAndFee(client: PublicClient, poolAddress: Address) {
  const [token0, token1, fee] = await Promise.all([
    client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'token0' }),
    client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'token1' }),
    client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'fee' }),
  ])
  return { token0, token1, fee }
}

/** Token addresses only, no fee read — for callers (`prices.ts`) that don't need the fee tier. */
export async function readPoolTokens(client: PublicClient, poolAddress: Address) {
  const [token0, token1] = await Promise.all([
    client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'token0' }),
    client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'token1' }),
  ])
  return { token0, token1 }
}

export function readPoolTick(client: PublicClient, poolAddress: Address, tick: number) {
  return client.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: 'ticks',
    args: [tick],
  })
}

export function readTickSpacing(client: PublicClient, fee: number) {
  return client.readContract({
    address: PANCAKE_V3_FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: 'feeAmountTickSpacing',
    args: [fee],
  })
}

export function readPoolAddress(
  client: PublicClient,
  tokenA: Address,
  tokenB: Address,
  fee: number,
) {
  return client.readContract({
    address: PANCAKE_V3_FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: 'getPool',
    args: [tokenA, tokenB, fee],
  })
}

/** Mainnet only — see `MASTER_CHEF_V3_ADDRESS_MAINNET`'s citation above. */
export function readStakedPositionInfo(client: PublicClient, tokenId: bigint) {
  return client.readContract({
    address: MASTER_CHEF_V3_ADDRESS_MAINNET,
    abi: MASTER_CHEF_V3_ABI,
    functionName: 'userPositionInfos',
    args: [tokenId],
  })
}

/** Mainnet only — see `MASTER_CHEF_V3_ADDRESS_MAINNET`'s citation above. */
export function readPendingCake(client: PublicClient, tokenId: bigint) {
  return client.readContract({
    address: MASTER_CHEF_V3_ADDRESS_MAINNET,
    abi: MASTER_CHEF_V3_ABI,
    functionName: 'pendingCake',
    args: [tokenId],
  })
}
