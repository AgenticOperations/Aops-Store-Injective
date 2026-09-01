// apps/web/src/lib/compare.test.ts
import { describe, expect, test } from 'bun:test'
import { resolveComparison } from './compare'

describe('resolveComparison', () => {
  test('two agents in the same category, same pool and window, compare cleanly', () => {
    const result = resolveComparison('lst-rebal-02,lst-rebal-03')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.category).toBe('rebalancing')
      expect(result.listings).toHaveLength(2)
      // Same pool, same window, different band width — the one axis on which two rebalancers
      // are genuinely comparable (03 §9.2), so no caveat is raised.
      expect(result.caveat).toBeNull()
    }
  })

  test('same category but different pool/window raises the not-comparable caveat', () => {
    const result = resolveComparison('lst-rebal-02,lst-rebal-04')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.caveat).toContain('different pools')
      expect(result.caveat).toContain('different observation windows')
    }
  })

  test('cross-category request cannot produce listings at all', () => {
    const result = resolveComparison('lst-rebal-02,lst-yield-01')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('cross-category')
    // The guarantee is structural, not cosmetic: there is no `listings` on the failure branch,
    // so no render path can reach a mixed-category table even by mistake.
    expect('listings' in result).toBe(false)
  })

  test('an unknown id fails the whole comparison rather than silently dropping one', () => {
    const result = resolveComparison('lst-rebal-02,lst-does-not-exist')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('unknown-id')
  })

  test('one agent is not a comparison', () => {
    const result = resolveComparison('lst-rebal-02')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('too-few')
  })

  test('more than three is refused rather than truncated', () => {
    const result = resolveComparison('lst-rebal-01,lst-rebal-02,lst-rebal-03,lst-rebal-04')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('too-many')
  })

  test('missing or blank ids give the empty reason, not a crash', () => {
    expect(resolveComparison(undefined).ok).toBe(false)
    expect(resolveComparison('').ok).toBe(false)
    expect(resolveComparison(' , , ').ok).toBe(false)
  })
})
