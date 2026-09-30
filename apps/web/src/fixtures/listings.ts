// apps/web/src/fixtures/listings.ts

export type Category =
  | 'rebalancing'
  | 'grid-trading'
  | 'yield-optimization'
  | 'health-factor-monitoring'

export type ListingStatus =
  | 'DISCOVERED'
  | 'CLAIMED'
  | 'OWNERSHIP_VERIFIED'
  | 'ENDPOINT_VERIFIED'
  | 'LIVE'

export type TrustTier = 'Low' | 'Medium' | 'High'

/** `census` liveness, tracked separately from the ladder (`final-review-docs/01` §2, §10). */
export type SyncStatus = 'LIVE' | 'DEGRADED'

/** Crawl vs. self-registration (`final-review-docs/01` §2). Display-only; nothing downstream differs. */
export type Provenance = 'crawled' | 'self-registered'

export type EvidenceLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L6'

export type ProofType = 'CAPABILITY' | 'OUTCOME' | 'EXECUTION' | 'RELIABILITY'

/**
 * One row of the append-only Evidence feed rendered in detail Layer 2 (`architecture/05` §5.2).
 * `permissionsUsed` is already the redacted scope summary correction 3 mandates — the raw signed
 * session payload is never a field here, so no render path can leak it.
 */
export type EvidenceRow = {
  id: string
  occurredAt: string
  level: EvidenceLevel
  proofType: ProofType
  source: string
  /** True only for Watcher-sourced rows — labelled "observed by marketplace operator" (`05` §5.2). */
  operatorObserved: boolean
  summary: string
  txHash: string | null
  permissionsUsed: string | null
}

/**
 * Score and confidence, always together (`architecture/05` §5.2 — a high score at low confidence
 * must never render indistinguishably from a high-confidence one). `null` on the whole object is
 * the third state: no evidence at all, which renders as "No track record yet", never as 0.
 */
export type Score = {
  value: number
  /** 0–1, saturating in sample size and level diversity (`architecture/01` §1.9). */
  confidence: number
  sampleSize: number
}

/**
 * Category KPI set for rebalancing (`final-review-docs/03` §7.2, surfaced by §9.1/§9.3).
 * `divergenceLossVsHodlPct` sits beside `netAprPct` at equal weight by contract: a rebalancer
 * that beats HODL on APR while losing more to divergence is not a better agent, and rendering
 * one without the other is the single most misleading thing this surface could do.
 */
export type RebalancingKpis = {
  pool: string
  feeTier: string
  /** Observation window every KPI below shares — no KPI is ever rendered without it. */
  window: string
  sampleSize: number
  provenanceLabel: string
  timeInRangePct: number
  netAprPct: number
  divergenceLossVsHodlPct: number
  rebalancesPerWeek: number
  bandWidthBps: number
  triggerThresholdBps: number
  fillRatePct: number
  costPerRebalanceUsd: number
}

export type DeclineEntry = {
  at: string
  reason: string
}

export type Listing = {
  id: string
  name: string
  category: Category
  status: ListingStatus
  trustTier: TrustTier
  syncStatus: SyncStatus
  provenance: Provenance
  /** Owner-declared, per `commercial_config` — never session-enforced at this stage. */
  feeBps: number
  /** null = no evidence yet. Never render this as 0. */
  evidenceCount: number | null
  /** null = no evidence yet. Never render this as a 0 score. */
  score: Score | null
  capabilities: string[]
  summary: string
  /** One paragraph a stranger can read (`03` §9.3). */
  strategy: string | null
  kpis: RebalancingKpis | null
  /** The §6.1 decline log — refusals are a positive signal, so they are shown, not hidden. */
  declineLog: DeclineEntry[]
  evidence: EvidenceRow[]
}

/**
 * One listing per mandated category (rebalancing, grid trading, yield optimization,
 * health-factor monitoring) — the hackathon rubric scores equal depth across all four, so the
 * fixture set must never favor one category with more/richer entries than the others.
 * Statuses are deliberately spread across the DISCOVERED → LIVE ladder (`final-review-docs/01`
 * §4) so both the unclaimed-directory case and the zero-evidence / has-evidence LIVE cases are
 * all exercised by at least one fixture, per the main scaffold plan's Chunk 2 fixture spec.
 *
 * Rebalancing carries three LIVE entries rather than one, because it is the only category whose
 * comparison surface (`03` §9.2) has to demonstrate both halves of its own rule: two agents on
 * the same pool and window differing only in band width (directly comparable), and a third on a
 * different pool and window (comparable only behind an explicit warning). One fixture cannot
 * show a rule that is about the relationship between two of them.
 */
export const FIXTURE_LISTINGS: Listing[] = [
  {
    id: 'lst-rebal-01',
    name: 'PancakeSwap Range Rebalancer',
    category: 'rebalancing',
    status: 'DISCOVERED',
    trustTier: 'Low',
    syncStatus: 'LIVE',
    provenance: 'crawled',
    feeBps: 0,
    evidenceCount: null,
    score: null,
    capabilities: ['PancakeSwap V3'],
    summary: 'Registered on-chain, not yet claimed by an operator.',
    strategy: null,
    kpis: null,
    declineLog: [],
    evidence: [],
  },
  {
    id: 'lst-rebal-02',
    name: 'Narrow Band CAKE/BNB',
    category: 'rebalancing',
    status: 'LIVE',
    trustTier: 'Medium',
    syncStatus: 'LIVE',
    provenance: 'self-registered',
    feeBps: 60,
    evidenceCount: 34,
    score: { value: 78, confidence: 0.81, sampleSize: 34 },
    capabilities: ['PancakeSwap V3', 'CAKE/BNB', 'maker-only'],
    summary:
      'Medium trust — passed the sandbox test, 34 evidence rows across 30 days of measured on-chain activity.',
    strategy:
      'Holds a single narrow base position around spot on CAKE/BNB 0.25%, and rebalances when price ' +
      'drifts more than 40 bps past either edge of a 240 bps band. Posts maker-side only, so a ' +
      'rebalance waits for a fill rather than crossing the spread — cheaper per move, but it spends ' +
      'more time out of range in a fast market. No limit position, no inventory skew.',
    kpis: {
      pool: 'CAKE/BNB',
      feeTier: '0.25%',
      window: '30d',
      sampleSize: 34,
      provenanceLabel: 'marketplace-measured from chain',
      timeInRangePct: 71.4,
      netAprPct: 18.2,
      divergenceLossVsHodlPct: -4.6,
      rebalancesPerWeek: 5.4,
      bandWidthBps: 240,
      triggerThresholdBps: 40,
      fillRatePct: 88.2,
      costPerRebalanceUsd: 1.42,
    },
    declineLog: [
      {
        at: '2026-08-24T09:12:00Z',
        reason:
          'Gas ceiling exceeded — 8.1 gwei against a 5 gwei cap. Rebalance deferred, not skipped.',
      },
      {
        at: '2026-08-19T22:40:00Z',
        reason: 'Pool viability gate failed — 1h volume under the minimum for a maker-side fill.',
      },
    ],
    evidence: [
      {
        id: 'ev-r02-04',
        occurredAt: '2026-08-26T14:02:00Z',
        level: 'L3',
        proofType: 'OUTCOME',
        source: 'Marketplace-computed domain KPI from on-chain state',
        operatorObserved: false,
        summary: 'time_in_range 71.4% over the trailing 30d window, 34 observed rebalances.',
        txHash: null,
        permissionsUsed: null,
      },
      {
        id: 'ev-r02-03',
        occurredAt: '2026-08-21T08:31:00Z',
        level: 'L2',
        proofType: 'CAPABILITY',
        source: 'Marketplace sandbox test (mainnet fork, perturbed scenario)',
        operatorObserved: true,
        summary: 'Passed 6/6 graduated scenarios. Graded on resulting position, not on tx count.',
        txHash: null,
        permissionsUsed: 'spend cap: 0 (fork, zero real funds) · contracts: [PancakeSwap V3 NPM]',
      },
      {
        id: 'ev-r02-02',
        occurredAt: '2026-08-14T11:55:00Z',
        level: 'L1',
        proofType: 'OUTCOME',
        source: 'Raw ERC-8004 feedback event',
        operatorObserved: false,
        summary:
          'Two positive feedback events from one counterparty. Sybil-discount applied before use.',
        txHash: '0x7c1a…9e42',
        permissionsUsed: null,
      },
      {
        id: 'ev-r02-01',
        occurredAt: '2026-08-11T16:20:00Z',
        level: 'L0',
        proofType: 'CAPABILITY',
        source: 'Self-declared agentURI capability',
        operatorObserved: false,
        summary: 'Declares PancakeSwap V3 range management. Display-only, never scored.',
        txHash: null,
        permissionsUsed: null,
      },
    ],
  },
  {
    id: 'lst-rebal-03',
    name: 'Wide Band CAKE/BNB',
    category: 'rebalancing',
    status: 'LIVE',
    trustTier: 'High',
    syncStatus: 'LIVE',
    provenance: 'self-registered',
    feeBps: 85,
    evidenceCount: 61,
    score: { value: 84, confidence: 0.93, sampleSize: 61 },
    capabilities: ['PancakeSwap V3', 'CAKE/BNB', 'base+limit', 'taker-fallback'],
    summary:
      'High trust — same pool and window as Narrow Band, independently evaluated on real execution.',
    strategy:
      'Runs a base position across a 700 bps band on CAKE/BNB 0.25% plus a one-sided limit position ' +
      'that absorbs inventory skew after each move. Triggers at 120 bps past an edge, with a 36h time ' +
      'backstop so a quiet market still gets recentred. Falls back to taker execution when a maker ' +
      'fill has not landed within 20 minutes — more expensive per rebalance, materially less time ' +
      'out of range.',
    kpis: {
      pool: 'CAKE/BNB',
      feeTier: '0.25%',
      window: '30d',
      sampleSize: 61,
      provenanceLabel: 'marketplace-measured from chain',
      timeInRangePct: 89.1,
      netAprPct: 15.7,
      divergenceLossVsHodlPct: -2.1,
      rebalancesPerWeek: 2.1,
      bandWidthBps: 700,
      triggerThresholdBps: 120,
      fillRatePct: 96.4,
      costPerRebalanceUsd: 3.08,
    },
    declineLog: [
      {
        at: '2026-08-25T03:18:00Z',
        reason:
          'Slippage cap would have been breached at the quoted size. Declined, position left in place.',
      },
    ],
    evidence: [
      {
        id: 'ev-r03-04',
        occurredAt: '2026-08-27T09:44:00Z',
        level: 'L3',
        proofType: 'EXECUTION',
        source: 'AACP PROGRAM job, independent staked Evaluator',
        operatorObserved: false,
        summary:
          'Owner-funded showcase job on mainnet settled and independently evaluated. Marketplace contributed zero capital.',
        txHash: '0x2f88…41ba',
        permissionsUsed:
          'spend cap: 500 USDC · contracts: [PancakeSwap V3 Router, V3 NPM] · expiry: 72h',
      },
      {
        id: 'ev-r03-03',
        occurredAt: '2026-08-26T14:02:00Z',
        level: 'L3',
        proofType: 'OUTCOME',
        source: 'Marketplace-computed domain KPI from on-chain state',
        operatorObserved: false,
        summary: 'time_in_range 89.1% over the trailing 30d window, 61 observed rebalances.',
        txHash: null,
        permissionsUsed: null,
      },
      {
        id: 'ev-r03-02',
        occurredAt: '2026-08-18T19:07:00Z',
        level: 'L2',
        proofType: 'CAPABILITY',
        source: 'Marketplace sandbox test (mainnet fork, perturbed scenario)',
        operatorObserved: true,
        summary: 'Passed 6/6 graduated scenarios, including the wide-gap edge case.',
        txHash: null,
        permissionsUsed: 'spend cap: 0 (fork, zero real funds) · contracts: [PancakeSwap V3 NPM]',
      },
      {
        id: 'ev-r03-01',
        occurredAt: '2026-08-09T10:00:00Z',
        level: 'L0',
        proofType: 'CAPABILITY',
        source: 'Self-declared agentURI capability',
        operatorObserved: false,
        summary: 'Declares base+limit V3 range management. Display-only, never scored.',
        txHash: null,
        permissionsUsed: null,
      },
    ],
  },
  {
    id: 'lst-rebal-04',
    name: 'BTCB/BNB Conservative',
    category: 'rebalancing',
    status: 'LIVE',
    trustTier: 'Low',
    syncStatus: 'DEGRADED',
    provenance: 'crawled',
    feeBps: 30,
    evidenceCount: 3,
    score: { value: 71, confidence: 0.22, sampleSize: 3 },
    capabilities: ['PancakeSwap V3', 'BTCB/BNB'],
    summary:
      'Live at Low trust on a different pool and a shorter window — three measurements only, so its score carries a wide confidence band.',
    strategy:
      'Single wide base position on BTCB/BNB 0.05% with a 1400 bps band and a 200 bps trigger. Only ' +
      'three rebalances have been observed since it went live, which is why every number on this ' +
      'page is shown with its sample size attached.',
    kpis: {
      pool: 'BTCB/BNB',
      feeTier: '0.05%',
      window: '7d',
      sampleSize: 3,
      provenanceLabel: 'marketplace-measured from chain',
      timeInRangePct: 94.8,
      netAprPct: 6.4,
      divergenceLossVsHodlPct: -0.4,
      rebalancesPerWeek: 3.0,
      bandWidthBps: 1400,
      triggerThresholdBps: 200,
      fillRatePct: 100,
      costPerRebalanceUsd: 2.11,
    },
    declineLog: [],
    evidence: [
      {
        id: 'ev-r04-02',
        occurredAt: '2026-08-27T02:15:00Z',
        level: 'L3',
        proofType: 'OUTCOME',
        source: 'Marketplace-computed domain KPI from on-chain state',
        operatorObserved: false,
        summary: 'time_in_range 94.8% over the trailing 7d window, 3 observed rebalances.',
        txHash: null,
        permissionsUsed: null,
      },
      {
        id: 'ev-r04-01',
        occurredAt: '2026-08-22T12:00:00Z',
        level: 'L0',
        proofType: 'CAPABILITY',
        source: 'Self-declared agentURI capability',
        operatorObserved: false,
        summary: 'Declares PancakeSwap V3 range management. Display-only, never scored.',
        txHash: null,
        permissionsUsed: null,
      },
    ],
  },
  {
    id: 'lst-grid-01',
    name: 'BNB/USDT Grid Runner',
    category: 'grid-trading',
    status: 'LIVE',
    trustTier: 'Low',
    syncStatus: 'LIVE',
    provenance: 'crawled',
    feeBps: 50,
    evidenceCount: null,
    score: null,
    capabilities: ['BNB/USDT', 'fixed-grid'],
    summary: 'Live at Low trust. No sandbox or execution evidence yet.',
    strategy:
      'Fixed arithmetic grid across a declared price band on BNB/USDT, one order per level, no ' +
      'reinvestment of realised profit. Nothing has been measured yet — this description is the ' +
      "owner's, not ours.",
    kpis: null,
    declineLog: [],
    evidence: [],
  },
  {
    id: 'lst-yield-01',
    name: 'Venus Yield Router',
    category: 'yield-optimization',
    status: 'LIVE',
    trustTier: 'Medium',
    syncStatus: 'LIVE',
    provenance: 'self-registered',
    feeBps: 75,
    evidenceCount: 12,
    score: { value: 74, confidence: 0.64, sampleSize: 12 },
    capabilities: ['Venus Protocol', 'multi-pool routing'],
    summary: 'Medium trust — passed the marketplace sandbox test, 12 evidence rows on file.',
    strategy:
      'Moves supplied collateral between Venus markets when the spread between the best and current ' +
      'supply APY clears the round-trip gas cost, with a minimum dwell time so it cannot churn.',
    kpis: null,
    declineLog: [],
    evidence: [
      {
        id: 'ev-y01-02',
        occurredAt: '2026-08-25T13:30:00Z',
        level: 'L2',
        proofType: 'CAPABILITY',
        source: 'Marketplace sandbox test (mainnet fork, perturbed scenario)',
        operatorObserved: true,
        summary: 'Passed 5/6 graduated scenarios; failed the paused-market edge case.',
        txHash: null,
        permissionsUsed: 'spend cap: 0 (fork, zero real funds) · contracts: [Venus Comptroller]',
      },
      {
        id: 'ev-y01-01',
        occurredAt: '2026-08-12T08:00:00Z',
        level: 'L0',
        proofType: 'CAPABILITY',
        source: 'Self-declared agentURI capability',
        operatorObserved: false,
        summary: 'Declares Venus supply-side routing. Display-only, never scored.',
        txHash: null,
        permissionsUsed: null,
      },
    ],
  },
  {
    id: 'lst-health-01',
    name: 'Venus Sentinel',
    category: 'health-factor-monitoring',
    status: 'LIVE',
    trustTier: 'Medium',
    syncStatus: 'LIVE',
    provenance: 'crawled',
    feeBps: 40,
    evidenceCount: 5,
    score: { value: 80, confidence: 0.48, sampleSize: 5 },
    capabilities: ['Venus Protocol', 'auto-repay'],
    summary: 'Medium trust — 5 verified executions, zero liquidations on record.',
    strategy:
      'Watches the borrower health factor and repays from a funded buffer when it falls below a ' +
      'declared floor. Never borrows, never adds collateral it was not given.',
    kpis: null,
    declineLog: [
      {
        at: '2026-08-23T05:02:00Z',
        reason:
          'Health factor recovered on its own before the repay window opened. No action taken.',
      },
    ],
    evidence: [
      {
        id: 'ev-h01-02',
        occurredAt: '2026-08-24T21:11:00Z',
        level: 'L2',
        proofType: 'CAPABILITY',
        source: 'Marketplace sandbox test (mainnet fork, perturbed scenario)',
        operatorObserved: true,
        summary: 'Repaid correctly under a forced 22% collateral drawdown.',
        txHash: null,
        permissionsUsed: 'spend cap: 0 (fork, zero real funds) · contracts: [Venus vToken]',
      },
      {
        id: 'ev-h01-01',
        occurredAt: '2026-08-16T09:45:00Z',
        level: 'L1',
        proofType: 'OUTCOME',
        source: 'Raw ERC-8004 feedback event',
        operatorObserved: false,
        summary: 'One positive feedback event. Sybil-discount applied before use.',
        txHash: '0xaa31…07cd',
        permissionsUsed: null,
      },
    ],
  },
]

export function findListing(id: string): Listing | undefined {
  return FIXTURE_LISTINGS.find((listing) => listing.id === id)
}
