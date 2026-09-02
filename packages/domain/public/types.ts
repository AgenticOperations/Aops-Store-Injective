/**
 * RING 0 · PURE — no I/O, imports nothing
 * `@repo/domain/types` — public contract. Named exports only.
 *
 * Entities, state machines, transition guards, shared types. The vocabulary of the whole system.
 */

/** A hackathon-mandated category — `final-review-docs/03` RESEARCH.md tracks-tab data, resolved
 * in the v1 milestone plan §2 item 1. Not the stale blog-post list. */
export type Category =
  | 'rebalancing'
  | 'grid_trading'
  | 'yield_optimization'
  | 'health_factor_monitoring'

/** Ranking/discovery signal, never a hiring-eligibility gate — `final-review-docs/01` §5. */
export type TrustTier = 'Low' | 'Medium' | 'High'

/** `L0` (self-declared, display-only) through `L6` (marketplace-run controlled benchmark) —
 * `architecture/01` §1.5's evidence source table. */
export type EvidenceLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type WalletAddress = `0x${string}`
