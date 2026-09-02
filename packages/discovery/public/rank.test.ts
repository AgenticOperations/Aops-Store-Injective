import { describe, expect, test } from 'bun:test'
import { FIXTURE_CANDIDATES } from '../private/test-fixtures'
import { explain } from './explain'
import { DEFAULT_CATEGORY_WEIGHTS, rank, rankWithCategoryDefaults } from './rank'

describe('rank', () => {
  test('orders same-category candidates deterministically', () => {
    const rebalancers = FIXTURE_CANDIDATES.filter(
      (c) => c.category === 'rebalancing' && c.status === 'LIVE',
    )
    const result = rankWithCategoryDefaults(rebalancers)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.ranked.map((r) => r.candidate.id)).toEqual([
      'lst-rebal-03',
      'lst-rebal-02',
      'lst-rebal-04',
    ])
    expect(result.methodologyVersion).toBe('e9-v1')
  })

  test('rejects cross-category candidate sets', () => {
    const mixed = [
      FIXTURE_CANDIDATES.find((c) => c.id === 'lst-rebal-02'),
      FIXTURE_CANDIDATES.find((c) => c.id === 'lst-yield-01'),
    ].filter((c): c is NonNullable<typeof c> => c !== undefined)

    const result = rank(mixed, DEFAULT_CATEGORY_WEIGHTS.rebalancing)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('cross-category')
  })

  test('uses per-category default weights that sum to 1', () => {
    for (const weights of Object.values(DEFAULT_CATEGORY_WEIGHTS)) {
      const sum = Object.values(weights).reduce((total, w) => total + w, 0)
      expect(sum).toBeCloseTo(1, 5)
    }
  })

  test('floors trust_evidence_strength at neutral midpoint for zero-evidence agents', () => {
    const gridOnly = FIXTURE_CANDIDATES.filter((c) => c.id === 'lst-grid-01')
    const result = rankWithCategoryDefaults(gridOnly)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.ranked[0]?.factors.trust_evidence_strength).toBe(0.5)
  })
})

describe('explain', () => {
  test('derives explanation from the same breakdown that produced the rank', () => {
    const rebalancers = FIXTURE_CANDIDATES.filter(
      (c) => c.category === 'rebalancing' && c.status === 'LIVE',
    )
    const result = rankWithCategoryDefaults(rebalancers)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const top = result.ranked[0]
    expect(top).toBeDefined()
    if (!top) return

    const text = explain(top, result.weights)
    expect(text).toContain('Weighted score')
    expect(text).toContain('trust & evidence')
    const recomputed = Object.values(top.breakdown).reduce((sum, v) => sum + v, 0)
    expect(text).toContain((recomputed * 100).toFixed(1))
  })
})
