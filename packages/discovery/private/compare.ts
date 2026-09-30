import type { Category } from '@repo/domain/types'
import type { DiscoveryCandidate } from '../public/types'

export type CompareValidationResult =
  | { ok: true; category: Category }
  | { ok: false; reason: 'cross-category'; detail: string }

/**
 * `architecture/05` §5.2 correction 2 — category-scoped comparison enforced at the query/rank
 * layer, not only in UI affordances.
 */
export function assertSameCategory(
  candidates: readonly DiscoveryCandidate[],
): CompareValidationResult {
  if (candidates.length === 0) {
    return { ok: false, reason: 'cross-category', detail: 'No candidates to compare.' }
  }

  const categories = new Set(candidates.map((candidate) => candidate.category))
  if (categories.size > 1) {
    return {
      ok: false,
      reason: 'cross-category',
      detail: `These agents span ${categories.size} categories (${[...categories].join(', ')}). Agents are only ever compared within one category.`,
    }
  }

  const [category] = categories
  if (!category) {
    return { ok: false, reason: 'cross-category', detail: 'No candidates to compare.' }
  }

  return { ok: true, category }
}
