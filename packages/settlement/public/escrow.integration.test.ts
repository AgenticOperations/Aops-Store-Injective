/**
 * Settlement integration tests — real Postgres when `DATABASE_URL` is set.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createDbClient } from '@repo/database/client'
import { getDatabaseUrl } from '@repo/database/keys'
import { jobs } from '@repo/database/schema'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { UnsupportedRailError } from './errors'
import {
  closeAltanaSession,
  disputeJob,
  listDisputedJobs,
  refundSweep,
  releasePlainEscrow,
} from './escrow'
import { plainEscrowScope, seedJob } from './test-helpers'

function tryGet(fn: () => string): string | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

const databaseUrl = tryGet(getDatabaseUrl)
const MIGRATIONS_FOLDER = new URL('../../database/migrations', import.meta.url).pathname

describe.skipIf(!databaseUrl)('settlement transitions (DATABASE_URL)', () => {
  const url = databaseUrl as string
  let db: ReturnType<typeof createDbClient>['db']
  let sql: ReturnType<typeof createDbClient>['sql']

  beforeAll(async () => {
    try {
      const admin = postgres(url, { max: 1, onnotice: () => {} })
      await admin.unsafe('DROP SCHEMA IF EXISTS public CASCADE')
      await admin.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE')
      await admin.unsafe('CREATE SCHEMA public')
      await admin.end()

      const client = createDbClient(url)
      db = client.db
      sql = client.sql
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
    } catch (error) {
      throw new Error(
        `settlement integration tests require a live Postgres at DATABASE_URL — ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  })

  afterAll(async () => {
    if (sql) await sql.end()
  })

  test('PLAIN release deducts and records flat fee correctly', async () => {
    const fundedAmount = 10_000_000n
    const { job } = await seedJob(db, {
      rail: 'ERC8183_ESCROW',
      escrowVariant: 'PLAIN',
      scope: plainEscrowScope(fundedAmount),
    })

    const result = await releasePlainEscrow(job.id, db, { feeBps: 400 })

    expect(result.settlementStatus).toBe('RELEASED')
    expect(result.feeBps).toBe(400)
    expect(result.feeChargedAmount).toBe('400000')
    expect(result.netToAgent).toBe('9600000')
    expect(result.mode).toBe('simulate')

    const updated = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) })
    expect(updated?.settlementStatus).toBe('RELEASED')
    expect(updated?.feeBps).toBe(400)
    expect(updated?.feeChargedAmount).toBe('400000')
    expect(updated?.measuredPerformanceFee).toBeNull()
  })

  test('ALTANA_SESSION close sets measuredPerformanceFee without fee collection fields', async () => {
    const { job } = await seedJob(db, {
      rail: 'ALTANA_SESSION',
      scope: {
        contractAllowlist: ['0x4444444444444444444444444444444444444444'],
        spendCap: { amount: '5000000', tokenDecimals: 18 },
        expiry: new Date(Date.now() + 86_400_000).toISOString(),
      },
    })

    const result = await closeAltanaSession(job.id, db, { measuredNetPnL: '10000' })

    expect(result.settlementStatus).toBe('RELEASED')
    expect(result.measuredPerformanceFee).toBe('1000')

    const updated = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) })
    expect(updated?.settlementStatus).toBe('RELEASED')
    expect(updated?.measuredPerformanceFee).toBe('1000')
    expect(updated?.feeBps).toBeNull()
    expect(updated?.feeChargedAmount).toBeNull()
  })

  test('ALTANA_SESSION close charges zero performance fee on loss', async () => {
    const { job } = await seedJob(db, {
      rail: 'ALTANA_SESSION',
      scope: {
        contractAllowlist: [],
        spendCap: { amount: '1000', tokenDecimals: 18 },
        expiry: new Date(Date.now() + 86_400_000).toISOString(),
      },
    })

    const result = await closeAltanaSession(job.id, db, { measuredNetPnL: '-2500' })
    expect(result.measuredPerformanceFee).toBe('0')
  })

  test('disputed job stays DISPUTED — no auto-resolve path exists', async () => {
    const { job } = await seedJob(db, {
      rail: 'ERC8183_ESCROW',
      escrowVariant: 'PLAIN',
      scope: plainEscrowScope(1_000_000n),
    })

    await disputeJob(job.id, db)

    const disputed = await listDisputedJobs(db)
    expect(disputed.some((row) => row.id === job.id)).toBe(true)

    const updated = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id) })
    expect(updated?.settlementStatus).toBe('DISPUTED')
  })

  test('AACP and X402 paths rejected at release', async () => {
    for (const rail of ['AACP_PROGRAM', 'X402_PAYMENT'] as const) {
      const { job } = await seedJob(db, {
        rail,
        scope: {},
      })

      await expect(releasePlainEscrow(job.id, db)).rejects.toThrow(UnsupportedRailError)
    }
  })

  test('refundSweep refunds stuck HELD jobs only', async () => {
    const stale = new Date(Date.now() - 86_400_000)
    const recent = new Date()

    const { job: stuckJob } = await seedJob(db, {
      rail: 'ERC8183_ESCROW',
      escrowVariant: 'PLAIN',
      scope: plainEscrowScope(500_000n),
      createdAt: stale,
    })

    const { job: freshJob } = await seedJob(db, {
      rail: 'ERC8183_ESCROW',
      escrowVariant: 'PLAIN',
      scope: plainEscrowScope(500_000n),
      createdAt: recent,
    })

    const sweep = await refundSweep(db, { olderThan: new Date(Date.now() - 43_200_000) })

    expect(sweep.refundedJobIds).toContain(stuckJob.id)
    expect(sweep.refundedJobIds).not.toContain(freshJob.id)

    const stuckUpdated = await db.query.jobs.findFirst({ where: eq(jobs.id, stuckJob.id) })
    const freshUpdated = await db.query.jobs.findFirst({ where: eq(jobs.id, freshJob.id) })
    expect(stuckUpdated?.settlementStatus).toBe('REFUNDED')
    expect(freshUpdated?.settlementStatus).toBe('HELD')
  })
})
