// packages/listings/public/lifecycle.test.ts
//
// Fixture `getAgentOwner` / `probeEndpoint` only — no real network. Database tests skip when
// `DATABASE_URL` is unset (same discipline as `@repo/database`'s schema tests).

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createIdentityRegistryClient } from '@repo/agent-registry/registry'
import { createDbClient } from '@repo/database/client'
import { getDatabaseUrl } from '@repo/database/keys'
import { listings } from '@repo/database/schema'
import { INITIAL_TRUST_TIER_ON_LIVE } from '@repo/domain/state-machines'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { type Address, type Hex, type TypedDataDomain, custom, getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  CONSECUTIVE_PROBE_SUCCESS_THRESHOLD,
  type GetAgentOwnerFn,
  type ListingLifecycleDeps,
  type ProbeEndpointFn,
  claimListing,
  markDegraded,
  markLive,
  selfRegister,
  suspend,
  tickEndpointProbe,
  verifyOwnership,
} from './lifecycle'

const MIGRATIONS_FOLDER = new URL('../../database/migrations', import.meta.url).pathname

function tryGet(fn: () => string): string | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

const databaseUrl = tryGet(getDatabaseUrl)

const TEST_PRIVATE_KEY =
  '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as const
const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY)
const OWNER_ADDRESS = testAccount.address

const CLAIM_DOMAIN: TypedDataDomain = {
  name: 'AopsListingClaim',
  version: '1',
  chainId: 56,
}

const CLAIM_TYPES = {
  Claim: [
    { name: 'listingId', type: 'string' },
    { name: 'agentId', type: 'string' },
  ],
} as const

async function signClaim(listingId: string, agentId: string): Promise<Hex> {
  return testAccount.signTypedData({
    domain: CLAIM_DOMAIN,
    types: CLAIM_TYPES,
    primaryType: 'Claim',
    message: { listingId, agentId },
  })
}

function fixtureGetAgentOwner(owner: Address = OWNER_ADDRESS): GetAgentOwnerFn {
  return async () => ({ ok: true, data: getAddress(owner) })
}

function fixtureProbeEndpoint(live = true): ProbeEndpointFn {
  return async (url) => {
    if (live) {
      return {
        live: true,
        url,
        httpStatus: 200,
        latencyMs: 12,
        checkedAt: new Date().toISOString(),
      }
    }
    return {
      live: false,
      url,
      reason: 'connection_refused',
      httpStatus: null,
      latencyMs: null,
      checkedAt: new Date().toISOString(),
    }
  }
}

function fixtureRegistryErrorGetAgentOwner(): GetAgentOwnerFn {
  return async () => ({
    ok: false,
    error: { code: 'RPC_ERROR', message: 'simulated registry outage' },
  })
}

function fixtureClient() {
  return createIdentityRegistryClient(
    custom({
      request: async () => {
        throw new Error('fixture client should never be called when getAgentOwner is injected')
      },
    }),
  )
}

describe('listing lifecycle — pure transition helpers', () => {
  test('CONSECUTIVE_PROBE_SUCCESS_THRESHOLD is 3 per architecture docs', () => {
    expect(CONSECUTIVE_PROBE_SUCCESS_THRESHOLD).toBe(3)
    expect(INITIAL_TRUST_TIER_ON_LIVE).toBe('Low')
  })
})

describe.skipIf(!databaseUrl)('listing lifecycle — database integration', () => {
  const url = databaseUrl as string
  let sql: ReturnType<typeof postgres>
  let deps: ListingLifecycleDeps
  let listingId: string
  const agentId = 'agent-fixture-001'

  beforeAll(async () => {
    sql = postgres(url, { max: 1, onnotice: () => {} })
    await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE')
    await sql.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE')
    await sql.unsafe('CREATE SCHEMA public')

    const adminDb = drizzle(sql)
    await migrate(adminDb, { migrationsFolder: MIGRATIONS_FOLDER })

    const { db } = createDbClient(url)
    deps = {
      db,
      getAgentOwner: fixtureGetAgentOwner(),
      probeEndpoint: fixtureProbeEndpoint(true),
    }
  })

  afterAll(async () => {
    await sql.end()
  })

  test('DISCOVERED → LIVE selfRegister end-to-end with fixture registry and probe deps', async () => {
    const inserted = await deps.db
      .insert(listings)
      .values({
        agentId,
        category: 'rebalancing',
        status: 'DISCOVERED',
        ownerWallet: OWNER_ADDRESS,
        erc8004ChainId: 56,
        erc8004TokenId: '42',
      })
      .returning({ id: listings.id })

    listingId = inserted[0]?.id as string
    expect(listingId).toBeDefined()

    const signature = await signClaim(listingId, agentId)

    const result = await selfRegister(deps, {
      listingId,
      ownerWallet: OWNER_ADDRESS,
      declaredEndpoint: 'https://agent.example.com/health',
      client: fixtureClient(),
      claimSignature: {
        domain: CLAIM_DOMAIN,
        types: CLAIM_TYPES,
        primaryType: 'Claim',
        message: { listingId, agentId },
        signature,
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.status).toBe('LIVE')
      expect(result.data.trustTier).toBe('Low')
      expect(result.data.declaredEndpoint).toBe('https://agent.example.com/health')
      expect(result.data.endpointProbeSuccessCount).toBe(CONSECUTIVE_PROBE_SUCCESS_THRESHOLD)
    }
  })

  test('verifyOwnership rejects when registry read fails', async () => {
    const inserted = await deps.db
      .insert(listings)
      .values({
        agentId: 'agent-registry-fail',
        category: 'grid_trading',
        status: 'DISCOVERED',
        ownerWallet: OWNER_ADDRESS,
        erc8004ChainId: 56,
        erc8004TokenId: '99',
      })
      .returning({ id: listings.id })

    const id = inserted[0]?.id as string
    const claimed = await claimListing(deps, {
      listingId: id,
      ownerWallet: OWNER_ADDRESS,
      declaredEndpoint: 'https://agent.example.com/health',
    })
    expect(claimed.ok).toBe(true)

    const badDeps: ListingLifecycleDeps = {
      ...deps,
      getAgentOwner: fixtureRegistryErrorGetAgentOwner(),
    }

    const verified = await verifyOwnership(badDeps, {
      listingId: id,
      client: fixtureClient(),
      claimSignature: {
        domain: CLAIM_DOMAIN,
        types: CLAIM_TYPES,
        primaryType: 'Claim',
        message: { listingId: id, agentId: 'agent-registry-fail' },
        signature: await signClaim(id, 'agent-registry-fail'),
      },
    })

    expect(verified.ok).toBe(false)
    if (!verified.ok) expect(verified.error.code).toBe('REGISTRY_ERROR')
  })

  test('tickEndpointProbe resets success count on failure and LIVE degrades immediately', async () => {
    const inserted = await deps.db
      .insert(listings)
      .values({
        agentId: 'agent-degrade',
        category: 'yield_optimization',
        status: 'LIVE',
        trustTier: 'Low',
        ownerWallet: OWNER_ADDRESS,
        declaredEndpoint: 'https://agent.example.com/health',
        endpointProbeSuccessCount: CONSECUTIVE_PROBE_SUCCESS_THRESHOLD,
      })
      .returning({ id: listings.id })

    const id = inserted[0]?.id as string

    const deadProbeDeps: ListingLifecycleDeps = {
      ...deps,
      probeEndpoint: fixtureProbeEndpoint(false),
    }

    const degraded = await tickEndpointProbe(deadProbeDeps, { listingId: id })
    expect(degraded.ok).toBe(true)
    if (degraded.ok) {
      expect(degraded.data.status).toBe('DEGRADED')
      expect(degraded.data.endpointProbeSuccessCount).toBe(0)
    }

    const liveAgainDeps: ListingLifecycleDeps = {
      ...deps,
      probeEndpoint: fixtureProbeEndpoint(true),
    }

    for (let i = 0; i < CONSECUTIVE_PROBE_SUCCESS_THRESHOLD - 1; i++) {
      const pending = await tickEndpointProbe(liveAgainDeps, { listingId: id })
      expect(pending.ok).toBe(false)
      if (!pending.ok) expect(pending.error.code).toBe('ENDPOINT_PROBE_PENDING')
    }

    const recovered = await tickEndpointProbe(liveAgainDeps, { listingId: id })
    expect(recovered.ok).toBe(true)
    if (recovered.ok) {
      expect(recovered.data.status).toBe('LIVE')
      expect(recovered.data.trustTier).toBe('Low')
    }
  })

  test('markDegraded, markLive, suspend transitions use LISTING_TRANSITIONS', async () => {
    const inserted = await deps.db
      .insert(listings)
      .values({
        agentId: 'agent-ops',
        category: 'health_factor_monitoring',
        status: 'LIVE',
        trustTier: 'Low',
        ownerWallet: OWNER_ADDRESS,
        declaredEndpoint: 'https://agent.example.com/health',
      })
      .returning({ id: listings.id })

    const id = inserted[0]?.id as string

    const degraded = await markDegraded(deps, { listingId: id })
    expect(degraded.ok).toBe(true)
    if (degraded.ok) expect(degraded.data.status).toBe('DEGRADED')

    const relive = await markLive(deps, { listingId: id })
    expect(relive.ok).toBe(true)
    if (relive.ok) expect(relive.data.status).toBe('LIVE')

    const suspended = await suspend(deps, { listingId: id })
    expect(suspended.ok).toBe(true)
    if (suspended.ok) expect(suspended.data.status).toBe('SUSPENDED')
  })
})
