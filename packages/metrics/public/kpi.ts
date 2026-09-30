/**
 * RING 0 · PURE — no I/O, imports nothing
 * `@repo/metrics/kpi` — public contract. Named exports only.
 *
 * Category KPI definitions and computations. Pure functions over observations.
 *
 * Every function here is pure math over already-fetched observation data — `market-data`
 * (Ring 1, read-only) and `apps/watch` (detect-and-enqueue only) do the actual chain reads;
 * `01` §1.9's independence rule ("no KPI is ever computed from an agent's self-report") holds
 * because there is no import path from an agent into this package at all.
 *
 * `null` is returned whenever a KPI cannot honestly be computed from the given observations
 * (too few samples, zero elapsed time, zero denominator) — never a synthesized `0`, mirroring
 * `scoring`'s zero-evidence rule.
 */

// -------------------------------------------------------------------------------------------
// time_in_range_pct — `03` §7.2, §7.3. Time-weighted: the tick observed at the START of each
// interval determines whether that interval counts as "in range" (standard step-function
// accounting for an irregularly-sampled series).
// -------------------------------------------------------------------------------------------

export interface TickObservation {
  timestampMs: number
  tick: number
}

export interface PositionRange {
  tickLower: number
  tickUpper: number
}

export function timeInRangePct(
  observations: readonly TickObservation[],
  range: PositionRange,
): number | null {
  if (observations.length < 2) return null
  const sorted = [...observations].sort((a, b) => a.timestampMs - b.timestampMs)
  const first = sorted[0] as TickObservation
  const last = sorted[sorted.length - 1] as TickObservation
  const elapsedMs = last.timestampMs - first.timestampMs
  if (elapsedMs <= 0) return null

  let inRangeMs = 0
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i] as TickObservation
    const next = sorted[i + 1] as TickObservation
    const intervalMs = next.timestampMs - current.timestampMs
    if (current.tick >= range.tickLower && current.tick < range.tickUpper) {
      inRangeMs += intervalMs
    }
  }
  return inRangeMs / elapsedMs
}

// -------------------------------------------------------------------------------------------
// net_of_cost_apr — `03` §7.2
// -------------------------------------------------------------------------------------------

export interface CostFlow {
  feesEarnedUsd: number
  cakeHarvestedUsd: number
  gasUsd: number
  swapFeesUsd: number
  slippageUsd: number
  realisedDivergenceLossUsd: number
}

export function netOfCostApr(
  flow: CostFlow,
  positionValueUsd: number,
  periodDays: number,
): number | null {
  if (positionValueUsd <= 0 || periodDays <= 0) return null
  const net =
    flow.feesEarnedUsd +
    flow.cakeHarvestedUsd -
    flow.gasUsd -
    flow.swapFeesUsd -
    flow.slippageUsd -
    flow.realisedDivergenceLossUsd
  return (net / positionValueUsd) * (365 / periodDays)
}

// -------------------------------------------------------------------------------------------
// divergence_loss_vs_hodl — `03` §7.2, LEARN-ONE-DAY.md A2.6
// -------------------------------------------------------------------------------------------

export function divergenceLossVsHodl(
  positionValueAtPUsd: number,
  hodlValueAtPUsd: number,
): number | null {
  if (hodlValueAtPUsd <= 0) return null
  return positionValueAtPUsd / hodlValueAtPUsd - 1
}

// -------------------------------------------------------------------------------------------
// rebalances_per_period, cost_per_rebalance — `03` §7.2
// -------------------------------------------------------------------------------------------

export interface RebalanceEvent {
  gasUsd: number
  swapFeeUsd: number
  slippageUsd: number
}

export interface RebalanceStats {
  rebalancesPerPeriod: number
  costPerRebalanceMedianUsd: number | null
  costPerRebalanceP90Usd: number | null
}

function percentile(sortedValues: readonly number[], p: number): number {
  const index = Math.min(sortedValues.length - 1, Math.ceil((p / 100) * sortedValues.length) - 1)
  return sortedValues[Math.max(index, 0)] as number
}

export function rebalanceStats(
  events: readonly RebalanceEvent[],
  periodDays: number,
): RebalanceStats {
  if (periodDays <= 0) {
    return { rebalancesPerPeriod: 0, costPerRebalanceMedianUsd: null, costPerRebalanceP90Usd: null }
  }
  const rebalancesPerPeriod = events.length / periodDays
  if (events.length === 0) {
    return { rebalancesPerPeriod, costPerRebalanceMedianUsd: null, costPerRebalanceP90Usd: null }
  }
  const costs = events.map((e) => e.gasUsd + e.swapFeeUsd + e.slippageUsd).sort((a, b) => a - b)
  return {
    rebalancesPerPeriod,
    costPerRebalanceMedianUsd: percentile(costs, 50),
    costPerRebalanceP90Usd: percentile(costs, 90),
  }
}

// -------------------------------------------------------------------------------------------
// limit_band_fill_rate — `03` §7.2, §6.3
// -------------------------------------------------------------------------------------------

export function limitBandFillRate(
  filled: number,
  unfilled: number,
  partiallyFilled: number,
): number | null {
  const denominator = filled + unfilled + partiallyFilled
  if (denominator <= 0) return null
  return filled / denominator
}

// -------------------------------------------------------------------------------------------
// realised_sigma — `03` §7.2. Sample standard deviation of log price returns implied by the
// tick stream (price = 1.0001^tick, the Uniswap V3 tick-to-price convention), over the window
// the observations span. Not annualised — the KPI is scoped to "the same window" as the other
// per-period KPIs, and every KPI publishes its own observation-window start (`03` §7.3 rule 3).
// -------------------------------------------------------------------------------------------

export function realisedSigma(observations: readonly TickObservation[]): number | null {
  if (observations.length < 3) return null
  const sorted = [...observations].sort((a, b) => a.timestampMs - b.timestampMs)
  const logReturns: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const previousTick = (sorted[i - 1] as TickObservation).tick
    const currentTick = (sorted[i] as TickObservation).tick
    // ln(price_t / price_{t-1}) = ln(1.0001^(tick_t - tick_{t-1})) = (tick_t - tick_{t-1}) * ln(1.0001)
    logReturns.push((currentTick - previousTick) * Math.log(1.0001))
  }
  const mean = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length
  const variance = logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (logReturns.length - 1)
  return Math.sqrt(variance)
}

// -------------------------------------------------------------------------------------------
// fee_share_achieved — `03` §7.2
// -------------------------------------------------------------------------------------------

export function feeShareAchieved(
  positionFeesEarnedUsd: number,
  poolFeesGeneratedInRangeUsd: number,
): number | null {
  if (poolFeesGeneratedInRangeUsd <= 0) return null
  return positionFeesEarnedUsd / poolFeesGeneratedInRangeUsd
}

// -------------------------------------------------------------------------------------------
// pool_viability_margin — `03` §6.1, §7.2. The precondition gate: is this pool worth providing
// liquidity to at all?
// -------------------------------------------------------------------------------------------

export function poolViabilityMargin(poolFeeAprPct: number, annualizedSigma: number): number {
  return poolFeeAprPct - annualizedSigma ** 2 / 8
}

// -------------------------------------------------------------------------------------------
// time_to_recovery — `03` §7.2. Median seconds from a range exit to the next re-entry; only
// completed (exited-then-recovered) intervals count.
// -------------------------------------------------------------------------------------------

export interface RangeExitEvent {
  exitTimestampMs: number
  /** `null` if the position has not yet re-entered range as of the reporting window's end. */
  recoveryTimestampMs: number | null
}

export function timeToRecoveryMedianSeconds(events: readonly RangeExitEvent[]): number | null {
  const completed = events
    .filter(
      (e): e is RangeExitEvent & { recoveryTimestampMs: number } => e.recoveryTimestampMs !== null,
    )
    .map((e) => (e.recoveryTimestampMs - e.exitTimestampMs) / 1000)
    .sort((a, b) => a - b)
  if (completed.length === 0) return null
  const mid = Math.floor(completed.length / 2)
  if (completed.length % 2 === 0) {
    return ((completed[mid - 1] as number) + (completed[mid] as number)) / 2
  }
  return completed[mid] as number
}
