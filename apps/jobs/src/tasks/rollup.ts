/**
 * E6 — recompute agent score + confidence from append-only evidence.
 */

import type { DbClient } from '@repo/database/client'
import { type EvidenceRow, agentScores, evidence } from '@repo/database/schema'
import { getEvidenceForAgent } from '@repo/evidence/query'
import type { EvidenceLevel } from '@repo/domain/types'
import { computeScoreResult, type WeightedObservation } from '@repo/scoring/score'
import { DEFAULT_SUSPICION_SCORE } from '@repo/scoring/independence'
import { weight } from '@repo/scoring/weight'
import { eq } from 'drizzle-orm'

export const DEFAULT_EVIDENCE_HALF_LIFE_DAYS = 30

export interface EvidenceRollupPayload {
  agentId?: string
  batch?: boolean
}

export interface RunEvidenceRollupOptions {
  now?: Date
}

function extractNormalizedValue(payload: unknown): number {
  if (payload && typeof payload === 'object' && 'normalizedValue' in payload) {
    const value = (payload as { normalizedValue: unknown }).normalizedValue
    if (typeof value === 'number' && value >= 0 && value <= 1) return value
  }
  return 0.5
}

function mapEvidenceToObservations(rows: EvidenceRow[], now: Date): WeightedObservation[] {
  return rows.map((row) => {
    const normalizedValue = extractNormalizedValue(row.payload)
    const evidenceLevel = row.evidenceLevel as EvidenceLevel
    const observationWeight = weight({
      evidenceLevel,
      suspicionScore: DEFAULT_SUSPICION_SCORE,
      createdAt: row.createdAt,
      now,
      halfLifeDays: DEFAULT_EVIDENCE_HALF_LIFE_DAYS,
      economicRelationshipTier: 'NO_INTERACTION',
      versionChangedAt: null,
    })
    return { normalizedValue, weight: observationWeight, evidenceLevel }
  })
}

async function upsertAgentScore(
  db: DbClient,
  agentId: string,
  result: ReturnType<typeof computeScoreResult>,
): Promise<void> {
  if (result.kind === 'no_evidence') {
    await db
      .insert(agentScores)
      .values({
        agentId,
        score: null,
        confidence: null,
        sampleSize: 0,
        methodologyVersion: result.methodologyVersion,
      })
      .onConflictDoUpdate({
        target: agentScores.agentId,
        set: {
          score: null,
          confidence: null,
          sampleSize: 0,
          methodologyVersion: result.methodologyVersion,
          updatedAt: new Date(),
        },
      })
    return
  }

  await db
    .insert(agentScores)
    .values({
      agentId,
      score: String(result.score),
      confidence: String(result.confidence),
      sampleSize: result.sampleSize,
      methodologyVersion: result.methodologyVersion,
    })
    .onConflictDoUpdate({
      target: agentScores.agentId,
      set: {
        score: String(result.score),
        confidence: String(result.confidence),
        sampleSize: result.sampleSize,
        methodologyVersion: result.methodologyVersion,
        updatedAt: new Date(),
      },
    })
}

export async function rollupAgentScore(
  db: DbClient,
  agentId: string,
  options: RunEvidenceRollupOptions = {},
): Promise<void> {
  const now = options.now ?? new Date()
  const evidenceResult = await getEvidenceForAgent(db, agentId)

  if (evidenceResult.kind === 'no_evidence') {
    await upsertAgentScore(db, agentId, computeScoreResult([]))
    return
  }

  const observations = mapEvidenceToObservations(evidenceResult.rows, now)
  const result = computeScoreResult(observations)
  await upsertAgentScore(db, agentId, result)
}

async function listDistinctAgentIds(db: DbClient): Promise<string[]> {
  const rows = await db.selectDistinct({ agentId: evidence.agentId }).from(evidence)
  return rows.map((row) => row.agentId)
}

/** Roll up one agent, or every agent with evidence when `payload.batch` is true. */
export async function runEvidenceRollup(
  db: DbClient,
  payload: EvidenceRollupPayload = {},
  options: RunEvidenceRollupOptions = {},
): Promise<void> {
  if (payload.batch) {
    const agentIds = await listDistinctAgentIds(db)
    for (const agentId of agentIds) {
      await rollupAgentScore(db, agentId, options)
    }
    return
  }

  if (!payload.agentId) {
    throw new Error('evidence.rollup requires payload.agentId unless batch is true')
  }

  await rollupAgentScore(db, payload.agentId, options)
}
