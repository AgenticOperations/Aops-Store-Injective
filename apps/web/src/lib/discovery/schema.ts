// apps/web/src/lib/discovery/schema.ts
import { z } from 'zod'

/**
 * E8's bounded contract (discovery-engine-ryuk.md §4). This is the ONLY shape an LLM output is
 * ever trusted to have — nothing downstream re-parses free text, and nothing downstream ever
 * calls the LLM again.
 */
export const discoveryQuerySchema = z.object({
  category: z
    .enum(['rebalancing', 'grid-trading', 'yield-optimization', 'health-factor-monitoring'])
    .nullable(),
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
  'Which category is this for — rebalancing, grid trading, yield optimization, or health-factor monitoring?'
