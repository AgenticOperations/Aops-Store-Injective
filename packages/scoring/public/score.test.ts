// packages/scoring/public/score.test.ts
import { describe, expect, test } from 'bun:test'
import { type WeightedObservation, computeScoreResult, confidence, score } from './score'
import { sourceRank } from './weight'

describe('score', () => {
  test('returns null for zero observations — never a bare 0', () => {
    expect(score([])).toBeNull()
  })

  test('returns null when every observation has zero weight', () => {
    const observations: WeightedObservation[] = [
      { normalizedValue: 0.9, weight: 0, evidenceLevel: 0 },
    ]
    expect(score(observations)).toBeNull()
  })

  test('is the weight-normalized average of normalizedValue', () => {
    const observations: WeightedObservation[] = [
      { normalizedValue: 1.0, weight: 1, evidenceLevel: 6 },
      { normalizedValue: 0.0, weight: 1, evidenceLevel: 6 },
    ]
    expect(score(observations)).toBeCloseTo(0.5, 10)
  })

  test('a single heavily-weighted observation dominates several lightly-weighted ones', () => {
    const observations: WeightedObservation[] = [
      { normalizedValue: 1.0, weight: 10, evidenceLevel: 6 },
      { normalizedValue: 0.0, weight: 0.1, evidenceLevel: 0 },
    ]
    expect(score(observations)).toBeGreaterThan(0.9)
  })
})

describe('confidence', () => {
  test('is 0 for an empty sample', () => {
    expect(confidence({ weights: [], evidenceLevelDiversity: 0 })).toBe(0)
  })

  test('never reaches 1 — saturating, not a hard cap hit exactly', () => {
    const manyStrongWeights = Array.from({ length: 1000 }, () => sourceRank(6))
    expect(confidence({ weights: manyStrongWeights, evidenceLevelDiversity: 1 })).toBeLessThan(1)
  })

  test("3 L6 rows outrank 400 L0 rows (architecture/01 §1.9's stated invariant)", () => {
    const threeL6 = Array.from({ length: 3 }, () => sourceRank(6))
    const fourHundredL0 = Array.from({ length: 400 }, () => sourceRank(0))
    const strongConfidence = confidence({ weights: threeL6, evidenceLevelDiversity: 1 })
    const weakConfidence = confidence({ weights: fourHundredL0, evidenceLevelDiversity: 1 })
    expect(strongConfidence).toBeGreaterThan(weakConfidence)
  })

  test('more evidence-level diversity nudges confidence up, all else equal', () => {
    const weights = [sourceRank(3), sourceRank(3)]
    const low = confidence({ weights, evidenceLevelDiversity: 1 })
    const high = confidence({ weights, evidenceLevelDiversity: 5 })
    expect(high).toBeGreaterThan(low)
  })
})

describe('computeScoreResult', () => {
  test('zero evidence produces the tagged no_evidence state, never a computed 0', () => {
    const result = computeScoreResult([])
    expect(result.kind).toBe('no_evidence')
  })

  test('a populated sample produces a tagged scored state with methodologyVersion stamped', () => {
    const observations: WeightedObservation[] = [
      { normalizedValue: 0.8, weight: 1, evidenceLevel: 4 },
      { normalizedValue: 0.6, weight: 1, evidenceLevel: 3 },
    ]
    const result = computeScoreResult(observations, 'test-version')
    expect(result.kind).toBe('scored')
    if (result.kind === 'scored') {
      expect(result.sampleSize).toBe(2)
      expect(result.methodologyVersion).toBe('test-version')
      expect(result.score).toBeGreaterThan(0)
      expect(result.confidence).toBeGreaterThan(0)
    }
  })

  test('defaults to the current SCORING_METHODOLOGY_VERSION when not overridden', async () => {
    const { SCORING_METHODOLOGY_VERSION } = await import('./version')
    const result = computeScoreResult([{ normalizedValue: 0.5, weight: 1, evidenceLevel: 2 }])
    expect(result.methodologyVersion).toBe(SCORING_METHODOLOGY_VERSION)
  })
})
