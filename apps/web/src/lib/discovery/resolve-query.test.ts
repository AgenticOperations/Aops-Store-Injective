// apps/web/src/lib/discovery/resolve-query.test.ts
import { describe, expect, test } from 'bun:test'
import { FIXTURE_LISTINGS } from '../../fixtures/listings'
import { resolveDiscoveryQuery } from './resolve-query'
import type { DiscoveryQuery } from './schema'

const baseQuery = (overrides: Partial<DiscoveryQuery> = {}): DiscoveryQuery => ({
  category: null,
  risk_tolerance: null,
  budget_ceiling: null,
  min_trust_tier: null,
  capability_requirements: [],
  availability_required: false,
  free_text_original: '',
  ...overrides,
})

describe('resolveDiscoveryQuery', () => {
  test('confident Gemini category resolution returns matching listings', async () => {
    const result = await resolveDiscoveryQuery({
      freeText: 'find me the best yield route',
      listings: FIXTURE_LISTINGS,
      parseWithGemini: async () => baseQuery({ category: 'yield-optimization' }),
    })
    expect(result.kind).toBe('results')
    if (result.kind === 'results') {
      expect(result.listings).toHaveLength(1)
      expect(result.listings[0]?.id).toBe('lst-yield-01')
    }
  })

  test('ambiguous Gemini result returns exactly one clarifying question', async () => {
    const result = await resolveDiscoveryQuery({
      freeText: 'make money on BNB',
      listings: FIXTURE_LISTINGS,
      parseWithGemini: async () => baseQuery({ category: null }),
    })
    expect(result.kind).toBe('clarify')
  })

  test('Gemini failure falls back to keyword parser and still resolves', async () => {
    const result = await resolveDiscoveryQuery({
      freeText: 'set up a grid on BNB/USDT',
      listings: FIXTURE_LISTINGS,
      parseWithGemini: async () => null,
    })
    expect(result.kind).toBe('results')
    if (result.kind === 'results') {
      expect(result.listings[0]?.id).toBe('lst-grid-01')
    }
  })

  test('Gemini failure + ambiguous keyword text still returns a clarify, never an error', async () => {
    const result = await resolveDiscoveryQuery({
      freeText: 'make money on BNB',
      listings: FIXTURE_LISTINGS,
      parseWithGemini: async () => null,
    })
    expect(result.kind).toBe('clarify')
  })

  test('confident category with zero matches returns the empty-result kind, not an error', async () => {
    const result = await resolveDiscoveryQuery({
      freeText: 'rebalance my LP range',
      listings: FIXTURE_LISTINGS,
      parseWithGemini: async () =>
        baseQuery({
          category: 'rebalancing',
          capability_requirements: ['uniswap-v4'],
        }),
    })
    // No rebalancing fixture declares that capability, so the filter narrows to nothing. The
    // surface must render its empty state rather than treat "no match" as a failure.
    expect(result.kind).toBe('results')
    if (result.kind === 'results') expect(result.listings).toEqual([])
  })
})
