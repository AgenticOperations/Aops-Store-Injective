// apps/web/src/lib/compare.ts
import { type Category, FIXTURE_LISTINGS, type Listing } from '../fixtures/listings'

export const MAX_COMPARE = 3

export type CompareResult =
  | { ok: true; category: Category; listings: Listing[]; caveat: string | null }
  | {
      ok: false
      reason: 'empty' | 'unknown-id' | 'too-few' | 'too-many' | 'cross-category'
      detail: string
    }

/**
 * ③ DEMAND · E10 — the *only* way this app assembles a comparison set.
 *
 * `architecture/05` §5.2 correction 2 requires the same-category rule to be enforced at the query
 * layer, not hidden in the UI: "there is no code path that can assemble a cross-category
 * comparison, not just a UI affordance that avoids showing one." That is a statement about the
 * return type, so it is expressed as one — a cross-category request cannot produce a value that
 * contains listings. The page cannot render a mixed table because there is no mixed table to
 * destructure, not because it remembers to check.
 *
 * The rule matters because the KPI sets are category-specific (`03` §7.2). Putting a rebalancer's
 * time-in-range beside a health-factor monitor's liquidation count in one grid does not produce a
 * weak comparison; it produces a meaningless one that still looks authoritative.
 */
export function resolveComparison(rawIds: string | undefined): CompareResult {
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
    const found = FIXTURE_LISTINGS.find((listing) => listing.id === id)
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

  // Exactly one category survived the check above, so destructuring the set — rather than
  // indexing `listings[0]` — is what makes the non-empty guarantee visible to the type checker
  // instead of asserted past it.
  const [category] = categories
  if (!category) {
    return { ok: false, reason: 'empty', detail: 'No agents selected.' }
  }

  return { ok: true, category, listings, caveat: comparabilityCaveat(listings) }
}

/**
 * `03` §9.2's explicit warning. Same category is necessary but not sufficient: two rebalancers on
 * different pools, or measured over different windows, are not directly comparable even though
 * every column lines up. The axis on which two rebalancers *are* genuinely comparable is same
 * pool, same window, different band width and trigger — so anything else gets said out loud.
 */
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
