// apps/web/src/lib/compare.test.ts
import { describe, expect, test } from 'bun:test'
import { FIXTURE_LISTINGS } from '../fixtures/listings'
import { resolveComparison } from './compare'

const fixtureLookup = async (id: string) => FIXTURE_LISTINGS.find((l) => l.id === id) ?? null

describe('resolveComparison', () => {
  test('two agents in the same category, same pool and window, compare cleanly', async () => {
    const result = await resolveComparison('lst-rebal-02,lst-rebal-03', fixtureLookup)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.category).toBe('rebalancing')
      expect(result.listings).toHaveLength(2)
      expect(result.caveat).toBeNull()
    }
  })

  test('same category but different pool/window raises the not-comparable caveat', async () => {
    const result = await resolveComparison('lst-rebal-02,lst-rebal-04', fixtureLookup)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.caveat).toContain('different pools')
      expect(result.caveat).toContain('different observation windows')
    }
  })

  test('cross-category request cannot produce listings at all', async () => {
    const result = await resolveComparison('lst-rebal-02,lst-yield-01', fixtureLookup)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('cross-category')
    expect('listings' in result).toBe(false)
  })

  test('an unknown id fails the whole comparison rather than silently dropping one', async () => {
    const result = await resolveComparison('lst-rebal-02,lst-does-not-exist', fixtureLookup)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('unknown-id')
  })

  test('one agent is not a comparison', async () => {
    const result = await resolveComparison('lst-rebal-02', fixtureLookup)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('too-few')
  })

  test('more than three is refused rather than truncated', async () => {
    const result = await resolveComparison(
      'lst-rebal-01,lst-rebal-02,lst-rebal-03,lst-rebal-04',
      fixtureLookup,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('too-many')
  })

  test('missing or blank ids give the empty reason, not a crash', async () => {
    expect((await resolveComparison(undefined, fixtureLookup)).ok).toBe(false)
    expect((await resolveComparison('', fixtureLookup)).ok).toBe(false)
    expect((await resolveComparison(' , , ', fixtureLookup)).ok).toBe(false)
  })
})
