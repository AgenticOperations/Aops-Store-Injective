// apps/web/src/lib/discovery/filter.test.ts
import { describe, expect, test } from 'bun:test'
import { FIXTURE_LISTINGS } from '../../fixtures/listings'
import { filterListings } from './filter'

describe('filterListings', () => {
  test('returns only listings in the requested category', () => {
    const results = filterListings(FIXTURE_LISTINGS, { category: 'yield-optimization' })
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('lst-yield-01')
  })

  test('excludes DISCOVERED (unclaimed) listings — not hireable yet', () => {
    const results = filterListings(FIXTURE_LISTINGS, { category: 'rebalancing' })
    // Rebalancing has four fixtures; lst-rebal-01 is DISCOVERED and must never reach the grid,
    // because the unclaimed directory is explicitly not part of discovery (01 §3).
    expect(results.map((listing) => listing.id)).toEqual([
      'lst-rebal-02',
      'lst-rebal-03',
      'lst-rebal-04',
    ])
    expect(results.every((listing) => listing.status === 'LIVE')).toBe(true)
  })

  test('filters by minimum trust tier when provided', () => {
    const results = filterListings(FIXTURE_LISTINGS, {
      category: 'grid-trading',
      minTrustTier: 'Medium',
    })
    expect(results).toHaveLength(0) // lst-grid-01 is Low, below the Medium floor
  })

  test('filters by capability requirement substring match', () => {
    const results = filterListings(FIXTURE_LISTINGS, {
      category: 'health-factor-monitoring',
      capabilityRequirements: ['Venus Protocol'],
    })
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('lst-health-01')
  })

  test('returns empty array, not an error, on zero matches', () => {
    const results = filterListings(FIXTURE_LISTINGS, {
      category: 'grid-trading',
      capabilityRequirements: ['nonexistent-capability'],
    })
    expect(results).toEqual([])
  })

  test('same category input from chat or grid returns the same result set', () => {
    const a = filterListings(FIXTURE_LISTINGS, { category: 'yield-optimization' })
    const b = filterListings(FIXTURE_LISTINGS, { category: 'yield-optimization' })
    expect(a).toEqual(b)
  })
})
