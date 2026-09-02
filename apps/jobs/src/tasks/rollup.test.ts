/**
 * Integration tests for E6 evidence rollup and the pending-task queue.
 *
 * Skips when `DATABASE_URL` is unset — same contract as `@repo/evidence/write.test.ts`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type DbClient, createDbClient } from '@repo/database/client'
import { getDatabaseUrl } from '@repo/database/keys'
import { agentScores, evidence, pendingTasks } from '@repo/database/schema'
import { rankWithCategoryDefaults } from '@repo/discovery/rank'
import type { DiscoveryCandidate } from '@repo/discovery/types'
import { recordEvidence } from '@repo/evidence/write'
import * as schema from '@repo/database/schema'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { claimPendingTasks, completeTask, enqueueTask } from '../queue'
import { dispatchTask } from '../dispatch'
import { createStubListingLifecycleDeps } from '../deps'
import { rollupAgentScore, runEvidenceRollup } from './rollup'

function tryGet(fn: () => string): string | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

const databaseUrl = tryGet(getDatabaseUrl)
const MIGRATIONS_FOLDER = new URL('../../../../packages/database/migrations', import.meta.url)
  .pathname

const FIXED_NOW = new Date('2026-09-02T12:00:00Z')
const AGENT_ID = 'agent-rollup-rank-test'

const LIVE_REBALANCERS: DiscoveryCandidate[] = [
  {
    id: 'lst-rebal-02',
    category: 'rebalancing',
    status: 'LIVE',
    trustTier: 'Medium',
    capabilities: ['PancakeSwap V3', 'CAKE/BNB', 'maker-only'],
    score: 78,
    confidence: 0.81,
    feeBps: 60,
    availability: 1,
  },
  {
    id: 'lst-rebal-03',
    category: 'rebalancing',
    status: 'LIVE',
    trustTier: 'High',
    capabilities: ['PancakeSwap V3', 'CAKE/BNB', 'base+limit', 'taker-fallback'],
    score: 84,
    confidence: 0.93,
    feeBps: 85,
    availability: 1,
  },
  {
    id: 'lst-rebal-04',
    category: 'rebalancing',
    status: 'LIVE',
    trustTier: 'Low',
    capabilities: ['PancakeSwap V3', 'BTCB/BNB'],
    score: 71,
    confidence: 0.22,
    feeBps: 30,
    availability: 0.5,
  },
]

function liveRebalancers(): DiscoveryCandidate[] {
  return LIVE_REBALANCERS
}

function rankOrder(candidates: DiscoveryCandidate[]): string[] {
  const result = rankWithCategoryDefaults(candidates)
  expect(result.ok).toBe(true)
  if (!result.ok) return []
  return result.ranked.map((row) => row.candidate.id)
}

function withAgentScore(
  candidates: DiscoveryCandidate[],
  listingId: string,
  score: number | null,
  confidence: number | null,
): DiscoveryCandidate[] {
  return candidates.map((candidate) =>
    candidate.id === listingId ? { ...candidate, score, confidence } : candidate,
  )
}

async function readAgentScore(db: DbClient, agentId: string) {
  const rows = await db.select().from(agentScores).where(eq(agentScores.agentId, agentId)).limit(1)
  return rows[0] ?? null
}

describe.skipIf(!databaseUrl)('evidence.rollup — set DATABASE_URL to run', () => {
  const url = databaseUrl as string
  let sql: ReturnType<typeof createDbClient>['sql']
  let db: DbClient

  beforeAll(async () => {
    ;({ db, sql } = createDbClient(url))
    await migrate(drizzle(sql, { schema }), { migrationsFolder: MIGRATIONS_FOLDER })
    await sql.unsafe('TRUNCATE evidence, agent_scores, pending_tasks CASCADE')
  })

  afterAll(async () => {
    await sql.unsafe('TRUNCATE evidence, agent_scores, pending_tasks CASCADE')
    await sql.end()
  })

  test('new evidence row triggers rollup that changes discovery rank position', async () => {
    const baseline = liveRebalancers()
    const beforeOrder = rankOrder(baseline)
    expect(beforeOrder.indexOf('lst-rebal-04')).toBe(2)

    for (let i = 0; i < 5; i++) {
      await recordEvidence(db, {
        agentId: AGENT_ID,
        versionHash: 'v1',
        actionType: 'rebalance_outcome',
        proofType: 'OUTCOME',
        evidenceLevel: 6,
        source: 'marketplace-benchmark',
        payload: { normalizedValue: 1.0, seq: i },
        createdAt: FIXED_NOW,
      })
    }

    await rollupAgentScore(db, AGENT_ID, { now: FIXED_NOW })
    const cached = await readAgentScore(db, AGENT_ID)
    expect(cached).not.toBeNull()
    expect(cached?.score).not.toBeNull()

    const scorePercent = Number(cached?.score) * 100
    const confidence = Number(cached?.confidence)
    const afterCandidates = withAgentScore(baseline, 'lst-rebal-04', scorePercent, confidence)
    const afterOrder = rankOrder(afterCandidates)

    expect(afterOrder.indexOf('lst-rebal-04')).toBeLessThan(beforeOrder.indexOf('lst-rebal-04'))
    expect(afterOrder[0]).toBe('lst-rebal-04')
  })

  test('re-run after simulated crash is a no-op — idempotency_key duplicate', async () => {
    const agentId = 'agent-rollup-idempotent'
    await db.delete(evidence).where(eq(evidence.agentId, agentId))
    await db.delete(agentScores).where(eq(agentScores.agentId, agentId))
    await db
      .delete(pendingTasks)
      .where(eq(pendingTasks.idempotencyKey, `evidence.rollup:${agentId}:crash-test`))

    await recordEvidence(db, {
      agentId,
      versionHash: 'v1',
      actionType: 'heartbeat',
      proofType: 'OUTCOME',
      evidenceLevel: 4,
      source: 'test',
      payload: { normalizedValue: 0.9 },
      createdAt: FIXED_NOW,
    })

    const idempotencyKey = `evidence.rollup:${agentId}:crash-test`
    const firstEnqueue = await enqueueTask(db, {
      taskName: 'evidence.rollup',
      idempotencyKey,
      payload: { agentId },
    })
    const duplicateEnqueue = await enqueueTask(db, {
      taskName: 'evidence.rollup',
      idempotencyKey,
      payload: { agentId },
    })

    expect(firstEnqueue.enqueued).toBe(true)
    expect(duplicateEnqueue.enqueued).toBe(false)

    const claimed = await claimPendingTasks(db, 5)
    expect(claimed.some((task) => task.idempotencyKey === idempotencyKey)).toBe(true)

    const listingDeps = createStubListingLifecycleDeps(db)
    for (const task of claimed) {
      await dispatchTask({ db, listingDeps }, task)
      await completeTask(db, task.id)
    }

    const afterTaskScore = await readAgentScore(db, agentId)

    const crashRetryEnqueue = await enqueueTask(db, {
      taskName: 'evidence.rollup',
      idempotencyKey,
      payload: { agentId },
    })
    expect(crashRetryEnqueue.enqueued).toBe(false)

    await runEvidenceRollup(db, { agentId }, { now: FIXED_NOW })
    const afterDirectRollup = await readAgentScore(db, agentId)

    expect(afterDirectRollup?.score).toBe(afterTaskScore?.score)
    expect(afterDirectRollup?.confidence).toBe(afterTaskScore?.confidence)
    expect(afterDirectRollup?.sampleSize).toBe(afterTaskScore?.sampleSize)
    expect(afterDirectRollup?.methodologyVersion).toBe(afterTaskScore?.methodologyVersion)
  })
})
