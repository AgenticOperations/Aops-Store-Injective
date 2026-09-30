/**
 * RING 2 · OWNED STATE — our database
 * `@repo/database/client` — public contract. Named exports only.
 *
 * Schema, migrations, typed client. Owns nothing but storage.
 *
 * A typed Drizzle client factory over `postgres` (`postgres-js`). Defaults to
 * `@repo/database/keys`'s validated `DATABASE_URL`; accepts an explicit override so a caller
 * can connect as a different Postgres role (e.g. the restricted `aops_app` role that
 * `@repo/evidence`, Chunk 3b, writes through — see `migrations/0001_aops_app_role_and_evidence_append_only.sql`)
 * without this package ever reading `process.env` for that second connection itself.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { getDatabaseUrl } from './keys'
import * as schema from './schema'

export type DbClient = ReturnType<typeof drizzle<typeof schema>>

export interface CreateDbClientResult {
  /** The typed Drizzle query interface. */
  db: DbClient
  /** The underlying `postgres` connection pool — callers own its lifecycle and must call
   * `sql.end()` when done (tests in particular; a long-lived app process leaves it open). */
  sql: ReturnType<typeof postgres>
}

/**
 * Creates a typed Drizzle client. `connectionString` defaults to `DATABASE_URL` via
 * `@repo/database/keys` — pass an explicit value to connect as a different role (tests
 * exercising the `aops_app` append-only enforcement do exactly this).
 */
export function createDbClient(connectionString: string = getDatabaseUrl()): CreateDbClientResult {
  const sql = postgres(connectionString)
  const db = drizzle(sql, { schema })
  return { db, sql }
}

export { schema }
