/**
 * RING 2 · OWNED STATE — our database
 *
 * A schema package's "tests" are meaningfully different from Ring 0's pure-function tests
 * (`00` §3.8): this exercises real migration apply/rollback and append-only permission
 * enforcement against a real Postgres, using `DATABASE_URL` from the environment. Skips
 * gracefully — not confusingly — when no database is available, since CI/other parallel
 * sessions may not have Postgres running.
 *
 * ⚠ DESTRUCTIVE. This suite drops and recreates the `public` and `drizzle` schemas of whatever
 * `DATABASE_URL` points at, more than once. Point it only at a disposable, throwaway Postgres
 * instance — never a shared or persistent one. See this chunk's final report for how one was
 * stood up for this run (a local `initdb`/`pg_ctl` instance on port 5433).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { getAppRolePassword, getDatabaseUrl } from './keys'
import * as schema from './schema'

function tryGet(fn: () => string): string | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

const databaseUrl = tryGet(getDatabaseUrl)
const appRolePassword = tryGet(getAppRolePassword)

const MIGRATIONS_FOLDER = new URL('../migrations', import.meta.url).pathname

const EXPECTED_TABLES = [
  'accounts',
  'authorizations',
  'credentials',
  'evidence',
  'jobs',
  'listings',
] as const

/** Swaps the connecting role on a Postgres connection string, keeping host/port/db intact. */
function withRole(connectionString: string, user: string, password: string): string {
  const url = new URL(connectionString)
  url.username = user
  url.password = password
  return url.toString()
}

const CONNECTION_OPTIONS = { max: 1, onnotice: () => {} } as const

async function resetDatabase(sql: postgres.Sql): Promise<void> {
  await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE')
  await sql.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE')
  await sql.unsafe('CREATE SCHEMA public')
  await sql.unsafe('DROP ROLE IF EXISTS aops_app')
}

async function listPublicTables(sql: postgres.Sql): Promise<string[]> {
  const rows = await sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `
  return rows.map((r) => r.table_name)
}

describe.skipIf(!databaseUrl)(
  'migrations apply and roll back cleanly (Chunk 3a verify) — set DATABASE_URL to run',
  () => {
    const url = databaseUrl as string
    let admin: postgres.Sql

    beforeAll(async () => {
      admin = postgres(url, CONNECTION_OPTIONS)
      await resetDatabase(admin)
    })

    afterAll(async () => {
      await admin.end()
    })

    test('apply: creates all six tables, the aops_app role, and its grants', async () => {
      const db = drizzle(admin, { schema })
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

      expect(await listPublicTables(admin)).toEqual([...EXPECTED_TABLES])

      const roles = await admin<{ rolcanlogin: boolean }[]>`
        SELECT rolcanlogin FROM pg_catalog.pg_roles WHERE rolname = 'aops_app'
      `
      expect(roles).toHaveLength(1)
      // Created NOLOGIN by the migration — a separate documented step
      // (`scripts/setup-app-role.ts`) enables login with a password that never lives in a
      // migration file.
      expect(roles[0]?.rolcanlogin).toBe(false)

      const evidenceGrants = await admin<{ privilege_type: string }[]>`
        SELECT privilege_type FROM information_schema.role_table_grants
        WHERE table_name = 'evidence' AND grantee = 'aops_app'
        ORDER BY privilege_type
      `
      expect(evidenceGrants.map((g) => g.privilege_type)).toEqual(['INSERT', 'SELECT'])

      const listingsGrants = await admin<{ privilege_type: string }[]>`
        SELECT privilege_type FROM information_schema.role_table_grants
        WHERE table_name = 'listings' AND grantee = 'aops_app'
        ORDER BY privilege_type
      `
      expect(listingsGrants.map((g) => g.privilege_type)).toEqual([
        'DELETE',
        'INSERT',
        'SELECT',
        'UPDATE',
      ])
    })

    test('rolls back cleanly: the migrated schema can be torn down and reapplied from scratch', async () => {
      // drizzle-kit 0.30.x has no native "migrate down" executor — checked directly, not
      // assumed. The practical rollback contract this project gets from Drizzle is that the
      // migration set is fully re-appliable after a teardown; that is what this test proves,
      // flagged explicitly rather than silently treated as a `drizzle-kit rollback` command.
      await resetDatabase(admin)
      expect(await listPublicTables(admin)).toHaveLength(0)

      const db = drizzle(admin, { schema })
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

      expect(await listPublicTables(admin)).toEqual([...EXPECTED_TABLES])
    })
  },
)

describe.skipIf(!databaseUrl || !appRolePassword)(
  'evidence is append-only for the aops_app role (Chunk 3a verify) — set DATABASE_URL and AOPS_APP_DB_PASSWORD to run',
  () => {
    const url = databaseUrl as string
    const password = appRolePassword as string
    let admin: postgres.Sql
    let asAppRole: postgres.Sql

    beforeAll(async () => {
      admin = postgres(url, CONNECTION_OPTIONS)
      // Schema must already be migrated (the suite above does this when run in the same
      // process; re-run defensively in case this suite runs alone).
      const db = drizzle(admin, { schema })
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
      await admin.unsafe(
        `ALTER ROLE aops_app WITH LOGIN PASSWORD '${password.replaceAll("'", "''")}'`,
      )
      asAppRole = postgres(withRole(url, 'aops_app', password), CONNECTION_OPTIONS)
    })

    afterAll(async () => {
      await admin.unsafe('TRUNCATE evidence')
      await asAppRole.end()
      await admin.end()
    })

    test('aops_app can INSERT and SELECT on evidence', async () => {
      const [row] = await asAppRole<{ evidence_id: string }[]>`
        INSERT INTO evidence (agent_id, version_hash, action_type, proof_type, evidence_level, source, payload)
        VALUES ('agent-test', 'v1', 'heartbeat', 'OUTCOME', 2, 'test', '{}'::jsonb)
        RETURNING evidence_id
      `
      const evidenceId = row?.evidence_id
      if (!evidenceId) throw new Error('INSERT ... RETURNING evidence_id returned no row')

      const selected = await asAppRole`SELECT * FROM evidence WHERE evidence_id = ${evidenceId}`
      expect(selected).toHaveLength(1)
    })

    test('a raw UPDATE against evidence fails at the database, not just in application code', async () => {
      // Not `expect(promise).rejects.toThrow(...)`: verified directly (see this chunk's report)
      // that Bun 1.3.6's `rejects.toThrow` matcher hangs indefinitely on a rejected
      // `postgres.js` `PostgresError` — a try/catch with an explicit assertion is the reliable
      // form here, not a style preference.
      let threw = false
      try {
        await asAppRole.unsafe("UPDATE evidence SET source = 'tampered'")
      } catch (error) {
        threw = true
        expect(String(error)).toMatch(/permission denied for table evidence/i)
      }
      expect(threw).toBe(true)
    })

    test('a raw DELETE against evidence fails at the database, not just in application code', async () => {
      let threw = false
      try {
        await asAppRole.unsafe('DELETE FROM evidence')
      } catch (error) {
        threw = true
        expect(String(error)).toMatch(/permission denied for table evidence/i)
      }
      expect(threw).toBe(true)
    })
  },
)
