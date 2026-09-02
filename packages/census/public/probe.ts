/**
 * RING 1 · OBSERVATION — read-only, output is a cache
 * `@repo/census/probe` — public contract. Named exports only.
 *
 * Population-scale liveness probing. The only package that touches arbitrary third-party
 * endpoints - treats every response as hostile.
 *
 * Probes the REAL endpoint declared in a Listing's `services[]` array — never the `agentURI`
 * manifest fetch itself. The manifest, often IPFS-pinned, proves nothing about whether the
 * actual service is running; only a live probe of the declared endpoint does
 * (`final-review-docs/01` §4.3).
 *
 * `probeEndpoint` checks one URL, once, and returns a structured result. That single shape is
 * deliberately generic enough to serve both of its callers without any change here:
 *   - a one-shot `ENDPOINT_VERIFIED` gate check, called once during claim by `listings`
 *     (`final-review-docs/01` §4.3)
 *   - an ongoing repeated health check, called on a timer by `apps/watch` (`E14a`)
 * Both callers own their own repetition/scheduling logic; this package only ever answers "is
 * this URL live right now." No population-scale crawl/rate-limiting logic belongs here — v1 has
 * no crawl, `census` only ever checks agents that already exist as rows (`00` Part 9 item 5).
 *
 * Every response is hostile input (`00` §6.3): non-200 status, connection refused, DNS failure,
 * timeout, a non-JSON body when JSON was expected, and an oversized body are all treated as a
 * normal "not live" result — this function never throws for a hostile response and never lets a
 * probe hang past its timeout.
 */

import { censusConfig } from './keys'

export type LivenessFailureReason =
  | 'invalid_url'
  | 'dns_failure'
  | 'connection_refused'
  | 'timeout'
  | 'non_200_status'
  | 'oversized_body'
  | 'invalid_content_type'
  | 'malformed_body'
  | 'network_error'

export interface LiveResult {
  live: true
  url: string
  httpStatus: number
  latencyMs: number
  checkedAt: string
}

export interface NotLiveResult {
  live: false
  url: string
  reason: LivenessFailureReason
  httpStatus: number | null
  latencyMs: number | null
  checkedAt: string
}

/** The structured liveness result both callers (claim-time gate, `apps/watch`'s repeated
 * health check) consume identically. Never a bare boolean — the failure reason is load-bearing
 * for `apps/watch`'s alerting and for surfacing *why* an endpoint failed on the claim screen. */
export type LivenessResult = LiveResult | NotLiveResult

export interface ProbeOptions {
  /** Injectable for tests / callers with their own fetch wrapper. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch
  /** Milliseconds before the probe gives up and reports `timeout`. Defaults to
   * `censusConfig.defaultTimeoutMs`. */
  timeoutMs?: number
  /** Hard cap on bytes read from the response body before reporting `oversized_body`. Defaults
   * to `censusConfig.defaultMaxBodyBytes`. */
  maxBodyBytes?: number
  /** Declared service endpoints are expected to speak JSON (Agent Card / A2A service
   * convention). When true (default), a non-JSON content-type or an unparsable body is reported
   * as not-live. Set false to check liveness by status code alone. */
  expectJson?: boolean
}

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed
  } catch {
    return null
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || (error as { code?: unknown }).code === 'ABORT_ERR')
  )
}

function classifyFetchError(error: unknown): LivenessFailureReason {
  if (isAbortError(error)) return 'timeout'
  const cause =
    error && typeof error === 'object' && 'cause' in error
      ? (error as { cause?: unknown }).cause
      : undefined
  const code =
    cause && typeof cause === 'object' && 'code' in cause
      ? (cause as { code?: unknown }).code
      : undefined
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'dns_failure'
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT') {
    return 'connection_refused'
  }
  return 'network_error'
}

/** Reads at most `maxBytes` from a Response body without ever buffering an unbounded stream
 * into memory. Returns `null` if the body exceeds the cap. */
async function readBoundedBody(response: Response, maxBytes: number): Promise<string | null> {
  const reader = response.body?.getReader()
  if (!reader) {
    // No readable stream available (some fetch polyfills / test fixtures) — fall back to a
    // single bounded read, still enforcing the cap after the fact.
    const text = await response.text()
    return text.length > maxBytes ? null : text
  }

  const decoder = new TextDecoder()
  let received = 0
  let result = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    result += decoder.decode(value, { stream: true })
  }
  result += decoder.decode()
  return result
}

/**
 * Probes a single declared service endpoint once and returns a structured liveness result.
 *
 * Never throws: a malformed URL, a connection failure, a timeout, a non-2xx status, or a
 * malformed/oversized body are all normal outcomes reported as `{ live: false, reason }`, not
 * exceptions. Callers (the `listings` claim gate, `apps/watch`'s repeated health check) own
 * whatever they do with a `live: false` result — this function does no retrying itself.
 */
export async function probeEndpoint(
  url: string,
  options: ProbeOptions = {},
): Promise<LivenessResult> {
  const checkedAt = new Date().toISOString()
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? censusConfig.defaultTimeoutMs
  const maxBodyBytes = options.maxBodyBytes ?? censusConfig.defaultMaxBodyBytes
  const expectJson = options.expectJson ?? true

  const parsed = parseHttpUrl(url)
  if (!parsed) {
    return { live: false, url, reason: 'invalid_url', httpStatus: null, latencyMs: null, checkedAt }
  }

  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

  let response: Response
  try {
    response = await fetchImpl(parsed.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: { accept: expectJson ? 'application/json' : '*/*' },
    })
  } catch (error) {
    return {
      live: false,
      url,
      reason: classifyFetchError(error),
      httpStatus: null,
      latencyMs: Date.now() - startedAt,
      checkedAt,
    }
  } finally {
    clearTimeout(timeoutHandle)
  }

  const latencyMs = Date.now() - startedAt

  if (response.status < 200 || response.status >= 300) {
    return {
      live: false,
      url,
      reason: 'non_200_status',
      httpStatus: response.status,
      latencyMs,
      checkedAt,
    }
  }

  try {
    const contentLengthHeader = response.headers.get('content-length')
    if (contentLengthHeader !== null) {
      const contentLength = Number(contentLengthHeader)
      if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
        return {
          live: false,
          url,
          reason: 'oversized_body',
          httpStatus: response.status,
          latencyMs,
          checkedAt,
        }
      }
    }

    if (!expectJson) {
      return { live: true, url, httpStatus: response.status, latencyMs, checkedAt }
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
      return {
        live: false,
        url,
        reason: 'invalid_content_type',
        httpStatus: response.status,
        latencyMs,
        checkedAt,
      }
    }

    const body = await readBoundedBody(response, maxBodyBytes)
    if (body === null) {
      return {
        live: false,
        url,
        reason: 'oversized_body',
        httpStatus: response.status,
        latencyMs,
        checkedAt,
      }
    }

    JSON.parse(body)
    return { live: true, url, httpStatus: response.status, latencyMs, checkedAt }
  } catch (error) {
    // Any failure while reading/parsing the body (including an abort mid-stream) is still a
    // normal not-live result, never a throw past this boundary.
    const reason: LivenessFailureReason = isAbortError(error) ? 'timeout' : 'malformed_body'
    return { live: false, url, reason, httpStatus: response.status, latencyMs, checkedAt }
  }
}
