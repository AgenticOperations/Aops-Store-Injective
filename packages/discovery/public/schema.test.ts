import { describe, expect, test } from 'bun:test'
import { discoveryQuerySchema } from '../public/schema'

describe('discoveryQuerySchema', () => {
  test('accepts domain underscored categories', () => {
    for (const category of [
      'rebalancing',
      'grid_trading',
      'yield_optimization',
      'health_factor_monitoring',
    ] as const) {
      const parsed = discoveryQuerySchema.safeParse({
        category,
        risk_tolerance: null,
        budget_ceiling: null,
        min_trust_tier: null,
        capability_requirements: [],
        availability_required: false,
        free_text_original: 'test',
      })
      expect(parsed.success).toBe(true)
    }
  })

  test('rejects hyphenated fixture categories', () => {
    const parsed = discoveryQuerySchema.safeParse({
      category: 'grid-trading',
      risk_tolerance: null,
      budget_ceiling: null,
      min_trust_tier: null,
      capability_requirements: [],
      availability_required: false,
      free_text_original: 'test',
    })
    expect(parsed.success).toBe(false)
  })

  test('allows null category for ambiguous queries', () => {
    const parsed = discoveryQuerySchema.safeParse({
      category: null,
      risk_tolerance: null,
      budget_ceiling: null,
      min_trust_tier: null,
      capability_requirements: [],
      availability_required: false,
      free_text_original: 'make money',
    })
    expect(parsed.success).toBe(true)
  })

  test('requires capability_requirements array even when empty', () => {
    const parsed = discoveryQuerySchema.safeParse({
      category: 'rebalancing',
      risk_tolerance: null,
      budget_ceiling: null,
      min_trust_tier: null,
      availability_required: false,
      free_text_original: 'test',
    })
    expect(parsed.success).toBe(false)
  })

  test('accepts optional trust floor and capability requirements', () => {
    const parsed = discoveryQuerySchema.safeParse({
      category: 'health_factor_monitoring',
      risk_tolerance: 'low',
      budget_ceiling: 100,
      min_trust_tier: 'Medium',
      capability_requirements: ['Venus Protocol'],
      availability_required: true,
      free_text_original: 'protect my position',
    })
    expect(parsed.success).toBe(true)
  })

  test('rejects non-positive budget_ceiling', () => {
    const parsed = discoveryQuerySchema.safeParse({
      category: 'rebalancing',
      risk_tolerance: null,
      budget_ceiling: 0,
      min_trust_tier: null,
      capability_requirements: [],
      availability_required: false,
      free_text_original: 'test',
    })
    expect(parsed.success).toBe(false)
  })

  test('rejects unknown category strings', () => {
    const parsed = discoveryQuerySchema.safeParse({
      category: 'arbitrage',
      risk_tolerance: null,
      budget_ceiling: null,
      min_trust_tier: null,
      capability_requirements: [],
      availability_required: false,
      free_text_original: 'test',
    })
    expect(parsed.success).toBe(false)
  })
})
