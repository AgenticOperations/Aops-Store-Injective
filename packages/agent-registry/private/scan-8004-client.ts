/**
 * RING 1 · OBSERVATION — private vendor client
 * HTTP client for 8004scan's public REST API. Never imported outside this package
 * (`architecture/00` §3.2).
 *
 * Only `GET /chains` is a confirmed-live endpoint anywhere in this repo's docs
 * (`docs/architecture/03-evidence-trust-engine-pipeline.md`'s Provenance Addendum item 4: a
 * live call to `GET https://8004scan.io/api/v1/public/chains` returned a real `bsc_testnet`
 * chain object). A per-agent reputation endpoint almost certainly exists — the OpenAPI spec is
 * published at `{SCAN_8004_BASE_URL}/docs/openapi.json` — but its path and response shape are
 * NOT confirmed by any doc this chunk is allowed to cite. Per `CLAUDE.md`'s "no vendor
 * invention" hard stop ("do not curl docs mid-implementation and do not guess"), this file does
 * not call a guessed per-agent path. `public/registry.ts`'s `getAgentRegistrySnapshot` returns
 * an explicit "reputation unavailable" state instead. Wiring the real endpoint is follow-up
 * work once someone fetches and confirms the OpenAPI spec and writes the fact into a doc.
 */
import { SCAN_8004_BASE_URL } from './constants'

export interface Scan8004Deps {
  fetchImpl?: typeof fetch
}

export type Scan8004Result<T> = { ok: true; data: T } | { ok: false; error: Scan8004Error }

export interface Scan8004Error {
  code: 'RATE_LIMITED' | 'HTTP_ERROR' | 'INVALID_RESPONSE' | 'NETWORK_ERROR'
  message: string
  status?: number
}

/**
 * Generic `GET` against the confirmed base URL. `parse` is the caller's own validation (zod, in
 * practice) — this function never returns unvalidated JSON; a thrown `parse` is caught and
 * turned into `INVALID_RESPONSE` (`00` §6.3). The anonymous rate limit is low (~10/min, per the
 * milestone plan's Chunk 2a brief — a Pro key may not be available) so a `429` is reported as a
 * typed result, never thrown past this boundary as an unhandled rejection.
 */
export async function scan8004Get<T>(
  path: string,
  parse: (raw: unknown) => T,
  deps: Scan8004Deps = {},
): Promise<Scan8004Result<T>> {
  const fetchImpl = deps.fetchImpl ?? fetch

  let response: Response
  try {
    response = await fetchImpl(`${SCAN_8004_BASE_URL}${path}`)
  } catch (err) {
    return {
      ok: false,
      error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : String(err) },
    }
  }

  if (response.status === 429) {
    return {
      ok: false,
      error: { code: 'RATE_LIMITED', message: '8004scan anonymous rate limit hit', status: 429 },
    }
  }
  if (!response.ok) {
    return {
      ok: false,
      error: {
        code: 'HTTP_ERROR',
        message: `8004scan returned HTTP ${response.status}`,
        status: response.status,
      },
    }
  }

  let json: unknown
  try {
    json = await response.json()
  } catch {
    return {
      ok: false,
      error: { code: 'INVALID_RESPONSE', message: 'response body was not valid JSON' },
    }
  }

  try {
    return { ok: true, data: parse(json) }
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: err instanceof Error ? err.message : 'response failed schema validation',
      },
    }
  }
}
