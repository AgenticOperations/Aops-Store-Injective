/**
 * RING 2 · OWNED STATE — our database
 * `@repo/database/keys` — environment contract.
 *
 * Validates this package's own variables at startup and fails LOUDLY if any are
 * missing (00 §3.7). Nothing outside this file may read `process.env`.
 * A misconfigured money-tier package must fail at boot, not at signing time.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`@repo/database: ${name} is not set — refusing to start.`)
  }
  return value
}

/**
 * Lazily validated so importing this module never has a side effect at module-load time (a
 * test importing `schema.ts` alone, for instance, should not be forced to have `DATABASE_URL`
 * set). Validation happens the moment a caller actually asks for a connection string —
 * `@repo/database/client`'s factory calls this, and drizzle-kit's own `drizzle.config.ts`
 * validates independently since the CLI runs outside this package's module graph.
 */
export function getDatabaseUrl(): string {
  return required('DATABASE_URL')
}

/**
 * Password for the restricted `aops_app` role (see
 * `migrations/0001_aops_app_role_and_evidence_append_only.sql` and
 * `scripts/setup-app-role.ts`). Only the setup script and this package's append-only tests need
 * it — every other package that connects as `aops_app` gets its own connection string from
 * whatever secret store composes it, per `00` §3.7 ("apps compose package keys plus their
 * own"), not from this getter.
 */
export function getAppRolePassword(): string {
  return required('AOPS_APP_DB_PASSWORD')
}
