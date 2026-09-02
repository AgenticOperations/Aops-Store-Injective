// packages/agent-registry/public/registry.test.ts
//
// No mocks of this package's own functions — fixture I/O only (a fixture viem `custom`
// transport for the Identity Registry, a fixture `fetch` for 8004scan). Neither test hits the
// real network. Every "hostile" case here is the explicit requirement from the Chunk 2a verify
// step: a malformed/unexpected response must be rejected at this package's boundary and must
// never propagate upward as if it were valid data.
import { describe, expect, test } from 'bun:test'
import { type Address, custom, getAddress } from 'viem'
import {
  createIdentityRegistryClient,
  getAgentOwner,
  getAgentRegistrySnapshot,
  getScan8004SupportedChains,
} from './registry'

const TOKEN_ID = 42n
const OWNER_ADDRESS = `0x${'0'.repeat(38)}ab` as Address
const ZERO_RESULT = `0x${'0'.repeat(64)}` as const

function encodeAddressResult(address: Address): `0x${string}` {
  const hex = address.slice(2).toLowerCase().padStart(40, '0')
  return `0x${'0'.repeat(24)}${hex}` as `0x${string}`
}

/** A fixture `PublicClient` whose transport never touches the network — it answers `eth_call`
 * directly with whatever the test hands it, and fails loudly if anything calls a different RPC
 * method (so a silent behavior change in `readContract`'s internals can't hide a bug here). */
function fixtureIdentityClient(
  behavior: { kind: 'result'; value: `0x${string}` } | { kind: 'throw'; message: string },
) {
  return createIdentityRegistryClient(
    custom({
      request: async ({ method }) => {
        if (method !== 'eth_call') {
          throw new Error(`fixture transport received an unexpected RPC method: ${method}`)
        }
        if (behavior.kind === 'throw') throw new Error(behavior.message)
        return behavior.value
      },
    }),
  )
}

function fixtureFetch(response: Response): typeof fetch {
  return (async () => response) as unknown as typeof fetch
}

describe('getAgentOwner', () => {
  test('a valid Identity Registry response parses to the checksummed owner address', async () => {
    const client = fixtureIdentityClient({
      kind: 'result',
      value: encodeAddressResult(OWNER_ADDRESS),
    })
    const result = await getAgentOwner({ client, tokenId: TOKEN_ID })
    expect(result).toEqual({ ok: true, data: getAddress(OWNER_ADDRESS) })
  })

  test('the zero address is rejected as NOT_FOUND, never returned as a valid owner', async () => {
    const client = fixtureIdentityClient({ kind: 'result', value: ZERO_RESULT })
    const result = await getAgentOwner({ client, tokenId: TOKEN_ID })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  test('a hostile/malformed on-chain response (undersized garbage, not a real 32-byte word) is rejected and never propagates as a valid address', async () => {
    const client = fixtureIdentityClient({ kind: 'result', value: '0x1234' })
    const result = await getAgentOwner({ client, tokenId: TOKEN_ID })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(['RPC_ERROR', 'INVALID_RESPONSE']).toContain(result.error.code)
    }
  })

  test('an RPC/provider failure is reported as a typed RPC_ERROR, not thrown past this boundary', async () => {
    const client = fixtureIdentityClient({ kind: 'throw', message: 'simulated node outage' })
    const result = await getAgentOwner({ client, tokenId: TOKEN_ID })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('RPC_ERROR')
      expect(result.error.message).toContain('simulated node outage')
    }
  })
})

describe('getScan8004SupportedChains', () => {
  test('a valid /chains response parses correctly', async () => {
    const body = [
      {
        chain_key: 'bsc_testnet',
        chain_id: 97,
        name: 'BSC Testnet',
        is_testnet: true,
        enabled: true,
        provider_status: 'available',
      },
    ]
    const result = await getScan8004SupportedChains({
      fetchImpl: fixtureFetch(new Response(JSON.stringify(body), { status: 200 })),
    })
    expect(result).toEqual({ ok: true, data: body })
  })

  test('a hostile/malformed response (wrong shape, not the documented array) is rejected and never propagates as valid chain data', async () => {
    const result = await getScan8004SupportedChains({
      fetchImpl: fixtureFetch(
        new Response(JSON.stringify({ unexpected: 'object shape', not: 'an array' }), {
          status: 200,
        }),
      ),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_RESPONSE')
  })

  test('a garbage (non-JSON) response body is rejected, not thrown as an unhandled parse error', async () => {
    const result = await getScan8004SupportedChains({
      fetchImpl: fixtureFetch(new Response('not json at all {{{', { status: 200 })),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_RESPONSE')
  })

  test('a rate-limit response is reported gracefully as RATE_LIMITED, not thrown', async () => {
    const result = await getScan8004SupportedChains({
      fetchImpl: fixtureFetch(
        new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
      ),
    })
    expect(result).toEqual({
      ok: false,
      error: { code: 'RATE_LIMITED', message: '8004scan anonymous rate limit hit', status: 429 },
    })
  })

  test('a network failure is reported as NETWORK_ERROR, not an unhandled rejection', async () => {
    const failingFetch: typeof fetch = (async () => {
      throw new Error('simulated DNS failure')
    }) as unknown as typeof fetch
    const result = await getScan8004SupportedChains({ fetchImpl: failingFetch })
    expect(result).toEqual({
      ok: false,
      error: { code: 'NETWORK_ERROR', message: 'simulated DNS failure' },
    })
  })
})

describe('getAgentRegistrySnapshot', () => {
  test('ships the on-chain owner and an explicit, honest "unavailable" reputation state (never a fabricated number)', async () => {
    const client = fixtureIdentityClient({
      kind: 'result',
      value: encodeAddressResult(OWNER_ADDRESS),
    })
    const snapshot = await getAgentRegistrySnapshot({ client, tokenId: TOKEN_ID })
    expect(snapshot.owner).toEqual({ ok: true, data: getAddress(OWNER_ADDRESS) })
    expect(snapshot.reputation.status).toBe('unavailable')
    expect(snapshot.reputation.reason.length).toBeGreaterThan(0)
  })

  test('a broken on-chain read still returns a well-typed snapshot, not a throw', async () => {
    const client = fixtureIdentityClient({ kind: 'throw', message: 'simulated node outage' })
    const snapshot = await getAgentRegistrySnapshot({ client, tokenId: TOKEN_ID })
    expect(snapshot.owner.ok).toBe(false)
    expect(snapshot.reputation.status).toBe('unavailable')
  })
})
