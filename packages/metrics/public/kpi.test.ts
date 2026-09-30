// packages/metrics/public/kpi.test.ts
import { describe, expect, test } from 'bun:test'
import {
  type RangeExitEvent,
  type RebalanceEvent,
  type TickObservation,
  divergenceLossVsHodl,
  feeShareAchieved,
  limitBandFillRate,
  netOfCostApr,
  poolViabilityMargin,
  realisedSigma,
  rebalanceStats,
  timeInRangePct,
  timeToRecoveryMedianSeconds,
} from './kpi'

describe('timeInRangePct', () => {
  const range = { tickLower: -100, tickUpper: 100 }

  test('returns null with fewer than two observations — cannot measure elapsed time', () => {
    expect(timeInRangePct([{ timestampMs: 0, tick: 0 }], range)).toBeNull()
  })

  test('100% in range when every interval starts inside the band', () => {
    const observations: TickObservation[] = [
      { timestampMs: 0, tick: 0 },
      { timestampMs: 1000, tick: 50 },
      { timestampMs: 2000, tick: 0 },
    ]
    expect(timeInRangePct(observations, range)).toBe(1)
  })

  test('0% in range when every interval starts outside the band', () => {
    const observations: TickObservation[] = [
      { timestampMs: 0, tick: 500 },
      { timestampMs: 1000, tick: 600 },
    ]
    expect(timeInRangePct(observations, range)).toBe(0)
  })

  test('splits proportionally between an in-range and an out-of-range interval', () => {
    const observations: TickObservation[] = [
      { timestampMs: 0, tick: 0 }, // in range, this interval (1000ms) counts
      { timestampMs: 1000, tick: 500 }, // out of range, this interval (1000ms) does not count
      { timestampMs: 2000, tick: 500 },
    ]
    expect(timeInRangePct(observations, range)).toBeCloseTo(0.5, 10)
  })

  test('is order-independent — unsorted input is sorted before accounting', () => {
    const sorted: TickObservation[] = [
      { timestampMs: 0, tick: 0 },
      { timestampMs: 1000, tick: 50 },
      { timestampMs: 2000, tick: 0 },
    ]
    const shuffled = [sorted[2], sorted[0], sorted[1]] as TickObservation[]
    expect(timeInRangePct(shuffled, range)).toBe(timeInRangePct(sorted, range))
  })
})

describe('netOfCostApr', () => {
  test('null when position value is not positive', () => {
    const flow = {
      feesEarnedUsd: 10,
      cakeHarvestedUsd: 0,
      gasUsd: 0,
      swapFeesUsd: 0,
      slippageUsd: 0,
      realisedDivergenceLossUsd: 0,
    }
    expect(netOfCostApr(flow, 0, 30)).toBeNull()
  })

  test('annualises a positive net return over the period', () => {
    const flow = {
      feesEarnedUsd: 100,
      cakeHarvestedUsd: 0,
      gasUsd: 10,
      swapFeesUsd: 5,
      slippageUsd: 5,
      realisedDivergenceLossUsd: 0,
    }
    // net = 80, positionValue = 1000, periodDays = 30 -> (80/1000) * (365/30)
    expect(netOfCostApr(flow, 1000, 30)).toBeCloseTo(0.08 * (365 / 30), 10)
  })

  test('costs can push the result negative', () => {
    const flow = {
      feesEarnedUsd: 10,
      cakeHarvestedUsd: 0,
      gasUsd: 50,
      swapFeesUsd: 0,
      slippageUsd: 0,
      realisedDivergenceLossUsd: 0,
    }
    expect(netOfCostApr(flow, 1000, 30)).toBeLessThan(0)
  })
})

describe('divergenceLossVsHodl', () => {
  test('null against a non-positive HODL value', () => {
    expect(divergenceLossVsHodl(100, 0)).toBeNull()
  })

  test('is 0 when the position exactly tracks HODL', () => {
    expect(divergenceLossVsHodl(1000, 1000)).toBe(0)
  })

  test('is negative when the position underperforms HODL', () => {
    expect(divergenceLossVsHodl(900, 1000)).toBeCloseTo(-0.1, 10)
  })
})

describe('rebalanceStats', () => {
  test('zero events over a valid period gives a zero rate and null costs', () => {
    const stats = rebalanceStats([], 30)
    expect(stats.rebalancesPerPeriod).toBe(0)
    expect(stats.costPerRebalanceMedianUsd).toBeNull()
    expect(stats.costPerRebalanceP90Usd).toBeNull()
  })

  test('computes rate and median/p90 cost from itemised events', () => {
    const events: RebalanceEvent[] = [
      { gasUsd: 1, swapFeeUsd: 1, slippageUsd: 1 }, // 3
      { gasUsd: 2, swapFeeUsd: 2, slippageUsd: 2 }, // 6
      { gasUsd: 10, swapFeeUsd: 10, slippageUsd: 10 }, // 30
    ]
    const stats = rebalanceStats(events, 3)
    expect(stats.rebalancesPerPeriod).toBe(1)
    expect(stats.costPerRebalanceMedianUsd).toBe(6)
    expect(stats.costPerRebalanceP90Usd).toBe(30)
  })
})

describe('limitBandFillRate', () => {
  test('null when there is nothing to divide by', () => {
    expect(limitBandFillRate(0, 0, 0)).toBeNull()
  })

  test('counts partially-filled bands in the denominator but not the numerator', () => {
    expect(limitBandFillRate(1, 1, 2)).toBeCloseTo(0.25, 10)
  })
})

describe('realisedSigma', () => {
  test('null with fewer than three observations', () => {
    expect(realisedSigma([{ timestampMs: 0, tick: 0 }])).toBeNull()
  })

  test('zero for a perfectly flat tick stream', () => {
    const observations: TickObservation[] = [
      { timestampMs: 0, tick: 100 },
      { timestampMs: 1000, tick: 100 },
      { timestampMs: 2000, tick: 100 },
    ]
    expect(realisedSigma(observations)).toBe(0)
  })

  test('is positive when the tick moves', () => {
    const observations: TickObservation[] = [
      { timestampMs: 0, tick: 0 },
      { timestampMs: 1000, tick: 500 },
      { timestampMs: 2000, tick: -200 },
    ]
    expect(realisedSigma(observations)).toBeGreaterThan(0)
  })
})

describe('feeShareAchieved', () => {
  test('null against non-positive pool fees', () => {
    expect(feeShareAchieved(10, 0)).toBeNull()
  })

  test('is the position share of pool fees generated in range', () => {
    expect(feeShareAchieved(25, 100)).toBeCloseTo(0.25, 10)
  })
})

describe('poolViabilityMargin', () => {
  test('matches the stated formula: fee APR minus sigma-squared over 8', () => {
    expect(poolViabilityMargin(0.2, 0.4)).toBeCloseTo(0.2 - 0.4 ** 2 / 8, 10)
  })

  test('high volatility can push the margin negative even with a decent fee APR', () => {
    expect(poolViabilityMargin(0.05, 1.2)).toBeLessThan(0)
  })
})

describe('timeToRecoveryMedianSeconds', () => {
  test('null when no exit has recovered yet', () => {
    const events: RangeExitEvent[] = [{ exitTimestampMs: 0, recoveryTimestampMs: null }]
    expect(timeToRecoveryMedianSeconds(events)).toBeNull()
  })

  test('excludes not-yet-recovered exits from the median', () => {
    const events: RangeExitEvent[] = [
      { exitTimestampMs: 0, recoveryTimestampMs: 10_000 }, // 10s
      { exitTimestampMs: 0, recoveryTimestampMs: null },
      { exitTimestampMs: 0, recoveryTimestampMs: 30_000 }, // 30s
    ]
    expect(timeToRecoveryMedianSeconds(events)).toBe(20)
  })

  test('computes the median across an odd number of completed recoveries', () => {
    const events: RangeExitEvent[] = [
      { exitTimestampMs: 0, recoveryTimestampMs: 5_000 },
      { exitTimestampMs: 0, recoveryTimestampMs: 15_000 },
      { exitTimestampMs: 0, recoveryTimestampMs: 45_000 },
    ]
    expect(timeToRecoveryMedianSeconds(events)).toBe(15)
  })
})
