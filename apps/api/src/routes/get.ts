import { createRoute, z } from '@hono/zod-openapi'
import type { RouteHandler } from '@hono/zod-openapi'
import { getEvidenceForAgent } from '@repo/evidence/query'
import { agentScores } from '@repo/database/schema'
import { eq } from 'drizzle-orm'
import { getApiContext } from '../context'
import { loadListingById } from '../services/listings'
import type { ApiEnv } from '../types/env'

const GetParams = z.object({ id: z.string().uuid() })
const GetQuery = z.object({ id: z.string().uuid() })

const GetResponse = z
  .object({
    id: z.string().uuid(),
    agentId: z.string(),
    category: z.string(),
    status: z.string(),
    trustTier: z.string().nullable(),
    ownerWallet: z.string(),
    declaredEndpoint: z.string().nullable(),
    score: z.number().nullable(),
    confidence: z.number().nullable(),
    sampleSize: z.number(),
    evidence: z.array(
      z.object({
        evidenceId: z.string(),
        proofType: z.string(),
        evidenceLevel: z.number(),
        actionType: z.string(),
        source: z.string(),
        createdAt: z.string(),
      }),
    ),
  })
  .openapi('GetResponse')

export const getRoute = createRoute({
  method: 'get',
  path: '/v1/agents/{id}',
  request: { params: GetParams },
  responses: {
    200: {
      content: { 'application/json': { schema: GetResponse } },
      description: 'Single listing detail',
    },
    404: { description: 'Not found' },
  },
})

export const getByQueryRoute = createRoute({
  method: 'get',
  path: '/v1/get',
  request: { query: GetQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: GetResponse } },
      description: 'Single listing detail (alias)',
    },
    404: { description: 'Not found' },
  },
})

async function buildListingDetail(id: string) {
  const { db } = getApiContext()
  const listing = await loadListingById(db, id)
  if (!listing) return null

  const evidenceResult = await getEvidenceForAgent(db, listing.agentId)
  const scoreRows = await db
    .select()
    .from(agentScores)
    .where(eq(agentScores.agentId, listing.agentId))
    .limit(1)
  const cached = scoreRows[0]

  return {
    id: listing.id,
    agentId: listing.agentId,
    category: listing.category,
    status: listing.status,
    trustTier: listing.trustTier,
    ownerWallet: listing.ownerWallet,
    declaredEndpoint: listing.declaredEndpoint,
    score: cached?.score ? Number(cached.score) * 100 : null,
    confidence: cached?.confidence ? Number(cached.confidence) : null,
    sampleSize: cached?.sampleSize ?? 0,
    evidence:
      evidenceResult.kind === 'found'
        ? evidenceResult.rows.map((row) => ({
            evidenceId: row.evidenceId,
            proofType: row.proofType,
            evidenceLevel: row.evidenceLevel,
            actionType: row.actionType,
            source: row.source,
            createdAt: row.createdAt.toISOString(),
          }))
        : [],
  }
}

export const getHandler: RouteHandler<typeof getRoute, ApiEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const detail = await buildListingDetail(id)
  if (!detail) {
    return c.json({ error: { code: 'NOT_FOUND', message: `listing ${id} not found` } }, 404)
  }
  return c.json(detail)
}

export const getByQueryHandler: RouteHandler<typeof getByQueryRoute, ApiEnv> = async (c) => {
  const { id } = c.req.valid('query')
  const detail = await buildListingDetail(id)
  if (!detail) {
    return c.json({ error: { code: 'NOT_FOUND', message: `listing ${id} not found` } }, 404)
  }
  return c.json(detail)
}
