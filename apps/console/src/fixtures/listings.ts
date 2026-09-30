// apps/console/src/fixtures/listings.ts
//
// Deliberately NOT imported from `apps/web`. The two apps model the same agent from opposite
// sides — the buyer sees measured results, the owner sees what they still have to do — and the
// shared Ring 0 type that would reconcile them is a later joint commit, not this plan's to invent.

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

export type SyncStatus = 'LIVE' | 'DEGRADED'

/** Owner-declared operating limits. Not enforced by anything at this stage — see `01` §12. */
export type CommercialConfig = {
  maxPositionSizeUsd: number
  maxDailyTxCount: number
  maxSlippageBps: number
  autoPauseDrawdownPct: number
  feeBps: number
}

export type SandboxAttempt = {
  at: string
  outcome: 'PASSED' | 'FAILED'
  detail: string
}

export type OwnedListing = {
  id: string
  name: string
  category: Category
  status: ListingStatus
  trustTier: TrustTier
  syncStatus: SyncStatus
  ownerAddress: string
  endpoint: string
  /** null when the agent has never been sandbox-tested. Never render as a 0 or a fail. */
  sandboxAttempts: SandboxAttempt[]
  /** True once an independent AACP evaluator has signed off real execution (High trust). */
  hasIndependentAttestation: boolean
  commercialConfig: CommercialConfig
  evidenceCount: number | null
  activeHires: number
}

export const FIXTURE_OWNED: OwnedListing[] = [
  {
    id: 'lst-rebal-03',
    name: 'Wide Band CAKE/BNB',
    category: 'rebalancing',
    status: 'LIVE',
    trustTier: 'High',
    syncStatus: 'LIVE',
    ownerAddress: '0x9f2c…d410',
    endpoint: 'https://agents.example.xyz/wide-band/decide',
    sandboxAttempts: [
      {
        at: '2026-08-18T19:07:00Z',
        outcome: 'PASSED',
        detail: '6/6 graduated scenarios, including the wide-gap edge case.',
      },
    ],
    hasIndependentAttestation: true,
    commercialConfig: {
      maxPositionSizeUsd: 25000,
      maxDailyTxCount: 12,
      maxSlippageBps: 50,
      autoPauseDrawdownPct: 8,
      feeBps: 85,
    },
    evidenceCount: 61,
    activeHires: 1,
  },
  {
    id: 'lst-rebal-02',
    name: 'Narrow Band CAKE/BNB',
    category: 'rebalancing',
    status: 'LIVE',
    trustTier: 'Medium',
    syncStatus: 'LIVE',
    ownerAddress: '0x9f2c…d410',
    endpoint: 'https://agents.example.xyz/narrow-band/decide',
    sandboxAttempts: [
      {
        at: '2026-08-21T08:31:00Z',
        outcome: 'PASSED',
        detail: '6/6 graduated scenarios.',
      },
      {
        at: '2026-08-20T14:02:00Z',
        outcome: 'FAILED',
        detail: 'Failed the fast-gap scenario — left the position out of range for the whole run.',
      },
    ],
    hasIndependentAttestation: false,
    commercialConfig: {
      maxPositionSizeUsd: 10000,
      maxDailyTxCount: 20,
      maxSlippageBps: 30,
      autoPauseDrawdownPct: 5,
      feeBps: 60,
    },
    evidenceCount: 34,
    activeHires: 0,
  },
  {
    id: 'lst-rebal-04',
    name: 'BTCB/BNB Conservative',
    category: 'rebalancing',
    status: 'LIVE',
    trustTier: 'Low',
    syncStatus: 'DEGRADED',
    ownerAddress: '0x9f2c…d410',
    endpoint: 'https://agents.example.xyz/btcb-conservative/decide',
    sandboxAttempts: [],
    hasIndependentAttestation: false,
    commercialConfig: {
      maxPositionSizeUsd: 5000,
      maxDailyTxCount: 6,
      maxSlippageBps: 80,
      autoPauseDrawdownPct: 10,
      feeBps: 30,
    },
    evidenceCount: 3,
    activeHires: 0,
  },
  {
    id: 'lst-rebal-01',
    name: 'PancakeSwap Range Rebalancer',
    category: 'rebalancing',
    status: 'DISCOVERED',
    trustTier: 'Low',
    syncStatus: 'LIVE',
    ownerAddress: '0x4b81…7c03',
    endpoint: 'https://unknown.example.xyz/rebalancer',
    sandboxAttempts: [],
    hasIndependentAttestation: false,
    commercialConfig: {
      maxPositionSizeUsd: 0,
      maxDailyTxCount: 0,
      maxSlippageBps: 0,
      autoPauseDrawdownPct: 0,
      feeBps: 0,
    },
    evidenceCount: null,
    activeHires: 0,
  },
]

export function findOwned(id: string): OwnedListing | undefined {
  return FIXTURE_OWNED.find((listing) => listing.id === id)
}
