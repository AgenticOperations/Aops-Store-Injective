import { createRoute, z } from '@hono/zod-openapi'
import type { RouteHandler } from '@hono/zod-openapi'
import { accounts, authorizations, jobs } from '@repo/database/schema'
import { grantSession } from '@repo/custody/sessions'
import { passesHiringGate } from '@repo/domain/guards'
import { eq } from 'drizzle-orm'
import { getApiContext } from '../context'
import { altanaGrantParamsFromScope, HireBodySchema } from '../schemas/hire-input'
import { loadListingById } from '../services/listings'
import type { ApiEnv } from '../types/env'

const HireResponse = z
  .object({
    jobId: z.string().uuid(),
    authorizationId: z.string().uuid(),
    settlementStatus: z.literal('HELD'),
    rail: z.string(),
    sessionId: z.string().optional(),
  })
  .openapi('HireResponse')

export const hireRoute = createRoute({
  method: 'post',
  path: '/v1/jobs',
  request: {
    body: { content: { 'application/json': { schema: HireBodySchema } } },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: HireResponse } },
      description: 'Job created — Fresh tier required',
    },
    403: { description: 'Hiring gate failed' },
    404: { description: 'Listing not found' },
  },
  security: [{ AOPS_PoP: [] }],
})

export const hireHandler: RouteHandler<typeof hireRoute, ApiEnv> = async (c) => {
  const body = c.req.valid('json')
  const { db, altanaClient } = getApiContext()
  const accountId = c.get('accountId')!

  const listing = await loadListingById(db, body.listingId)
  if (!listing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'listing not found' } }, 404)
  }

  if (
    !passesHiringGate({
      listingTrustTier: listing.trustTier,
      buyerMinimumTrustTier: body.buyerMinimumTrustTier,
    })
  ) {
    return c.json(
      {
        error: {
          code: 'HIRING_GATE_FAILED',
          message: `listing trust ${listing.trustTier} below buyer minimum ${body.buyerMinimumTrustTier}`,
        },
      },
      403,
    )
  }

  const accountRows = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1)
  const account = accountRows[0]
  if (!account) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'account not found' } }, 404)
  }

  let sessionId: string | undefined

  if (body.rail === 'ALTANA_SESSION') {
    const grantParams = altanaGrantParamsFromScope(
      body.scope,
      account.walletAddress as `0x${string}`,
    )
    const grant = await grantSession({
      client: altanaClient,
      ...grantParams,
      mode: 'simulate',
    })
    if (!grant.ok) {
      return c.json({ error: { code: 'CUSTODY_ERROR', message: grant.error.message } }, 502)
    }
    sessionId = grant.data.sessionId
  }

  const [authorization] = await db
    .insert(authorizations)
    .values({
      listingId: listing.id,
      buyerWallet: account.walletAddress,
      buyerMinimumTrustTier: body.buyerMinimumTrustTier,
      status: 'GRANTED',
      rail: body.rail,
      scope: body.scope,
      escrowVariant: body.rail === 'ERC8183_ESCROW' ? 'PLAIN' : null,
    })
    .returning()

  if (!authorization) {
    return c.json({ error: { code: 'INTERNAL', message: 'failed to create authorization' } }, 500)
  }

  const [job] = await db
    .insert(jobs)
    .values({
      authorizationId: authorization.id,
      listingId: listing.id,
      executionStatus: 'AUTHORIZED',
      settlementStatus: 'HELD',
    })
    .returning()

  if (!job) {
    return c.json({ error: { code: 'INTERNAL', message: 'failed to create job' } }, 500)
  }

  return c.json(
    {
      jobId: job.id,
      authorizationId: authorization.id,
      settlementStatus: 'HELD' as const,
      rail: body.rail,
      sessionId,
    },
    201,
  )
}
