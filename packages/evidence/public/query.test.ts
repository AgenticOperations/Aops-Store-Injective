/**
 * RING 2 · OWNED STATE — our database
 *
 * Real-Postgres tests for evidence reads. Skips gracefully when `DATABASE_URL` is unset — same
 * contract as `@repo/database/schema.test.ts`.
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
import { getEvidenceForAgent } from './query'
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

describe.skipIf(!databaseUrl)('getEvidenceForAgent — set DATABASE_URL to run', () => {
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

  test('returns no_evidence when the agent has no rows', async () => {
    const result = await getEvidenceForAgent(db, 'agent-with-no-evidence')

    expect(result).toEqual({ kind: 'no_evidence' })
  })

  test('returns found with all rows for the requested agent only', async () => {
    await recordEvidence(db, {
      agentId: 'agent-query-a',
      versionHash: 'v1',
      actionType: 'heartbeat',
      proofType: 'OUTCOME',
      evidenceLevel: 2,
      source: 'test',
      payload: { agent: 'a', seq: 1 },
    })
    await recordEvidence(db, {
      agentId: 'agent-query-a',
      versionHash: 'v2',
      actionType: 'rebalance',
      proofType: 'EXECUTION',
      evidenceLevel: 3,
      source: 'test',
      payload: { agent: 'a', seq: 2 },
    })
    await recordEvidence(db, {
      agentId: 'agent-query-b',
      versionHash: 'v1',
      actionType: 'heartbeat',
      proofType: 'OUTCOME',
      evidenceLevel: 1,
      source: 'test',
      payload: { agent: 'b' },
    })

    const result = await getEvidenceForAgent(db, 'agent-query-a')

    expect(result.kind).toBe('found')
    if (result.kind !== 'found') throw new Error('expected found')

    expect(result.rows).toHaveLength(2)
    expect(result.rows.every((row) => row.agentId === 'agent-query-a')).toBe(true)
    expect(result.rows.map((row) => row.actionType).sort()).toEqual(['heartbeat', 'rebalance'])
  })
})
