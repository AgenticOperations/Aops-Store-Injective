// apps/web/src/fixtures/hires.ts

/**
 * An authorised job in flight (`architecture/01` §1.4 lifecycle, surfaced by `03` §9.6).
 * Fixture only — nothing here was created by a real `grantSession`, because E11 is not wired.
 */
export type Hire = {
  id: string
  listingId: string
  state: 'CONFIGURED' | 'AUTHORIZED' | 'ACTIVE' | 'SETTLED'
  grantedAt: string
  expiresAt: string
  spendCapUsdc: number
  spentUsdc: number
  allowlist: string[]
  /** Live position readings — the §9.6 set. */
  position: {
    pool: string
    currentPrice: string
    bandLower: string
    bandUpper: string
    distanceToTriggerBps: number
    timeInRangePctSoFar: number
    observedFor: string
    rebalancesSoFar: number
    costToDateUsd: number
  } | null
}

export const FIXTURE_HIRES: Hire[] = [
  {
    id: 'hire-001',
    listingId: 'lst-rebal-03',
    state: 'ACTIVE',
    grantedAt: '2026-08-30T11:00:00Z',
    expiresAt: '2026-09-02T11:00:00Z',
    spendCapUsdc: 500,
    spentUsdc: 61.4,
    allowlist: ['PancakeSwap V3 Router', 'PancakeSwap V3 NonfungiblePositionManager'],
    position: {
      pool: 'CAKE/BNB 0.25%',
      currentPrice: '0.00412 BNB',
      bandLower: '0.00376 BNB',
      bandUpper: '0.00450 BNB',
      distanceToTriggerBps: 32,
      timeInRangePctSoFar: 91.6,
      observedFor: '46h',
      rebalancesSoFar: 2,
      costToDateUsd: 6.16,
    },
  },
  {
    id: 'hire-002',
    listingId: 'lst-health-01',
    state: 'ACTIVE',
    grantedAt: '2026-08-28T08:30:00Z',
    expiresAt: '2026-09-04T08:30:00Z',
    spendCapUsdc: 250,
    spentUsdc: 0,
    allowlist: ['Venus vToken (USDT)'],
    position: null,
  },
]

export function findHire(id: string): Hire | undefined {
  return FIXTURE_HIRES.find((hire) => hire.id === id)
}
