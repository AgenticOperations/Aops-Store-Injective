/**
 * SHARED
 * `@repo/observability/keys` — environment contract.
 *
 * Validates this package's own variables at startup and fails LOUDLY if any are
 * missing (00 §3.7). Nothing outside this file may read `process.env`.
 * A misconfigured money-tier package must fail at boot, not at signing time.
 */

export {}
