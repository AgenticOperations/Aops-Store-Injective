#!/usr/bin/env bun
/**
 * `@repo/database` setup script — enables login for the `aops_app` role.
 *
 * `migrations/0001_aops_app_role_and_evidence_append_only.sql` creates `aops_app` `NOLOGIN` and
 * grants it its table privileges (SELECT+INSERT-only on `evidence`, full CRUD elsewhere) — that
 * part is versioned schema and safe to check in. A password is not: this script sets one,
 * separately, once per target database, reading it from `AOPS_APP_DB_PASSWORD` rather than ever
 * writing it into a migration file.
 *
 * Run after migrations have applied:
 *   DATABASE_URL=<superuser/owner connection> AOPS_APP_DB_PASSWORD=<secret> bun run db:setup-app-role
 *
 * Idempotent — re-running just resets the password. Later chunks (`@repo/evidence` Chunk 3b,
 * `@repo/listings` Chunk 3c, `@repo/access` Chunk 3e) connect as `aops_app` for their own writes;
 * this is the one place that role's password gets set.
 */

import postgres from 'postgres'
import { getAppRolePassword, getDatabaseUrl } from '../public/keys'

async function main() {
  const sql = postgres(getDatabaseUrl())
  try {
    const password = getAppRolePassword()
    // `sql.unsafe` because ALTER ROLE ... PASSWORD does not accept a bound parameter in
    // Postgres's grammar; the value still never touches a migration file or version control.
    await sql.unsafe(`ALTER ROLE aops_app WITH LOGIN PASSWORD '${password.replaceAll("'", "''")}'`)
  } finally {
    await sql.end()
  }
}

await main()
