/**
 * `@app/jobs` — batch and event-driven work. THE COMPOSITION POINT (00 §5.2).
 *
 * This is where a pure decision, a cached observation, an owned-state write and — only here —
 * an irreversible action are combined into one operation. Composition belongs here precisely
 * because it is then visible in one file while each part stays independently testable.
 *
 * Every task in this app is:
 *   - **scheduled or event-driven**, never called from a request path
 *   - **retried with backoff**
 *   - **idempotent by key** — a re-run after a crash must be a no-op, not a duplicate row
 *
 * Unblocked engines that live here today:
 *   E1  ingestion crawl        (final-review-docs/01 §2-3)
 *   E6  evidence rollup cron   (architecture/01 §1.5/1.6/1.9)
 *   E14a transition execution  (watch detects; the transition runs here)
 *
 * Blocked or dead, deliberately absent: E3 fork provisioning (rubrics open), E4 (removed
 * 2026-08-26), E7 (thresholds open), E12/E13 (E11 + settlement design), E15 (undesigned).
 */

export const registry = {
  // TODO(E1): 'ingestion.crawl'   — delta-poll the registry; never a full re-scan
  // TODO(E6): 'evidence.rollup'   — recompute score + confidence; naturally idempotent
  //                                 because evidence is append-only and never mutated
} as const

export type TaskName = keyof typeof registry
