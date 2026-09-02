// apps/web/src/lib/compare.ts
import type { Category, Listing } from '../fixtures/listings'
import { fetchListingView } from './listing-view'

export const MAX_COMPARE = 3

export type CompareResult =
  | { ok: true; category: Category; listings: Listing[]; caveat: string | null }
  | {
      ok: false
      reason: 'empty' | 'unknown-id' | 'too-few' | 'too-many' | 'cross-category'
      detail: string
    }

export async function resolveComparison(rawIds: string | undefined): Promise<CompareResult> {
  const ids = (rawIds ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  if (ids.length === 0) {
    return { ok: false, reason: 'empty', detail: 'No agents selected.' }
  }
  if (ids.length === 1) {
    return {
      ok: false,
      reason: 'too-few',
      detail: 'A comparison needs at least two agents. Pick another from the same category.',
    }
  }
  if (ids.length > MAX_COMPARE) {
    return {
      ok: false,
      reason: 'too-many',
      detail: `Compare at most ${MAX_COMPARE} agents at once — beyond that the table stops being readable.`,
    }
  }

  const listings: Listing[] = []
  for (const id of ids) {
    const found = await fetchListingView(id)
    if (!found) {
      return { ok: false, reason: 'unknown-id', detail: `No agent with id "${id}".` }
    }
    listings.push(found)
  }

  const categories = new Set(listings.map((listing) => listing.category))
  if (categories.size > 1) {
    return {
      ok: false,
      reason: 'cross-category',
      detail: `These agents span ${categories.size} categories (${[...categories].join(', ')}). Agents are only ever compared within one category.`,
    }
  }

  const [category] = categories
  if (!category) {
    return { ok: false, reason: 'empty', detail: 'No agents selected.' }
  }

  return { ok: true, category, listings, caveat: comparabilityCaveat(listings) }
}

function comparabilityCaveat(listings: Listing[]): string | null {
  const withKpis = listings.filter((listing) => listing.kpis !== null)
  if (withKpis.length < 2) return null

  const pools = new Set(withKpis.map((listing) => `${listing.kpis?.pool} ${listing.kpis?.feeTier}`))
  const windows = new Set(withKpis.map((listing) => listing.kpis?.window))

  const differing: string[] = []
  if (pools.size > 1) differing.push(`different pools (${[...pools].join(' vs. ')})`)
  if (windows.size > 1)
    differing.push(`different observation windows (${[...windows].join(' vs. ')})`)
  if (differing.length === 0) return null

  return `These agents were measured on ${differing.join(' and ')}. The columns below line up, but the numbers do not — treat this as context, not as a head-to-head result.`
}
