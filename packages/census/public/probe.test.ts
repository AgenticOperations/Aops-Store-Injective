// packages/census/public/probe.test.ts
//
// Fixture `fetch` implementations only — zero real network calls. `census` does real I/O
// (unlike Ring 0), so "zero mocks" here means: never mock this package's own functions, but do
// inject a fixture `fetch` so tests never hit the network (00 §3.8).

import { describe, expect, test } from 'bun:test'
import { probeEndpoint } from './probe'

function fetchReturning(response: Response): typeof fetch {
  return (async () => response) as unknown as typeof fetch
}

function fetchRejectingWith(error: unknown): typeof fetch {
  return (async () => {
    throw error
  }) as unknown as typeof fetch
}

function connectionRefusedError(): TypeError {
  const error = new TypeError('fetch failed')
  ;(error as unknown as { cause: unknown }).cause = { code: 'ECONNREFUSED' }
  return error
}

function dnsFailureError(): TypeError {
  const error = new TypeError('fetch failed')
  ;(error as unknown as { cause: unknown }).cause = { code: 'ENOTFOUND' }
  return error
}

/** A `fetch` that never resolves on its own — only reacts to the caller's abort signal, exactly
 * like a genuinely hung connection would. */
function hangingFetch(): typeof fetch {
  return ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      })
    })) as unknown as typeof fetch
}

describe('probeEndpoint — healthy endpoint', () => {
  test('a 200 JSON response is reported live', async () => {
    const response = new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

    const result = await probeEndpoint('https://agent.example.com/health', {
      fetchImpl: fetchReturning(response),
    })

    expect(result.live).toBe(true)
    if (result.live) {
      expect(result.httpStatus).toBe(200)
      expect(result.url).toBe('https://agent.example.com/health')
      expect(typeof result.latencyMs).toBe('number')
      expect(typeof result.checkedAt).toBe('string')
    }
  })

  test('status code alone is trusted when expectJson is false', async () => {
    const response = new Response('OK', { status: 200, headers: { 'content-type': 'text/plain' } })

    const result = await probeEndpoint('https://agent.example.com/ping', {
      fetchImpl: fetchReturning(response),
      expectJson: false,
    })

    expect(result.live).toBe(true)
  })
})

describe('probeEndpoint — a dead endpoint is handled without throwing', () => {
  test('connection refused is reported not-live, never thrown', async () => {
    const probe = probeEndpoint('https://dead.example.com/health', {
      fetchImpl: fetchRejectingWith(connectionRefusedError()),
    })

    await expect(probe).resolves.toMatchObject({ live: false, reason: 'connection_refused' })
  })

  test('DNS failure is reported not-live, never thrown', async () => {
    const result = await probeEndpoint('https://nonexistent-domain.invalid/health', {
      fetchImpl: fetchRejectingWith(dnsFailureError()),
    })

    expect(result).toMatchObject({ live: false, reason: 'dns_failure' })
  })

  test('a non-200 status is reported not-live, never thrown', async () => {
    const response = new Response('service unavailable', { status: 503 })

    const result = await probeEndpoint('https://flaky.example.com/health', {
      fetchImpl: fetchReturning(response),
    })

    expect(result).toMatchObject({ live: false, reason: 'non_200_status', httpStatus: 503 })
  })

  test('a hung connection times out and is reported not-live, never thrown', async () => {
    const result = await probeEndpoint('https://slow.example.com/health', {
      fetchImpl: hangingFetch(),
      timeoutMs: 20,
    })

    expect(result).toMatchObject({ live: false, reason: 'timeout' })
  }, 1000)
})

describe('probeEndpoint — a malformed response is handled without throwing', () => {
  test('a non-JSON body when JSON is expected is reported not-live, never thrown', async () => {
    const response = new Response('not json {{{', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

    const result = await probeEndpoint('https://agent.example.com/health', {
      fetchImpl: fetchReturning(response),
    })

    expect(result).toMatchObject({ live: false, reason: 'malformed_body', httpStatus: 200 })
  })

  test('an unexpected content-type is reported not-live, never thrown', async () => {
    const response = new Response('<html>not an agent endpoint</html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })

    const result = await probeEndpoint('https://agent.example.com/health', {
      fetchImpl: fetchReturning(response),
    })

    expect(result).toMatchObject({ live: false, reason: 'invalid_content_type', httpStatus: 200 })
  })

  test('an oversized body is reported not-live, never thrown, and never fully buffered', async () => {
    const hugeBody = JSON.stringify({ padding: 'x'.repeat(10_000) })
    const response = new Response(hugeBody, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

    const result = await probeEndpoint('https://agent.example.com/health', {
      fetchImpl: fetchReturning(response),
      maxBodyBytes: 100,
    })

    expect(result).toMatchObject({ live: false, reason: 'oversized_body', httpStatus: 200 })
  })

  test('an invalid URL is rejected without ever calling fetch, and never thrown', async () => {
    let fetchCalled = false
    const fetchImpl = (async () => {
      fetchCalled = true
      return new Response('', { status: 200 })
    }) as unknown as typeof fetch

    const result = await probeEndpoint('not-a-url', { fetchImpl })

    expect(result).toMatchObject({ live: false, reason: 'invalid_url' })
    expect(fetchCalled).toBe(false)
  })

  test('a non-http(s) URL scheme is rejected as invalid, never thrown', async () => {
    const result = await probeEndpoint('ftp://agent.example.com/health', {
      fetchImpl: fetchReturning(new Response('', { status: 200 })),
    })

    expect(result).toMatchObject({ live: false, reason: 'invalid_url' })
  })
})

describe('probeEndpoint — this exact plan requirement', () => {
  test('a dead endpoint and a malformed response are both handled without throwing past the boundary', async () => {
    const deadEndpoint = probeEndpoint('https://dead.example.com/health', {
      fetchImpl: fetchRejectingWith(connectionRefusedError()),
    })
    const malformedResponse = probeEndpoint('https://agent.example.com/health', {
      fetchImpl: fetchReturning(
        new Response('not json {{{', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    })

    // Neither call may reject — both resolve to a structured not-live result.
    const [deadResult, malformedResult] = await Promise.all([deadEndpoint, malformedResponse])

    expect(deadResult.live).toBe(false)
    expect(malformedResult.live).toBe(false)
  })
})
