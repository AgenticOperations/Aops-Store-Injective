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

export type Listing = {
  id: string
  name: string
  category: Category
  status: ListingStatus
  trustTier: TrustTier
  /** Owner-declared, per `commercial_config` — never session-enforced at this stage. */
  feeBps: number
  /** null = no evidence yet. Never render this as 0. */
  evidenceCount: number | null
  capabilities: string[]
  summary: string
}

/**
 * One listing per mandated category (rebalancing, grid trading, yield optimization,
 * health-factor monitoring) — the hackathon rubric scores equal depth across all four, so the
 * fixture set must never favor one category with more/richer entries than the others.
 * Statuses are deliberately spread across the DISCOVERED → LIVE ladder (`final-review-docs/01`
 * §4) so both the unclaimed-directory case and the zero-evidence / has-evidence LIVE cases are
 * all exercised by at least one fixture, per the main scaffold plan's Chunk 2 fixture spec.
 */
export const FIXTURE_LISTINGS: Listing[] = [
  {
    id: 'lst-rebal-01',
    name: 'PancakeSwap Range Rebalancer',
    category: 'rebalancing',
    status: 'DISCOVERED',
    trustTier: 'Low',
    feeBps: 0,
    evidenceCount: null,
    capabilities: ['PancakeSwap V3'],
    summary: 'Registered on-chain, not yet claimed by an operator.',
  },
  {
    id: 'lst-grid-01',
    name: 'BNB/USDT Grid Runner',
    category: 'grid-trading',
    status: 'LIVE',
    trustTier: 'Low',
    feeBps: 50,
    evidenceCount: null,
    capabilities: ['BNB/USDT', 'fixed-grid'],
    summary: 'Live at Low trust. No sandbox or execution evidence yet.',
  },
  {
    id: 'lst-yield-01',
    name: 'Venus Yield Router',
    category: 'yield-optimization',
    status: 'LIVE',
    trustTier: 'Medium',
    feeBps: 75,
    evidenceCount: 12,
    capabilities: ['Venus Protocol', 'multi-pool routing'],
    summary: 'Medium trust — passed the marketplace sandbox test, 12 evidence rows on file.',
  },
  {
    id: 'lst-health-01',
    name: 'Venus Sentinel',
    category: 'health-factor-monitoring',
    status: 'LIVE',
    trustTier: 'Medium',
    feeBps: 40,
    evidenceCount: 5,
    capabilities: ['Venus Protocol', 'auto-repay'],
    summary: 'Medium trust — 5 verified executions, zero liquidations on record.',
  },
]
