// apps/web/src/lib/discovery/keyword-parser.ts
import type { Category } from '../../fixtures/listings'
import type { DiscoveryQuery } from './schema'

/**
 * No-network fallback. Fires whenever Gemini errors, times out, or the API key is missing —
 * the surface must never dead-end on an LLM hiccup during judging. Deliberately narrow: it only
 * ever resolves `category`, everything else stays null/empty, same as an under-specified LLM
 * result would. If it can't find a confident keyword hit, it returns `category: null` and the
 * caller asks the same one clarifying question the LLM path would ask — one fallback behavior,
 * not a second bespoke UX.
 */
const KEYWORD_MAP: Array<{ category: Category; keywords: string[] }> = [
  {
    category: 'health-factor-monitoring',
    keywords: ['liquidat', 'health factor', 'wiped out', 'borrow position', 'collateral'],
  },
  { category: 'grid-trading', keywords: ['grid'] },
  { category: 'yield-optimization', keywords: ['yield', 'apr', 'apy', 'route liquidity'] },
  { category: 'rebalancing', keywords: ['rebalanc', 'lp range', 'liquidity range', 'lp position'] },
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
