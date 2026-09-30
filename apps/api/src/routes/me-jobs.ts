import { createRoute, z } from '@hono/zod-openapi'
import type { RouteHandler } from '@hono/zod-openapi'
import { getJobHistory } from '@repo/access/job-history'
import { accounts } from '@repo/database/schema'
import type { JobStatus } from '@repo/domain/entities'
import { eq } from 'drizzle-orm'
import type { Address } from 'viem'
import { getApiContext } from '../context'
import type { ApiEnv } from '../types/env'

const MeJobsQuery = z.object({
  status: z.string().optional(),
  settlementStatus: z.enum(['HELD', 'RELEASED', 'REFUNDED', 'DISPUTED']).optional(),
  hiredVia: z.string().uuid().optional(),
})

const MeJobsResponse = z
  .object({
    jobs: z.array(
      z.object({
        jobId: z.string().uuid(),
        authorizationId: z.string().uuid(),
        listingId: z.string().uuid(),
        executionStatus: z.string(),
        settlementStatus: z.string(),
        providerAgentId: z.string(),
        createdAt: z.string(),
      }),
    ),
  })
  .openapi('MeJobsResponse')

export const meJobsRoute = createRoute({
  method: 'get',
  path: '/v1/me/jobs',
  request: { query: MeJobsQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: MeJobsResponse } },
      description: 'Wallet-keyed job history — Standing tier',
    },
  },
  security: [{ AOPS_PoP: [] }],
})

export const meJobsHandler: RouteHandler<typeof meJobsRoute, ApiEnv> = async (c) => {
  const query = c.req.valid('query')
  const { db } = getApiContext()
  const accountId = c.get('accountId')!

  const accountRows = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1)
  const account = accountRows[0]
  if (!account) {
    return c.json({ jobs: [] })
  }

  const filters: Parameters<typeof getJobHistory>[2] = {}
  if (query.status) filters.status = query.status as JobStatus
  if (query.settlementStatus) filters.settlementStatus = query.settlementStatus
  if (query.hiredVia) filters.hiredVia = query.hiredVia

  const rows = await getJobHistory(account.walletAddress as Address, db, filters)

  return c.json({
    jobs: rows.map((row) => ({
      jobId: row.jobId,
      authorizationId: row.authorizationId,
      listingId: row.listingId,
      executionStatus: row.executionStatus,
      settlementStatus: row.settlementStatus,
      providerAgentId: row.providerAgentId,
      createdAt: row.createdAt.toISOString(),
    })),
  })
}
