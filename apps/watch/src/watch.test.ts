import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createDbClient } from '@repo/database/client'
import { getDatabaseUrl } from '@repo/database/keys'
import { listings, pendingTasks, poolObservations } from '@repo/database/schema'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { type Address, type PublicClient, createPublicClient, custom } from 'viem'
import { bscTestnet } from 'viem/chains'
import {
  CONSECUTIVE_PROBE_SUCCESS_THRESHOLD,
  checkListingEndpoint,
  createEndpointLivenessState,
} from './endpoint-liveness'
import { runPoolTick } from './pool-tick'

const MIGRATIONS_FOLDER = new URL('../../database/migrations', import.meta.url).pathname
const SRC_DIR = new URL('.', import.meta.url).pathname

function tryGet(fn: () => string): string | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

const databaseUrl = tryGet(getDatabaseUrl)

const FIXTURE_POOL = '0x6805E0E5333c5c3acCF2930Be4734E2b98f4Ce06' as Address

function fixturePublicClient(blockNumber = 12_345n): PublicClient {
  return createPublicClient({
    chain: bscTestnet,
    transport: custom({
      request: async ({ method }) => {
        if (method === 'eth_blockNumber') return `0x${blockNumber.toString(16)}`
        if (method === 'eth_getBlockByNumber') {
          return {
            number: `0x${blockNumber.toString(16)}`,
            timestamp: '0x66d00000',
          }
        }
        throw new Error(`unexpected rpc method: ${method}`)
      },
    }),
  })
}

describe('pool tick — mock db', () => {
  test('inserts a new observation snapshot', async () => {
    let insertedValues: Record<string, unknown> | undefined
    const mockDb = {
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          insertedValues = values
          return {
            onConflictDoNothing: () => ({
              returning: async () => [{ id: 'obs-1' }],
            }),
          }
        },
      }),
    }

    const mockClient = {
      getBlockNumber: async () => 50_000n,
      getBlock: async () => ({ number: 50_000n, timestamp: 1_720_000_000n }),
    } as PublicClient

    const result = await runPoolTick({
      db: mockDb as never,
      client: mockClient,
      poolAddress: FIXTURE_POOL,
      readSnapshot: async () => ({
        poolAddress: FIXTURE_POOL,
        observationIndex: 7,
        blockNumber: 50_000n,
        tickCumulative: 900_000n,
        secondsPerLiquidityCumulativeX128: 123n,
        blockTimestamp: new Date('2026-09-02T09:00:00.000Z'),
      }),
    })

    expect(result.inserted).toBe(true)
    expect(result.snapshot.tickCumulative).toBe(900_000n)
    expect(insertedValues?.observationIndex).toBe(7)
  })
})

describe('endpoint liveness — mock db', () => {
  test('enqueues exactly one markDegraded task across repeated failures', async () => {
    const enqueuedKeys: string[] = []
    const mockDb = {
      insert: () => ({
        values: (values: { idempotencyKey: string }) => ({
          onConflictDoNothing: () => ({
            returning: async () => {
              if (enqueuedKeys.includes(values.idempotencyKey)) return []
              enqueuedKeys.push(values.idempotencyKey)
              return [{ id: 'task-1' }]
            },
          }),
        }),
      }),
    }

    const state = createEndpointLivenessState()
    const listing = {
      id: 'listing-mock-1',
      status: 'LIVE' as const,
      declaredEndpoint: 'https://dead.example.com/health',
      endpointProbeSuccessCount: 0,
    }
    const checkedAt = '2026-09-02T08:00:00.000Z'
    const deadProbe = async () => ({
      live: false as const,
      url: listing.declaredEndpoint,
      reason: 'connection_refused' as const,
      httpStatus: null,
      latencyMs: null,
      checkedAt,
    })

    const first = await checkListingEndpoint({ db: mockDb as never, probe: deadProbe }, state, listing)
    const second = await checkListingEndpoint({ db: mockDb as never, probe: deadProbe }, state, listing)

    expect(first.enqueuedDegraded).toBe(true)
    expect(second.enqueuedDegraded).toBe(false)
    expect(enqueuedKeys).toEqual([`endpoint-death:${listing.id}:${checkedAt}`])
  })
})

describe.skipIf(!databaseUrl)('pool tick — observation accumulation', () => {
  test('simulated pool-price move produces an observation row', async () => {
    const url = databaseUrl as string
    const sql = postgres(url, { max: 1, onnotice: () => {} })
    await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE')
    await sql.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE')
    await sql.unsafe('CREATE SCHEMA public')
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER })

    const { db } = createDbClient(url)
    const client = fixturePublicClient(99_001n)

    const firstTick = await runPoolTick({
      db,
      client,
      poolAddress: FIXTURE_POOL,
      readSnapshot: async () => ({
        poolAddress: FIXTURE_POOL,
        observationIndex: 42,
        blockNumber: 99_001n,
        tickCumulative: 1_000_000n,
        secondsPerLiquidityCumulativeX128: 555n,
        blockTimestamp: new Date('2026-09-02T08:00:00.000Z'),
      }),
    })

    expect(firstTick.inserted).toBe(true)

    const movedTick = await runPoolTick({
      db,
      client,
      poolAddress: FIXTURE_POOL,
      readSnapshot: async () => ({
        poolAddress: FIXTURE_POOL,
        observationIndex: 43,
        blockNumber: 99_002n,
        tickCumulative: 1_500_000n,
        secondsPerLiquidityCumulativeX128: 777n,
        blockTimestamp: new Date('2026-09-02T08:01:00.000Z'),
      }),
    })

    expect(movedTick.inserted).toBe(true)
    expect(movedTick.snapshot.tickCumulative).toBe(1_500_000n)

    const rows = await db
      .select()
      .from(poolObservations)
      .where(eq(poolObservations.poolAddress, FIXTURE_POOL))

    expect(rows).toHaveLength(2)
    expect(rows.some((row) => row.observationIndex === 43)).toBe(true)

    const duplicate = await runPoolTick({
      db,
      client,
      poolAddress: FIXTURE_POOL,
      readSnapshot: async () => ({
        poolAddress: FIXTURE_POOL,
        observationIndex: 43,
        blockNumber: 99_002n,
        tickCumulative: 1_500_000n,
        secondsPerLiquidityCumulativeX128: 777n,
        blockTimestamp: new Date('2026-09-02T08:01:00.000Z'),
      }),
    })

    expect(duplicate.inserted).toBe(false)
    await sql.end()
  })
})

describe.skipIf(!databaseUrl)('endpoint liveness — death enqueue', () => {
  const url = databaseUrl as string
  let sql: ReturnType<typeof postgres>
  let db: ReturnType<typeof createDbClient>['db']
  let listingId: string

  beforeAll(async () => {
    sql = postgres(url, { max: 1, onnotice: () => {} })
    await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE')
    await sql.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE')
    await sql.unsafe('CREATE SCHEMA public')
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER })

    const client = createDbClient(url)
    db = client.db

    const [listing] = await db
      .insert(listings)
      .values({
        agentId: 'agent-watch-fixture',
        category: 'rebalancing',
        status: 'LIVE',
        trustTier: 'Low',
        ownerWallet: '0x0000000000000000000000000000000000000001',
        declaredEndpoint: 'https://agent.example.com/health',
        endpointProbeSuccessCount: 0,
      })
      .returning({ id: listings.id })

    if (!listing) throw new Error('fixture listing insert failed')
    listingId = listing.id
  })

  afterAll(async () => {
    await sql.end()
  })

  test('simulated endpoint death enqueues exactly one task across repeated failures', async () => {
    const state = createEndpointLivenessState()
    const checkedAt = '2026-09-02T08:00:00.000Z'
    const listing = {
      id: listingId,
      status: 'LIVE' as const,
      declaredEndpoint: 'https://agent.example.com/health',
      endpointProbeSuccessCount: 0,
    }

    const deadProbe = async () => ({
      live: false as const,
      url: listing.declaredEndpoint,
      reason: 'connection_refused' as const,
      httpStatus: null,
      latencyMs: null,
      checkedAt,
    })

    const first = await checkListingEndpoint({ db, probe: deadProbe }, state, listing)
    expect(first.enqueuedDegraded).toBe(true)

    const second = await checkListingEndpoint({ db, probe: deadProbe }, state, listing)
    expect(second.enqueuedDegraded).toBe(false)

    const third = await checkListingEndpoint({ db, probe: deadProbe }, state, listing)
    expect(third.enqueuedDegraded).toBe(false)

    const tasks = await db
      .select()
      .from(pendingTasks)
      .where(eq(pendingTasks.taskName, 'listings.transition'))

    expect(tasks).toHaveLength(1)
    expect(tasks[0]?.idempotencyKey).toBe(`endpoint-death:${listingId}:${checkedAt}`)
    expect(tasks[0]?.payload).toEqual({ listingId, action: 'markDegraded' })
  })

  test('three consecutive successes on DEGRADED enqueues one markLive task', async () => {
    const state = createEndpointLivenessState()
    const degradedListing = {
      id: listingId,
      status: 'DEGRADED' as const,
      declaredEndpoint: 'https://agent.example.com/health',
      endpointProbeSuccessCount: 0,
    }

    let probeCount = 0
    const liveProbe = async () => {
      probeCount += 1
      return {
        live: true as const,
        url: degradedListing.declaredEndpoint,
        httpStatus: 200,
        latencyMs: 10,
        checkedAt: `2026-09-02T08:0${probeCount}:00.000Z`,
      }
    }

    for (let i = 0; i < CONSECUTIVE_PROBE_SUCCESS_THRESHOLD - 1; i++) {
      const pending = await checkListingEndpoint({ db, probe: liveProbe }, state, degradedListing)
      expect(pending.enqueuedLive).toBe(false)
    }

    const recovered = await checkListingEndpoint({ db, probe: liveProbe }, state, degradedListing)
    expect(recovered.enqueuedLive).toBe(true)

    const recoveryTasks = await db
      .select()
      .from(pendingTasks)
      .where(eq(pendingTasks.taskName, 'listings.transition'))

    const markLiveTasks = recoveryTasks.filter(
      (task) =>
        typeof task.payload === 'object' &&
        task.payload !== null &&
        'action' in task.payload &&
        task.payload.action === 'markLive',
    )

    expect(markLiveTasks).toHaveLength(1)
  })
})

describe('boundary imports — no custody or settlement', () => {
  test('source files do not import @repo/custody or @repo/settlement', async () => {
    const forbidden = ['@repo/custody', '@repo/settlement']
    const productionFiles = ['main.ts', 'enqueue.ts', 'pool-tick.ts', 'endpoint-liveness.ts', 'config.ts']

    for (const file of productionFiles) {
      const content = await readFile(join(SRC_DIR, file), 'utf8')
      for (const pkg of forbidden) {
        expect(content.includes(pkg)).toBe(false)
      }
    }
  })
})
