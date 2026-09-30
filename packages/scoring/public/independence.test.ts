// packages/scoring/public/independence.test.ts
import { describe, expect, test } from 'bun:test'
import { DEFAULT_SUSPICION_SCORE, independenceConfidence } from './independence'

describe('independenceConfidence', () => {
  test('zero suspicion is full confidence', () => {
    expect(independenceConfidence(0)).toBe(1)
  })

  test('full suspicion is zero confidence', () => {
    expect(independenceConfidence(1)).toBe(0)
  })

  test('is exactly 1 - suspicion (architecture/01 §1.10)', () => {
    expect(independenceConfidence(0.3)).toBeCloseTo(0.7, 10)
  })

  test('rejects an out-of-range suspicion score', () => {
    expect(() => independenceConfidence(1.5)).toThrow()
    expect(() => independenceConfidence(-0.1)).toThrow()
  })

  test('the default (no fraud/sybil signal yet) is zero suspicion', () => {
    expect(DEFAULT_SUSPICION_SCORE).toBe(0)
    expect(independenceConfidence(DEFAULT_SUSPICION_SCORE)).toBe(1)
  })
})
