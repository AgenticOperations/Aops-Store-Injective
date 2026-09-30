import { createRoute, z } from '@hono/zod-openapi'
import type { RouteHandler } from '@hono/zod-openapi'
import { passesHiringGate } from '@repo/domain/guards'
import { getSettlementFeeBps, getSettlementPerformanceFeeBps } from '@repo/settlement/keys'
import { getApiContext } from '../context'
import { RailSchema, ScopeSchema, TrustTierSchema } from '../schemas/hire-input'
import { loadListingById } from '../services/listings'
import type { ApiEnv } from '../types/env'

const QuoteQuery = z.object({
  listingId: z.string().uuid(),
  buyerMinimumTrustTier: TrustTierSchema.default('Low'),
  rail: RailSchema,
  scope: ScopeSchema.optional(),
})

const QuoteResponse = z
  .object({
    listingId: z.string().uuid(),
    rail: RailSchema,
    scope: ScopeSchema,
    gatePasses: z.boolean(),
    listingTrustTier: z.string().nullable(),
    buyerMinimumTrustTier: TrustTierSchema,
    feeBps: z.number().optional(),
    performanceFeeBps: z.number().optional(),
    note: z.string(),
  })
  .openapi('QuoteResponse')

export const quoteRoute = createRoute({
  method: 'get',
  path: '/v1/quote',
  request: { query: QuoteQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: QuoteResponse } },
      description: 'Hire quote — Standing tier required',
    },
    404: { description: 'Listing not found' },
  },
  security: [{ AOPS_PoP: [] }],
})

export const quoteHandler: RouteHandler<typeof quoteRoute, ApiEnv> = async (c) => {
  const query = c.req.valid('query')
  const { db } = getApiContext()
  const scope = query.scope ?? {}

  const listing = await loadListingById(db, query.listingId)
  if (!listing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'listing not found' } }, 404)
  }

  const gatePasses = passesHiringGate({
    listingTrustTier: listing.trustTier,
    buyerMinimumTrustTier: query.buyerMinimumTrustTier,
  })

  const flatFeeBps = getSettlementFeeBps()
  const performanceFeeBps = getSettlementPerformanceFeeBps()

  return c.json({
    listingId: query.listingId,
    rail: query.rail,
    scope,
    gatePasses,
    listingTrustTier: listing.trustTier,
    buyerMinimumTrustTier: query.buyerMinimumTrustTier,
    feeBps: query.rail === 'ERC8183_ESCROW' ? flatFeeBps : undefined,
    performanceFeeBps: query.rail === 'ALTANA_SESSION' ? performanceFeeBps : undefined,
    note:
      query.rail === 'ALTANA_SESSION'
        ? 'Performance fee is display-only at session close; not collected in v1.'
        : `Flat fee ${flatFeeBps / 100}% deducted at PLAIN escrow release.`,
  })
}
