/**
 * RING 1 · OBSERVATION — read-only, output is a cache
 * `@repo/census/keys` — environment contract.
 *
 * Validates this package's own variables at startup and fails LOUDLY if any are
 * missing or malformed (00 §3.7). Nothing outside this file may read `process.env`.
 * A misconfigured money-tier package must fail at boot, not at signing time.
 *
 * `census` has no vendor credentials to hold — it probes arbitrary third-party endpoints, not
 * one named vendor's API, so there is no required secret here. What it does own is the tuning
 * knobs that keep an adversarial probe target from being able to hang or flood this process:
 * the per-probe timeout and the response-body byte cap (`probe.ts`, `00` §6.3's hostile-input
 * invariant). Both are optional overrides with safe defaults — but a *provided* value that
 * fails to parse still fails loudly, same as a missing secret would.
 */

import { z } from 'zod'

const envSchema = z.object({
  CENSUS_PROBE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  CENSUS_MAX_BODY_BYTES: z.coerce.number().int().positive().optional(),
})

/** 5s — generous enough for a slow but real service, short enough that a dead/hanging endpoint
 * never blocks a caller indefinitely. */
const DEFAULT_TIMEOUT_MS = 5_000

/** 1 MB — a liveness/health response has no legitimate reason to be bigger; anything larger is
 * treated as hostile, not truncated and trusted. */
const DEFAULT_MAX_BODY_BYTES = 1_000_000

function loadCensusConfig() {
  const parsed = envSchema.safeParse({
    CENSUS_PROBE_TIMEOUT_MS: process.env.CENSUS_PROBE_TIMEOUT_MS,
    CENSUS_MAX_BODY_BYTES: process.env.CENSUS_MAX_BODY_BYTES,
  })

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`@repo/census: invalid environment configuration — ${detail}`)
  }

  return {
    defaultTimeoutMs: parsed.data.CENSUS_PROBE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
    defaultMaxBodyBytes: parsed.data.CENSUS_MAX_BODY_BYTES ?? DEFAULT_MAX_BODY_BYTES,
  } as const
}

export const censusConfig = loadCensusConfig()
