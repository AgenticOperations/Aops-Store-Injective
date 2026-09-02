import { createRoute, z } from '@hono/zod-openapi'
import type { RouteHandler } from '@hono/zod-openapi'
import { authorizations, jobs } from '@repo/database/schema'
import { eq } from 'drizzle-orm'
import { getApiContext } from '../context'
import { loadListingById } from '../services/listings'
import type { ApiEnv } from '../types/env'

const JobParams = z.object({ id: z.string().uuid() })

const JobResponse = z
  .object({
    jobId: z.string().uuid(),
    authorizationId: z.string().uuid(),
    listingId: z.string().uuid(),
    providerAgentId: z.string(),
    executionStatus: z.string(),
    settlementStatus: z.string(),
    rail: z.string(),
    createdAt: z.string(),
    feeBps: z.number().nullable(),
    feeChargedAmount: z.string().nullable(),
    measuredPerformanceFee: z.string().nullable(),
  })
  .openapi('JobResponse')

export const jobGetRoute = createRoute({
  method: 'get',
  path: '/v1/jobs/{id}',
  request: { params: JobParams },
  responses: {
    200: {
      content: { 'application/json': { schema: JobResponse } },
      description: 'Single job detail — open catalog read',
    },
    404: { description: 'Not found' },
  },
})

export const jobGetHandler: RouteHandler<typeof jobGetRoute, ApiEnv> = async (c) => {
  const { id } = c.req.valid('param')
  const { db } = getApiContext()

  const jobRows = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  const job = jobRows[0]
  if (!job) {
    return c.json({ error: { code: 'NOT_FOUND', message: `job ${id} not found` } }, 404)
  }

  const authRows = await db
    .select()
    .from(authorizations)
    .where(eq(authorizations.id, job.authorizationId))
    .limit(1)
  const authorization = authRows[0]
  if (!authorization) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'authorization not found' } }, 404)
  }

  const listing = await loadListingById(db, job.listingId)
  if (!listing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'listing not found' } }, 404)
  }

  return c.json({
    jobId: job.id,
    authorizationId: job.authorizationId,
    listingId: job.listingId,
    providerAgentId: listing.agentId,
    executionStatus: job.executionStatus,
    settlementStatus: job.settlementStatus,
    rail: authorization.rail,
    createdAt: job.createdAt.toISOString(),
    feeBps: job.feeBps,
    feeChargedAmount: job.feeChargedAmount,
    measuredPerformanceFee: job.measuredPerformanceFee,
  })
}
