/**
 * RING 2 · OWNED STATE — our database
 *
 * Real-Postgres tests for append-only evidence writes. Skips gracefully when `DATABASE_URL` is
 * unset — same contract as `@repo/database/schema.test.ts`.
 *
 * ⚠ DESTRUCTIVE to the `evidence` table only: truncates before/after. Point `DATABASE_URL` at a
 * disposable Postgres instance, never a shared one.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type DbClient, createDbClient } from '@repo/database/client'
import { getDatabaseUrl } from '@repo/database/keys'
import * as schema from '@repo/database/schema'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { recordEvidence } from './write'

function tryGet(fn: () => string): string | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

const databaseUrl = tryGet(getDatabaseUrl)
const MIGRATIONS_FOLDER = new URL('../../database/migrations', import.meta.url).pathname

describe.skipIf(!databaseUrl)('recordEvidence — set DATABASE_URL to run', () => {
  const url = databaseUrl as string
  let sql: ReturnType<typeof createDbClient>['sql']
  let db: DbClient

  beforeAll(async () => {
    ;({ db, sql } = createDbClient(url))
    await migrate(drizzle(sql, { schema }), { migrationsFolder: MIGRATIONS_FOLDER })
    await sql.unsafe('TRUNCATE evidence')
  })

  afterAll(async () => {
    await sql.unsafe('TRUNCATE evidence')
    await sql.end()
  })

  test('appends a row and returns the persisted shape', async () => {
    const row = await recordEvidence(db, {
      agentId: 'agent-write-test',
      versionHash: 'v1',
      actionType: 'heartbeat',
      proofType: 'OUTCOME',
      evidenceLevel: 2,
      source: 'test',
      payload: { ok: true },
    })

    expect(row.agentId).toBe('agent-write-test')
    expect(row.versionHash).toBe('v1')
    expect(row.actionType).toBe('heartbeat')
    expect(row.proofType).toBe('OUTCOME')
    expect(row.evidenceLevel).toBe(2)
    expect(row.source).toBe('test')
    expect(row.payload).toEqual({ ok: true })
    expect(row.evidenceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(row.createdAt).toBeInstanceOf(Date)
  })

  test('each call appends a distinct row — never overwrites', async () => {
    const first = await recordEvidence(db, {
      agentId: 'agent-append-test',
      versionHash: 'v1',
      actionType: 'heartbeat',
      proofType: 'OUTCOME',
      evidenceLevel: 1,
      source: 'test',
      payload: { seq: 1 },
    })
    const second = await recordEvidence(db, {
      agentId: 'agent-append-test',
      versionHash: 'v2',
      actionType: 'heartbeat',
      proofType: 'OUTCOME',
      evidenceLevel: 2,
      source: 'test',
      payload: { seq: 2 },
    })

    expect(first.evidenceId).not.toBe(second.evidenceId)
    expect(second.versionHash).toBe('v2')
  })
})
