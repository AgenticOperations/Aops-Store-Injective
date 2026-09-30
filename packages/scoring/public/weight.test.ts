// packages/scoring/public/weight.test.ts
import { describe, expect, test } from 'bun:test'
import {
  economicRelationshipTier,
  recencyDecay,
  sourceRank,
  versionContinuity,
  weight,
} from './weight'

describe('sourceRank', () => {
  test('L0 is exactly the self-attest floor', () => {
    expect(sourceRank(0)).toBeCloseTo(0.1, 10)
  })

  test('L6 is exactly the marketplace-benchmark ceiling', () => {
    expect(sourceRank(6)).toBeCloseTo(1.0, 10)
  })

  test('rank increases monotonically with evidence level', () => {
    const ranks = [0, 1, 2, 3, 4, 5, 6].map((level) =>
      sourceRank(level as 0 | 1 | 2 | 3 | 4 | 5 | 6),
    )
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThan(ranks[i - 1] as number)
    }
  })
})

describe('recencyDecay', () => {
  test('evidence created right now decays to 1', () => {
    const now = new Date('2026-09-02T00:00:00Z')
    expect(recencyDecay({ createdAt: now, now, halfLifeDays: 30 })).toBe(1)
  })

  test('evidence exactly one half-life old decays to 0.5', () => {
    const now = new Date('2026-09-02T00:00:00Z')
    const createdAt = new Date(now.getTime() - 30 * 86_400_000)
    expect(recencyDecay({ createdAt, now, halfLifeDays: 30 })).toBeCloseTo(0.5, 10)
  })

  test('older evidence decays further with a shorter half-life', () => {
    const now = new Date('2026-09-02T00:00:00Z')
    const createdAt = new Date(now.getTime() - 10 * 86_400_000)
    const longHalfLife = recencyDecay({ createdAt, now, halfLifeDays: 60 })
    const shortHalfLife = recencyDecay({ createdAt, now, halfLifeDays: 10 })
    expect(shortHalfLife).toBeLessThan(longHalfLife)
  })
})

describe('economicRelationshipTier', () => {
  test('NO_INTERACTION is the neutral baseline', () => {
    expect(economicRelationshipTier('NO_INTERACTION')).toBe(1.0)
  })

  test('the ladder only ever boosts weight, never discounts it', () => {
    for (const tier of ['COMPLETED_JOB', 'REPEATED_CUSTOMER', 'VALIDATOR'] as const) {
      expect(economicRelationshipTier(tier)).toBeGreaterThan(1.0)
    }
  })

  test('REPEATED_CUSTOMER outranks a first COMPLETED_JOB (05 §5.4)', () => {
    expect(economicRelationshipTier('REPEATED_CUSTOMER')).toBeGreaterThan(
      economicRelationshipTier('COMPLETED_JOB'),
    )
  })
})

describe('versionContinuity', () => {
  const now = new Date('2026-09-02T00:00:00Z')

  test('no detected version change ever discounts anything', () => {
    const evidenceCreatedAt = new Date(now.getTime() - 100 * 86_400_000)
    expect(versionContinuity({ evidenceCreatedAt, versionChangedAt: null, now })).toBe(1)
  })

  test('evidence created after the version change is unaffected by this factor', () => {
    const versionChangedAt = new Date(now.getTime() - 5 * 86_400_000)
    const evidenceCreatedAt = new Date(now.getTime() - 1 * 86_400_000) // after the change
    expect(versionContinuity({ evidenceCreatedAt, versionChangedAt, now })).toBe(1)
  })

  test('pre-change evidence sits at the floor the instant the change is detected', () => {
    const versionChangedAt = now
    const evidenceCreatedAt = new Date(now.getTime() - 10 * 86_400_000)
    expect(versionContinuity({ evidenceCreatedAt, versionChangedAt, now })).toBeCloseTo(0.5, 10)
  })

  test('pre-change evidence fades back to full weight once the window elapses', () => {
    const versionChangedAt = new Date(now.getTime() - 30 * 86_400_000) // well past the 14-day window
    const evidenceCreatedAt = new Date(versionChangedAt.getTime() - 10 * 86_400_000)
    expect(versionContinuity({ evidenceCreatedAt, versionChangedAt, now })).toBe(1)
  })

  test('never drops below the configured floor, even mid-window', () => {
    const versionChangedAt = new Date(now.getTime() - 7 * 86_400_000) // halfway through the 14-day window
    const evidenceCreatedAt = new Date(versionChangedAt.getTime() - 1 * 86_400_000)
    const value = versionContinuity({ evidenceCreatedAt, versionChangedAt, now })
    expect(value).toBeGreaterThanOrEqual(0.5)
    expect(value).toBeLessThan(1)
  })
})

describe('weight', () => {
  test('a top-tier, fresh, no-suspicion, validator-relationship, unaffected-by-version-change row scores near the ceiling', () => {
    const now = new Date('2026-09-02T00:00:00Z')
    const result = weight({
      evidenceLevel: 6,
      suspicionScore: 0,
      createdAt: now,
      now,
      halfLifeDays: 30,
      economicRelationshipTier: 'VALIDATOR',
      versionChangedAt: null,
    })
    // sourceRank(6)=1.0 * independence(0)=1.0 * recency(now)=1.0 * VALIDATOR(1.5) * continuity=1.0
    expect(result).toBeCloseTo(1.5, 10)
  })

  test('a self-attested, stale, suspicious row is discounted well below the top-tier row', () => {
    const now = new Date('2026-09-02T00:00:00Z')
    const stale = new Date(now.getTime() - 90 * 86_400_000)
    const strong = weight({
      evidenceLevel: 6,
      suspicionScore: 0,
      createdAt: now,
      now,
      halfLifeDays: 30,
      economicRelationshipTier: 'VALIDATOR',
      versionChangedAt: null,
    })
    const weak = weight({
      evidenceLevel: 0,
      suspicionScore: 0.8,
      createdAt: stale,
      now,
      halfLifeDays: 30,
      economicRelationshipTier: 'NO_INTERACTION',
      versionChangedAt: null,
    })
    expect(weak).toBeLessThan(strong)
  })
})
