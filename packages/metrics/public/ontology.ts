/**
 * RING 0 · PURE — no I/O, imports nothing
 * `@repo/metrics/ontology` — public contract. Named exports only.
 *
 * Category KPI definitions and computations. Pure functions over observations.
 */

/**
 * The `metric_ontology_key` values for the rebalancing category — the only category with
 * canonical KPIs (`final-review-docs/03` §7.2). Do not invent KPIs for grid/yield/health-factor
 * — they stay `04b`'s unpromoted math, explicitly out of v1 (milestone plan §5).
 */
export type RebalancingMetricKey =
  | 'time_in_range_pct'
  | 'net_of_cost_apr'
  | 'divergence_loss_vs_hodl'
  | 'rebalances_per_period'
  | 'cost_per_rebalance'
  | 'limit_band_fill_rate'
  | 'realised_sigma'
  | 'fee_share_achieved'
  | 'pool_viability_margin'
  | 'time_to_recovery'

export interface MetricDefinition {
  key: RebalancingMetricKey
  label: string
  definition: string
  computedFrom: string
  /** `null` for metrics that are neither straightforwardly "more is better" nor "less is
   * better" on their own (e.g. `rebalances_per_period` — `03` §6.4: "more automation is not
   * better"). */
  higherIsBetter: boolean | null
  /** Must render at equal visual weight to its paired return metric — `03` §7.2's non-negotiable
   * display rule. "No return is ever rendered without its risk beside it." */
  isRiskMetric: boolean
}

export const REBALANCING_METRIC_ONTOLOGY: Readonly<Record<RebalancingMetricKey, MetricDefinition>> =
  {
    time_in_range_pct: {
      key: 'time_in_range_pct',
      label: 'Time in range',
      definition:
        'Σ(seconds with tickLower ≤ tick < tickUpper) ÷ elapsed seconds, over the reporting window',
      computedFrom: 'apps/watch tick stream + positions() bounds',
      higherIsBetter: true,
      isRiskMetric: false,
    },
    net_of_cost_apr: {
      key: 'net_of_cost_apr',
      label: 'Net-of-cost APR',
      definition:
        '(fees earned + CAKE harvested − gas − swap fees − slippage − realised divergence loss) ÷ position value, annualised',
      computedFrom: 'feeGrowthInside deltas, pendingCake/harvest events, tx receipts',
      higherIsBetter: true,
      isRiskMetric: false,
    },
    divergence_loss_vs_hodl: {
      key: 'divergence_loss_vs_hodl',
      label: 'Divergence loss vs. HODL',
      definition: 'V(P′)/V_hodl(P′) − 1, computed exactly per LEARN-ONE-DAY.md A2.6',
      computedFrom: 'position value at range-relative price + entry composition',
      higherIsBetter: true,
      isRiskMetric: true,
    },
    rebalances_per_period: {
      key: 'rebalances_per_period',
      label: 'Rebalances per period',
      definition: 'Count of rebalance transactions in the reporting window',
      computedFrom: 'tx receipts + pool state at execution',
      higherIsBetter: null,
      isRiskMetric: false,
    },
    cost_per_rebalance: {
      key: 'cost_per_rebalance',
      label: 'Cost per rebalance',
      definition: 'USD median and p90 cost, itemised gas / swap fee / slippage',
      computedFrom: 'tx receipts + pool state at execution',
      higherIsBetter: false,
      isRiskMetric: false,
    },
    limit_band_fill_rate: {
      key: 'limit_band_fill_rate',
      label: 'Limit-band fill rate',
      definition: 'filled ÷ (filled + un-filled + partially-filled) limit bands',
      computedFrom: 'mint/burn/collect events on the limit tokenId',
      higherIsBetter: true,
      isRiskMetric: false,
    },
    realised_sigma: {
      key: 'realised_sigma',
      label: 'Realised volatility',
      definition: 'Realised volatility of the pool over the same reporting window',
      computedFrom: 'tick stream',
      higherIsBetter: null,
      isRiskMetric: true,
    },
    fee_share_achieved: {
      key: 'fee_share_achieved',
      label: 'Fee share achieved',
      definition: 'Position fees ÷ pool fees generated inside the position range',
      computedFrom: 'feeGrowthInside vs. feeGrowthGlobal',
      higherIsBetter: true,
      isRiskMetric: false,
    },
    pool_viability_margin: {
      key: 'pool_viability_margin',
      label: 'Pool viability margin',
      definition: 'Pool fee APR − σ²/8, at decision time',
      computedFrom: 'market-data',
      higherIsBetter: true,
      isRiskMetric: false,
    },
    time_to_recovery: {
      key: 'time_to_recovery',
      label: 'Time to recovery',
      definition: 'Median seconds from range exit to back in range',
      computedFrom: 'tick stream + position events',
      higherIsBetter: false,
      isRiskMetric: false,
    },
  }
