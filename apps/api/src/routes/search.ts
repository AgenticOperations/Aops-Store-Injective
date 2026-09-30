import { createRoute, z } from '@hono/zod-openapi'
import type { RouteHandler } from '@hono/zod-openapi'
import { filterCandidates } from '@repo/discovery/query'
import { rankWithCategoryDefaults } from '@repo/discovery/rank'
import { categoryEnum } from '@repo/database/schema'
import { getApiContext } from '../context'
import { loadDiscoveryCandidates } from '../services/listings'
import type { ApiEnv } from '../types/env'

const CategorySchema = z.enum(categoryEnum.enumValues)
const TrustTierSchema = z.enum(['Low', 'Medium', 'High'])

const SearchQuery = z.object({
  category: CategorySchema,
  minTrustTier: TrustTierSchema.optional(),
  capabilityRequirements: z.string().optional(),
})

const RankedItemSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().optional(),
  category: CategorySchema,
  trustTier: TrustTierSchema,
  weightedScore: z.number(),
  score: z.number().nullable(),
  confidence: z.number().nullable(),
  feeBps: z.number(),
})

const SearchResponse = z
  .object({
    results: z.array(RankedItemSchema),
    methodologyVersion: z.string(),
    category: CategorySchema,
  })
  .openapi('SearchResponse')

export const searchRoute = createRoute({
  method: 'get',
  path: '/v1/search',
  request: { query: SearchQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: SearchResponse } },
      description: 'Ranked LIVE listings for category',
    },
    400: { description: 'Invalid query' },
  },
})

export const searchHandler: RouteHandler<typeof searchRoute, ApiEnv> = async (c) => {
  const query = c.req.valid('query')
  const { db } = getApiContext()

  const candidates = await loadDiscoveryCandidates(db)
  const capabilityRequirements = query.capabilityRequirements
    ? query.capabilityRequirements.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined

  const filterInput: Parameters<typeof filterCandidates>[1] = { category: query.category }
  if (query.minTrustTier) filterInput.minTrustTier = query.minTrustTier
  if (capabilityRequirements?.length) filterInput.capabilityRequirements = capabilityRequirements

  const filtered = filterCandidates(candidates, filterInput)

  const ranked = rankWithCategoryDefaults(filtered)
  if (!ranked.ok) {
    return c.json({ error: { code: 'CROSS_CATEGORY', message: ranked.detail } }, 400)
  }

  return c.json({
    results: ranked.ranked.map((r) => ({
      id: r.candidate.id,
      category: r.candidate.category,
      trustTier: r.candidate.trustTier,
      weightedScore: r.weightedScore,
      score: r.candidate.score,
      confidence: r.candidate.confidence,
      feeBps: r.candidate.feeBps,
    })),
    methodologyVersion: ranked.methodologyVersion,
    category: ranked.category,
  })
}
