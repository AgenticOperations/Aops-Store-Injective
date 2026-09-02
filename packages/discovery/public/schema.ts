/**
 * RING 2 · OWNED STATE — our database
 * `@repo/discovery/schema` — public contract. Named exports only.
 *
 * E8's bounded contract (discovery-engine-ryuk.md §4). Domain underscored categories only.
 */

import { z } from 'zod'

const domainCategories = [
  'rebalancing',
  'grid_trading',
  'yield_optimization',
  'health_factor_monitoring',
] as const

export const discoveryQuerySchema = z.object({
  category: z.enum(domainCategories).nullable(),
  risk_tolerance: z.enum(['low', 'medium', 'high']).nullable(),
  budget_ceiling: z.number().positive().nullable(),
  min_trust_tier: z.enum(['Low', 'Medium', 'High']).nullable(),
  capability_requirements: z.array(z.string()),
  availability_required: z.boolean(),
  free_text_original: z.string(),
})

export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>

/** Used whenever category can't be confidently resolved — one question, never a second round. */
export const CLARIFYING_QUESTION =
  'Which category is this for — rebalancing, grid trading, yield optimization, or health factor monitoring?'
