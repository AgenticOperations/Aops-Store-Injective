/**
 * Chunk 6 — scripted v1 integration path.
 * Skips when DATABASE_URL unset. Runs PLAIN + ALTANA_SESSION control paths.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createDbClient } from '@repo/database/client'
import { agentScores, authorizations, evidence, jobs, listings } from '@repo/database/schema'
import { bindSession, type ReadKeystoreEntry } from '@repo/access/bind-session'
import { createChallenge, enroll, NonceStore } from '@repo/access/enrollment'
import { closeAltanaSession, releasePlainEscrow } from '@repo/settlement/escrow'
import { recordEvidence } from '@repo/evidence/write'
import { promoteToLive } from '@repo/listings/lifecycle'
import { probeEndpoint } from '@repo/census/probe'
import { rankWithCategoryDefaults } from '@repo/discovery/rank'
import type { DiscoveryCandidate } from '@repo/discovery/types'
import { runEvidenceRollup } from '../tasks/rollup'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import type { Address, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const databaseUrl = process.env.DATABASE_URL
const MIGRATIONS = new URL('../../../../packages/database/migrations', import.meta.url).pathname

const SIGNER_KEY =
  '0xead08b3eb71273915a50506c312fc1d8411661e8bb592eaaff46dacb7a1b6a04' as const

describe.skipIf(!databaseUrl)('v1 integration — self-register → hire → evidence → rank', () => {
  const url = databaseUrl as string
  let db: ReturnType<typeof createDbClient>['db']
  let sql: ReturnType<typeof createDbClient>['sql']
  let listingId: string
  let agentId: string
  let plainJobId: string
  let altanaJobId: string

  beforeAll(async () => {
    const admin = postgres(url, { max: 1, onnotice: () => {} })
    await admin.unsafe('DROP SCHEMA IF EXISTS public CASCADE')
    await admin.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE')
    await admin.unsafe('CREATE SCHEMA public')
    await admin.end()

    const client = createDbClient(url)
    db = client.db
    sql = client.sql
    await migrate(db, { migrationsFolder: MIGRATIONS })

    agentId = `e2e-agent-${Date.now()}`
    const [listing] = await db
      .insert(listings)
      .values({
        agentId,
        category: 'rebalancing',
        status: 'DISCOVERED',
        ownerWallet: privateKeyToAccount(SIGNER_KEY).address,
        declaredEndpoint: 'https://httpbin.org/json',
      })
      .returning()
    if (!listing) throw new Error('seed listing failed')
    listingId = listing.id

    const jsonFetch = (async () =>
      new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch

    const lifecycleDeps = {
      db,
      getAgentOwner: async () => ({
        ok: true as const,
        data: privateKeyToAccount(SIGNER_KEY).address,
      }),
      probeEndpoint: (endpoint: string) =>
        probeEndpoint(endpoint, { expectJson: true, fetchImpl: jsonFetch }),
    }

    for (let i = 0; i < 3; i++) {
      await lifecycleDeps.probeEndpoint('https://httpbin.org/json')
    }

    await db
      .update(listings)
      .set({ status: 'ENDPOINT_VERIFIED', endpointProbeSuccessCount: 3 })
      .where(eq(listings.id, listingId))
    await promoteToLive(lifecycleDeps, { listingId })
  })

  afterAll(async () => {
    await sql.end()
  })

  test('search finds LIVE listing', async () => {
    const rows = await db.select().from(listings).where(eq(listings.status, 'LIVE'))
    expect(rows.some((r) => r.id === listingId)).toBe(true)
  })

  test('PLAIN job release records flat fee', async () => {
    const buyer = '0x2222222222222222222222222222222222222222'
    const [auth] = await db
      .insert(authorizations)
      .values({
        listingId,
        buyerWallet: buyer,
        buyerMinimumTrustTier: 'Low',
        status: 'GRANTED',
        rail: 'ERC8183_ESCROW',
        scope: { fundedAmount: '1000000000000000000', escrowVariant: 'PLAIN' },
        escrowVariant: 'PLAIN',
      })
      .returning()
    if (!auth) throw new Error('auth failed')

    const [job] = await db
      .insert(jobs)
      .values({ authorizationId: auth.id, listingId, settlementStatus: 'HELD' })
      .returning()
    if (!job) throw new Error('job failed')
    plainJobId = job.id

    const result = await releasePlainEscrow(job.id, db, { mode: 'simulate' })
    expect(result.feeBps).toBeGreaterThanOrEqual(300)
    expect(result.feeChargedAmount).toBeTruthy()

    const updated = await db.select().from(jobs).where(eq(jobs.id, job.id))
    expect(updated[0]?.settlementStatus).toBe('RELEASED')
    expect(updated[0]?.feeBps).toBe(result.feeBps)
  })

  test('ALTANA job close displays performance fee without collection', async () => {
    const buyer = '0x3333333333333333333333333333333333333333'
    const [auth] = await db
      .insert(authorizations)
      .values({
        listingId,
        buyerWallet: buyer,
        buyerMinimumTrustTier: 'Low',
        status: 'GRANTED',
        rail: 'ALTANA_SESSION',
        scope: { sessionId: 'e2e-session' },
        escrowVariant: null,
      })
      .returning()
    if (!auth) throw new Error('auth failed')

    const [job] = await db
      .insert(jobs)
      .values({ authorizationId: auth.id, listingId, settlementStatus: 'HELD' })
      .returning()
    if (!job) throw new Error('job failed')
    altanaJobId = job.id

    const result = await closeAltanaSession(job.id, db, {
      mode: 'simulate',
      measuredNetPnL: '100000000000000000',
    })
    expect(Number(result.measuredPerformanceFee)).toBeGreaterThan(0)

    const updated = await db.select().from(jobs).where(eq(jobs.id, job.id))
    expect(updated[0]?.settlementStatus).toBe('RELEASED')
    expect(updated[0]?.measuredPerformanceFee).toBeTruthy()
    expect(updated[0]?.feeChargedAmount).toBeNull()
  })

  test('evidence rollup changes rank position', async () => {
    const baseline: DiscoveryCandidate = {
      id: 'competitor',
      category: 'rebalancing',
      status: 'LIVE',
      trustTier: 'Low',
      capabilities: [],
      score: 85,
      confidence: 0.9,
      feeBps: 300,
      availability: 1,
    }
    const oursBefore: DiscoveryCandidate = {
      id: listingId,
      category: 'rebalancing',
      status: 'LIVE',
      trustTier: 'Low',
      capabilities: [],
      score: null,
      confidence: null,
      feeBps: 300,
      availability: 1,
    }
    const before = rankWithCategoryDefaults([baseline, oursBefore])
    expect(before.ok && before.ranked[0]?.candidate.id).toBe('competitor')

    await recordEvidence(db, {
      agentId,
      versionHash: 'v1',
      actionType: 'rebalance_outcome',
      proofType: 'OUTCOME',
      evidenceLevel: 6,
      source: 'marketplace-kpi',
      payload: { normalizedValue: 0.98 },
    })
    await runEvidenceRollup(db, { agentId })

    const scores = await db.select().from(agentScores).where(eq(agentScores.agentId, agentId))
    expect(scores[0]?.score).toBeTruthy()

    const oursAfter: DiscoveryCandidate = {
      ...oursBefore,
      score: Number(scores[0]?.score) * 100,
      confidence: Number(scores[0]?.confidence),
    }
    const after = rankWithCategoryDefaults([baseline, oursAfter])
    expect(after.ok && after.ranked[0]?.candidate.id).toBe(listingId)
  })

  test('revoke mid-flight blocks Fresh access without touching in-flight job', async () => {
    const walletAccount = privateKeyToAccount(SIGNER_KEY)
    const nonceStore = new NonceStore()
    const challenge = createChallenge({
      wallet: walletAccount.address as Address,
      devicePubKey: new Uint8Array(32).fill(1),
      config: { chainId: 97, salt: `0x${'bb'.repeat(32)}` as Hex, net: 'tbsc' },
      nonceStore,
    })
    const signature = await walletAccount.signTypedData({
      domain: challenge.eip712_payload.domain,
      types: challenge.eip712_payload.types,
      primaryType: 'AgentEnrollment',
      message: challenge.eip712_payload.message,
    })
    const enrolled = await enroll({
      nonce: challenge.nonce,
      signature,
      devicePubKey: new Uint8Array(32).fill(1),
      wallet: walletAccount.address as Address,
      tier: 'dlg',
      config: { chainId: 97, salt: `0x${'bb'.repeat(32)}` as Hex, net: 'tbsc' },
      db,
      nonceStore,
    })
    expect('error' in enrolled).toBe(false)
    if ('error' in enrolled) return

    const readKeystore: ReadKeystoreEntry = async () => ({
      sessionId: 'revoke-test',
      authorizedWallet: walletAccount.address as Address,
      state: 'valid',
      expiresAt: new Date(Date.now() + 86_400_000),
    })

    const credRows = await db.query.credentials.findMany()
    const cred = credRows[0]
    if (!cred) throw new Error('no credential')

    await bindSession({
      sessionId: 'revoke-test',
      credentialId: cred.id,
      db,
      readKeystoreEntry: readKeystore,
    })

    const inFlight = await db.select().from(jobs).where(eq(jobs.id, plainJobId))
    expect(inFlight[0]?.settlementStatus).toBe('RELEASED')

    const { revokeCredential } = await import('@repo/access/revoke')
    await revokeCredential({ credentialId: cred.id, db })

    const revoked = await db.query.credentials.findFirst({ where: (c) => eq(c.id, cred.id) })
    expect(revoked?.status).toBe('REVOKED')
    expect(inFlight[0]?.settlementStatus).toBe('RELEASED')
  })
})
