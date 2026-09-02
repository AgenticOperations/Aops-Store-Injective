import { createRoute, z } from '@hono/zod-openapi'
import type { RouteHandler } from '@hono/zod-openapi'
import { agentScores, jobs, listings } from '@repo/database/schema'
import type { ListingStatus } from '@repo/domain/entities'
import { categoryEnum, listingStatusEnum } from '@repo/database/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { getApiContext } from '../context'
import type { ApiEnv } from '../types/env'

const CategorySchema = z.enum(categoryEnum.enumValues)
const StatusSchema = z.enum(listingStatusEnum.enumValues)

const ListingsQuery = z.object({
  status: z.string().optional(),
  category: CategorySchema.optional(),
})

const ListingSummarySchema = z.object({
  id: z.string().uuid(),
  agentId: z.string(),
  category: CategorySchema,
  status: StatusSchema,
  trustTier: z.string().nullable(),
  ownerWallet: z.string(),
  declaredEndpoint: z.string().nullable(),
  score: z.number().nullable(),
  confidence: z.number().nullable(),
  sampleSize: z.number(),
  activeHires: z.number(),
})

const ListingsResponse = z
  .object({ listings: z.array(ListingSummarySchema) })
  .openapi('ListingsResponse')

const ACTIVE_JOB_STATUSES = ['AUTHORIZED', 'ACTIVE', 'RUNNING', 'PAUSED', 'DEGRADED'] as const

export const listingsIndexRoute = createRoute({
  method: 'get',
  path: '/v1/listings',
  request: { query: ListingsQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: ListingsResponse } },
      description: 'Listing summaries — open catalog read',
    },
  },
})

export const listingsIndexHandler: RouteHandler<typeof listingsIndexRoute, ApiEnv> = async (c) => {
  const query = c.req.valid('query')
  const { db } = getApiContext()

  const statusFilter: ListingStatus[] = query.status
    ? (query.status.split(',').map((s) => s.trim()) as ListingStatus[])
    : (listingStatusEnum.enumValues as ListingStatus[])

  const whereClause = query.category
    ? and(inArray(listings.status, statusFilter), eq(listings.category, query.category))
    : inArray(listings.status, statusFilter)

  const rows = await db.select().from(listings).where(whereClause)

  if (rows.length === 0) {
    return c.json({ listings: [] })
  }

  const agentIds = rows.map((r) => r.agentId)
  const listingIds = rows.map((r) => r.id)

  const scores = await db
    .select()
    .from(agentScores)
    .where(inArray(agentScores.agentId, agentIds))
  const scoreByAgent = new Map(scores.map((s) => [s.agentId, s]))

  const hireCounts = await db
    .select({
      listingId: jobs.listingId,
      count: sql<number>`count(*)::int`,
    })
    .from(jobs)
    .where(
      and(
        inArray(jobs.listingId, listingIds),
        inArray(jobs.executionStatus, [...ACTIVE_JOB_STATUSES]),
      ),
    )
    .groupBy(jobs.listingId)

  const hiresByListing = new Map(hireCounts.map((r) => [r.listingId, r.count]))

  return c.json({
    listings: rows.map((row) => {
      const cached = scoreByAgent.get(row.agentId)
      return {
        id: row.id,
        agentId: row.agentId,
        category: row.category,
        status: row.status,
        trustTier: row.trustTier,
        ownerWallet: row.ownerWallet,
        declaredEndpoint: row.declaredEndpoint,
        score: cached?.score ? Number(cached.score) * 100 : null,
        confidence: cached?.confidence ? Number(cached.confidence) : null,
        sampleSize: cached?.sampleSize ?? 0,
        activeHires: hiresByListing.get(row.id) ?? 0,
      }
    }),
  })
}
