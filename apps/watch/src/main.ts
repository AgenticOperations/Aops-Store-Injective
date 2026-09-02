/**
 * `@app/watch` — the one always-on process (00 §5.1).
 *
 * Detects conditions and enqueues jobs. Holds no keys and has no import path to Ring 3.
 */

import { createDbClient } from '@repo/database/client'
import { getDatabaseUrl } from '@repo/database/keys'
import { createMarketDataClient } from '@repo/market-data/keys'
import { getWatchConfig } from './config'
import { createEndpointLivenessState, runEndpointLivenessCheck } from './endpoint-liveness'
import { runPoolTick } from './pool-tick'

const shutdown = new AbortController()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => shutdown.abort())
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

async function runIntervalLoop(
  label: string,
  intervalMs: number,
  signal: AbortSignal,
  tick: () => Promise<void>,
): Promise<void> {
  while (!signal.aborted) {
    try {
      await tick()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(`[@app/watch] ${label} tick failed: ${message}\n`)
    }
    await sleep(intervalMs, signal)
  }
}

async function main(): Promise<void> {
  const config = getWatchConfig()
  const { db, sql } = createDbClient(getDatabaseUrl())
  const client = createMarketDataClient(config.network)
  const endpointState = createEndpointLivenessState()

  const poolLoop = runIntervalLoop('pool', config.poolIntervalMs, shutdown.signal, async () => {
    await runPoolTick({ db, client, poolAddress: config.poolAddress })
  })

  const endpointLoop = runIntervalLoop(
    'endpoint',
    config.endpointIntervalMs,
    shutdown.signal,
    async () => {
      await runEndpointLivenessCheck({ db }, endpointState)
    },
  )

  await Promise.all([poolLoop, endpointLoop])

  await sql.end()
}

await main()

export {}
