import type { Category } from '@repo/domain/types'
import type { DiscoveryQuery } from '../public/schema'

/**
 * No-network fallback. Fires whenever Gemini errors, times out, or the API key is missing —
 * the surface must never dead-end on an LLM hiccup during judging.
 */
const KEYWORD_MAP: Array<{ category: Category; keywords: string[] }> = [
  {
    category: 'health_factor_monitoring',
    keywords: ['liquidat', 'health factor', 'wiped out', 'borrow position', 'collateral'],
  },
  { category: 'grid_trading', keywords: ['grid'] },
  { category: 'yield_optimization', keywords: ['yield', 'apr', 'apy', 'route liquidity'] },
  {
    category: 'rebalancing',
    keywords: ['rebalanc', 'lp range', 'liquidity range', 'lp position'],
  },
]

export function parseByKeyword(freeText: string): Pick<DiscoveryQuery, 'category'> {
  const lower = freeText.toLowerCase()
  for (const entry of KEYWORD_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return { category: entry.category }
    }
  }
  return { category: null }
}
