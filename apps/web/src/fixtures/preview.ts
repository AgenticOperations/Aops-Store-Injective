// apps/web/src/fixtures/preview.ts

/**
 * A rendered `DECIDE` output — what the agent *would* do against current pool state, with no
 * `ACT` and no `RECORD` (`final-review-docs/03` §9.4, `architecture/04` §4.2).
 *
 * `DECIDE` is pure by design precisely so this page can exist: running it costs nothing, touches
 * no capital, and needs no wallet connection. That is what makes it the answer to "show value
 * before asking for a wallet" rather than a marketing screenshot.
 */
export type PreviewDecision = {
  observedAt: string
  poolState: { label: string; value: string }[]
  /** `ACT` when the agent would move, `HOLD` when it would decline — both are real answers. */
  action: 'ACT' | 'HOLD'
  headline: string
  reasoning: string[]
  wouldBeCalls: { contract: string; method: string; note: string }[]
  estimatedCostUsd: number | null
}

export const FIXTURE_PREVIEWS: Record<string, PreviewDecision> = {
  'lst-rebal-02': {
    observedAt: '2026-09-01T09:14:00Z',
    poolState: [
      { label: 'Pool', value: 'CAKE/BNB 0.25%' },
      { label: 'Spot', value: '0.00412 BNB' },
      { label: 'Current band', value: '0.00398 – 0.00428 BNB' },
      { label: 'Distance to upper edge', value: '52 bps' },
      { label: '1h volume', value: '$418k' },
      { label: 'Gas', value: '3.2 gwei' },
    ],
    action: 'ACT',
    headline: 'It would recentre the position now.',
    reasoning: [
      'Spot has drifted 52 bps past the upper edge of the 240 bps band, clearing the 40 bps trigger.',
      'Pool viability gate passes — 1h volume is well above the minimum for a maker-side fill.',
      'Gas at 3.2 gwei is inside the 5 gwei ceiling, so the move is not deferred.',
    ],
    wouldBeCalls: [
      {
        contract: 'PancakeSwap V3 NonfungiblePositionManager',
        method: 'decreaseLiquidity → collect → mint',
        note: 'Closes the current range and opens a new 240 bps band centred on spot.',
      },
    ],
    estimatedCostUsd: 1.42,
  },
  'lst-rebal-03': {
    observedAt: '2026-09-01T09:14:00Z',
    poolState: [
      { label: 'Pool', value: 'CAKE/BNB 0.25%' },
      { label: 'Spot', value: '0.00412 BNB' },
      { label: 'Current band', value: '0.00376 – 0.00450 BNB' },
      { label: 'Distance to upper edge', value: '88 bps' },
      { label: '1h volume', value: '$418k' },
      { label: 'Time since last rebalance', value: '19h' },
    ],
    action: 'HOLD',
    headline: 'It would do nothing right now.',
    reasoning: [
      'Spot is still inside the 700 bps band — 88 bps from the upper edge, under the 120 bps trigger.',
      'The 36h time backstop has not elapsed; last rebalance was 19h ago.',
      'Rebalancing here would cost roughly $3.08 to buy back range the position already has.',
    ],
    wouldBeCalls: [],
    estimatedCostUsd: null,
  },
  'lst-rebal-04': {
    observedAt: '2026-09-01T09:14:00Z',
    poolState: [
      { label: 'Pool', value: 'BTCB/BNB 0.05%' },
      { label: 'Spot', value: '0.00191 BNB' },
      { label: 'Current band', value: '0.00178 – 0.00205 BNB' },
      { label: 'Distance to upper edge', value: '73 bps' },
      { label: 'Endpoint', value: 'not answering' },
    ],
    action: 'HOLD',
    headline: 'It could not be asked — its endpoint is not answering.',
    reasoning: [
      'This agent is currently DEGRADED, so no live decision could be obtained from it.',
      'The pool state above is ours; the decision below it is absent, not neutral.',
      'A degraded agent is still listed and still hireable — but you would be hiring something we cannot reach right now.',
    ],
    wouldBeCalls: [],
    estimatedCostUsd: null,
  },
  'lst-grid-01': {
    observedAt: '2026-09-01T09:14:00Z',
    poolState: [
      { label: 'Pair', value: 'BNB/USDT' },
      { label: 'Spot', value: '$612.40' },
      { label: 'Declared grid', value: '$560 – $680, 12 levels' },
      { label: 'Nearest unfilled level', value: '$605.00' },
    ],
    action: 'HOLD',
    headline: 'It would leave its resting orders where they are.',
    reasoning: [
      'Spot sits between grid levels; no level is crossed, so no order needs replacing.',
      'This agent has no measured history, so this preview is the only evidence about it that exists.',
    ],
    wouldBeCalls: [],
    estimatedCostUsd: null,
  },
  'lst-yield-01': {
    observedAt: '2026-09-01T09:14:00Z',
    poolState: [
      { label: 'Protocol', value: 'Venus' },
      { label: 'Current market', value: 'USDT · 4.10% supply APY' },
      { label: 'Best market', value: 'USDC · 5.02% supply APY' },
      { label: 'Spread', value: '92 bps' },
      { label: 'Round-trip gas', value: '$0.94' },
      { label: 'Dwell time elapsed', value: '31h of 24h minimum' },
    ],
    action: 'ACT',
    headline: 'It would move the supplied position from USDT to USDC.',
    reasoning: [
      'The 92 bps spread clears the round-trip gas cost at the current position size.',
      'The 24h minimum dwell time has elapsed, so the move is not churn.',
    ],
    wouldBeCalls: [
      {
        contract: 'Venus vToken (USDT)',
        method: 'redeem',
        note: 'Withdraws the supplied balance.',
      },
      {
        contract: 'Venus vToken (USDC)',
        method: 'mint',
        note: 'Re-supplies into the higher-yielding market.',
      },
    ],
    estimatedCostUsd: 0.94,
  },
  'lst-health-01': {
    observedAt: '2026-09-01T09:14:00Z',
    poolState: [
      { label: 'Protocol', value: 'Venus' },
      { label: 'Health factor', value: '1.84' },
      { label: 'Declared floor', value: '1.35' },
      { label: 'Buffer available', value: '250 USDT' },
    ],
    action: 'HOLD',
    headline: 'It would not repay anything right now.',
    reasoning: [
      'Health factor is 1.84, comfortably above the 1.35 floor it was configured to defend.',
      'It has never borrowed and never adds collateral it was not given, so there is no other action available to it.',
    ],
    wouldBeCalls: [],
    estimatedCostUsd: null,
  },
}
