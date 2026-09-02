/**
 * E5 — accumulate PancakeSwap V3 pool oracle observations (idempotent append).
 */

import type { DbClient } from '@repo/database/client'
import { poolObservations } from '@repo/database/schema'
import {
  type PoolObservationSnapshot,
  getLatestObservationSnapshot,
} from '@repo/market-data/observe'
import type { Address, PublicClient } from 'viem'

export interface PoolTickDeps {
  db: DbClient
  client: PublicClient
  poolAddress: Address
  /** Injectable for tests — defaults to the real Ring 1 reader. */
  readSnapshot?: typeof getLatestObservationSnapshot
}

export interface PoolTickResult {
  inserted: boolean
  snapshot: PoolObservationSnapshot
}

/** Reads the latest observation snapshot and appends it if not already recorded. */
export async function runPoolTick(deps: PoolTickDeps): Promise<PoolTickResult> {
  const readSnapshot = deps.readSnapshot ?? getLatestObservationSnapshot
  const blockNumber = await deps.client.getBlockNumber()
  const block = await deps.client.getBlock({ blockNumber })
  const blockTimestamp = new Date(Number(block.timestamp) * 1000)

  const snapshot = await readSnapshot(
    deps.client,
    deps.poolAddress,
    blockNumber,
    blockTimestamp,
  )

  const rows = await deps.db
    .insert(poolObservations)
    .values({
      poolAddress: snapshot.poolAddress,
      observationIndex: snapshot.observationIndex,
      blockNumber: snapshot.blockNumber,
      tickCumulative: snapshot.tickCumulative,
      secondsPerLiquidityCumulativeX128: snapshot.secondsPerLiquidityCumulativeX128.toString(),
      blockTimestamp: snapshot.blockTimestamp,
    })
    .onConflictDoNothing({
      target: [
        poolObservations.poolAddress,
        poolObservations.observationIndex,
        poolObservations.blockNumber,
      ],
    })
    .returning({ id: poolObservations.id })

  return { inserted: rows.length > 0, snapshot }
}
