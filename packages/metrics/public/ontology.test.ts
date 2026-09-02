// packages/metrics/public/ontology.test.ts
import { describe, expect, test } from 'bun:test'
import { REBALANCING_METRIC_ONTOLOGY, type RebalancingMetricKey } from './ontology'

const EXPECTED_KEYS: RebalancingMetricKey[] = [
  'time_in_range_pct',
  'net_of_cost_apr',
  'divergence_loss_vs_hodl',
  'rebalances_per_period',
  'cost_per_rebalance',
  'limit_band_fill_rate',
  'realised_sigma',
  'fee_share_achieved',
  'pool_viability_margin',
  'time_to_recovery',
]

describe('REBALANCING_METRIC_ONTOLOGY', () => {
  test('carries exactly the 10 metric_ontology_key values from final-review-docs/03 §7.2', () => {
    expect(Object.keys(REBALANCING_METRIC_ONTOLOGY).sort()).toEqual([...EXPECTED_KEYS].sort())
  })

  test("every entry's key field matches its own map key", () => {
    for (const [mapKey, definition] of Object.entries(REBALANCING_METRIC_ONTOLOGY)) {
      expect(definition.key).toBe(mapKey as RebalancingMetricKey)
    }
  })

  test("divergence loss and realised volatility are flagged as risk metrics — 03 §7.2's equal-weight display rule", () => {
    expect(REBALANCING_METRIC_ONTOLOGY.divergence_loss_vs_hodl.isRiskMetric).toBe(true)
    expect(REBALANCING_METRIC_ONTOLOGY.realised_sigma.isRiskMetric).toBe(true)
  })

  test('every entry has a non-empty label, definition, and computedFrom', () => {
    for (const definition of Object.values(REBALANCING_METRIC_ONTOLOGY)) {
      expect(definition.label.length).toBeGreaterThan(0)
      expect(definition.definition.length).toBeGreaterThan(0)
      expect(definition.computedFrom.length).toBeGreaterThan(0)
    }
  })
})
