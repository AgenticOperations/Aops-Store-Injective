import { describe, expect, test } from 'bun:test'
import { app } from '../app'

const databaseUrl = process.env.DATABASE_URL

describe('POST /v1/jobs without credential', () => {
  test('returns 401 with correct error shape, not 500', async () => {
    const res = await app.request('/v1/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId: '00000000-0000-4000-8000-000000000001',
        buyerMinimumTrustTier: 'Low',
        rail: 'ERC8183_ESCROW',
        scope: {},
      }),
    })

    expect(res.status).toBe(401)
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; step?: string }
    }
    expect(body.error?.code).toBe('UNAUTHORIZED')
    expect(body.error?.step).toBe('PROOF_REQUIRED')
    expect(body.error?.message).toContain('PROOF_REQUIRED')
  })
})

describe.skipIf(!databaseUrl)('GET /v1/search — set DATABASE_URL to run', () => {
  test('unauthenticated request succeeds with 200', async () => {
    const res = await app.request('/v1/search?category=rebalancing')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      results: unknown[]
      methodologyVersion: string
      category: string
    }
    expect(Array.isArray(body.results)).toBe(true)
    expect(body.methodologyVersion).toBeTruthy()
    expect(body.category).toBe('rebalancing')
  })
})

describe('discovery meta routes', () => {
  test('GET /llms.txt returns plain text', async () => {
    const res = await app.request('/llms.txt')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    const text = await res.text()
    expect(text).toContain('/v1/search')
    expect(text).toContain('/v1/jobs')
  })

  test('GET /.well-known/agent.json includes AOPS-PoP securitySchemes', async () => {
    const res = await app.request('/.well-known/agent.json')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { securitySchemes?: Record<string, unknown> }
    expect(body.securitySchemes?.AOPS_PoP).toBeDefined()
  })
})
