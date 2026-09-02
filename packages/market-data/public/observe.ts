/**
 * RING 1 · OBSERVATION — read-only, output is a cache
 * `@repo/market-data/observe` — public contract. Named exports only.
 *
 * Pool oracle observation reads for `apps/watch` E5 accumulation.
 */

import type { Address, PublicClient } from 'viem'
import { readPoolObserve, readPoolSlot0 } from '#private/pancake-v3'

export interface PoolObservationSnapshot {
  poolAddress: Address
  observationIndex: number
  blockNumber: bigint
  tickCumulative: bigint
  secondsPerLiquidityCumulativeX128: bigint
  blockTimestamp: Date
}

/**
 * Reads the latest oracle observation snapshot for a pool. Uses `slot0` for the current
 * observation index and `observe([0])` for the tick cumulative at the present block.
 */
export async function getLatestObservationSnapshot(
  client: PublicClient,
  poolAddress: Address,
  blockNumber: bigint,
  blockTimestamp: Date,
): Promise<PoolObservationSnapshot> {
  const slot0 = await readPoolSlot0(client, poolAddress)
  const observationIndex = slot0[2]
  const [tickCumulatives, secondsPerLiquidityCumulativeX128s] = await readPoolObserve(
    client,
    poolAddress,
    [0],
  )

  return {
    poolAddress,
    observationIndex,
    blockNumber,
    tickCumulative: tickCumulatives[0] ?? 0n,
    secondsPerLiquidityCumulativeX128: secondsPerLiquidityCumulativeX128s[0] ?? 0n,
    blockTimestamp,
  }
}
