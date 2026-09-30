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

import { createDbClient } from '@repo/database/client'
import { createListingLifecycleDeps } from './deps'
import { dispatchTask } from './dispatch'
import { claimPendingTasks, completeTask, releaseTask } from './queue'
import { runEvidenceRollup } from './tasks/rollup'
import { runRefundSweep } from './tasks/refund-sweep'

export const registry = {
  // TODO(E1): 'ingestion.crawl'   — delta-poll the registry; never a full re-scan
  'evidence.rollup': 'evidence.rollup',
  'listings.transition': 'listings.transition',
  refundSweep: 'refundSweep',
} as const

export type TaskName = keyof typeof registry

const POLL_INTERVAL_MS = 5_000
const MAX_BACKOFF_MS = 300_000
const ROLLUP_BATCH_INTERVAL_MS = 60 * 60 * 1000
const REFUND_SWEEP_INTERVAL_MS = 60 * 60 * 1000

interface RetryState {
  attempts: number
  nextRetryAt: number
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

function backoffMs(attempts: number): number {
  return Math.min(POLL_INTERVAL_MS * 2 ** attempts, MAX_BACKOFF_MS)
}

export async function runJobsLoop(params: {
  db: ReturnType<typeof createDbClient>['db']
  signal: AbortSignal
}): Promise<void> {
  const listingDeps = createListingLifecycleDeps(params.db)
  const ctx = { db: params.db, listingDeps }
  const retryState = new Map<string, RetryState>()
  let lastRollupBatchAt = 0
  let lastRefundSweepAt = 0

  while (!params.signal.aborted) {
    const now = Date.now()
    const tasks = await claimPendingTasks(params.db, 10)

    for (const task of tasks) {
      const retry = retryState.get(task.id)
      if (retry && retry.nextRetryAt > now) {
        await releaseTask(params.db, task.id)
        continue
      }

      try {
        await dispatchTask(ctx, task)
        await completeTask(params.db, task.id)
        retryState.delete(task.id)
      } catch (error) {
        const attempts = (retryState.get(task.id)?.attempts ?? 0) + 1
        retryState.set(task.id, { attempts, nextRetryAt: now + backoffMs(attempts) })
        await releaseTask(params.db, task.id)
        console.error(`[jobs] task ${task.taskName} (${task.id}) failed:`, error)
      }
    }

    if (now - lastRollupBatchAt >= ROLLUP_BATCH_INTERVAL_MS) {
      try {
        await runEvidenceRollup(params.db, { batch: true })
      } catch (error) {
        console.error('[jobs] scheduled evidence.rollup batch failed:', error)
      }
      lastRollupBatchAt = now
    }

    if (now - lastRefundSweepAt >= REFUND_SWEEP_INTERVAL_MS) {
      try {
        await runRefundSweep(params.db)
      } catch (error) {
        console.error('[jobs] scheduled refundSweep failed:', error)
      }
      lastRefundSweepAt = now
    }

    await sleep(POLL_INTERVAL_MS, params.signal)
  }
}

const shutdown = new AbortController()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => shutdown.abort())
}

async function main(): Promise<void> {
  const { db, sql } = createDbClient()
  try {
    await runJobsLoop({ db, signal: shutdown.signal })
  } finally {
    await sql.end()
  }
}

if (import.meta.main) {
  await main()
}

export {}
