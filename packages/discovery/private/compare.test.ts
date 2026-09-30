import { describe, expect, test } from 'bun:test'
import { assertSameCategory } from './compare'
import { FIXTURE_CANDIDATES } from './test-fixtures'

describe('assertSameCategory', () => {
  test('accepts candidates from a single category', () => {
    const rebalancers = FIXTURE_CANDIDATES.filter(
      (c) => c.category === 'rebalancing' && c.status === 'LIVE',
    )
    const result = assertSameCategory(rebalancers)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.category).toBe('rebalancing')
  })

  test('rejects cross-category comparison at the query layer', () => {
    const mixed = [
      FIXTURE_CANDIDATES.find((c) => c.id === 'lst-rebal-02'),
      FIXTURE_CANDIDATES.find((c) => c.id === 'lst-grid-01'),
    ].filter((c): c is NonNullable<typeof c> => c !== undefined)

    const result = assertSameCategory(mixed)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('cross-category')
      expect(result.detail).toContain('grid_trading')
      expect(result.detail).toContain('rebalancing')
    }
  })
})
