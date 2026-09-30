import { describe, expect, test } from 'bun:test'
import { filterCandidates } from './filter'
import { FIXTURE_CANDIDATES } from './test-fixtures'

describe('filterCandidates', () => {
  test('returns only listings in the requested category', () => {
    const results = filterCandidates(FIXTURE_CANDIDATES, { category: 'yield_optimization' })
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('lst-yield-01')
  })

  test('excludes DISCOVERED (unclaimed) listings — not hireable yet', () => {
    const results = filterCandidates(FIXTURE_CANDIDATES, { category: 'rebalancing' })
    expect(results.map((candidate) => candidate.id)).toEqual([
      'lst-rebal-02',
      'lst-rebal-03',
      'lst-rebal-04',
    ])
    expect(results.every((candidate) => candidate.status === 'LIVE')).toBe(true)
  })

  test('filters by minimum trust tier when provided', () => {
    const results = filterCandidates(FIXTURE_CANDIDATES, {
      category: 'grid_trading',
      minTrustTier: 'Medium',
    })
    expect(results).toHaveLength(0)
  })

  test('filters by capability requirement substring match', () => {
    const results = filterCandidates(FIXTURE_CANDIDATES, {
      category: 'health_factor_monitoring',
      capabilityRequirements: ['Venus Protocol'],
    })
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('lst-health-01')
  })

  test('returns empty array, not an error, on zero matches', () => {
    const results = filterCandidates(FIXTURE_CANDIDATES, {
      category: 'grid_trading',
      capabilityRequirements: ['nonexistent-capability'],
    })
    expect(results).toEqual([])
  })

  test('same category input from chat or grid returns the same result set', () => {
    const a = filterCandidates(FIXTURE_CANDIDATES, { category: 'yield_optimization' })
    const b = filterCandidates(FIXTURE_CANDIDATES, { category: 'yield_optimization' })
    expect(a).toEqual(b)
  })
})
