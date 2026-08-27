/**
 * `@app/watch` — the one always-on process (00 §5.1).
 *
 * WHY THIS EXISTS, AND WHY IT IS URGENT
 * -------------------------------------
 * A PancakeSwap V3 pool's oracle keeps `observationCardinality` entries in a ring buffer.
 * Measured live on BSC (final-review-docs/03 §7.3, marked [V]): the busiest pool
 * (WBNB/USDT 0.01%, cardinality 2400) spans roughly **98 minutes**. The 0.25% and 1% pools
 * carry cardinality 150 — far less.
 *
 * Therefore `time_in_range_pct` CANNOT be reconstructed retroactively from chain state.
 * Every hour this process is not running is an hour of the headline rebalancing KPI that is
 * permanently unrecoverable. It is the only component in this repository whose output is a
 * function of how long it has been alive.
 *
 * WHAT IT MAY DO
 * --------------
 * Detect a condition and enqueue a job. That is all.
 *   - holds no keys
 *   - has NO import path to `custody` or `settlement` — enforced by
 *     `tooling/check-boundaries.ts`, not by this comment
 *   - if it dies, jobs stop being enqueued and that is immediately visible; nothing is left
 *     half-done, because it never started anything
 *
 * Every consequence of what it detects happens inside a retried, logged, observable task in
 * `@app/jobs`.
 */

const shutdown = new AbortController()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => shutdown.abort())
}

async function main(): Promise<void> {
  // TODO(E5): accumulate pool observations -> @repo/database, idempotent on
  //   (pool_address, observation_index, block_number) via ON CONFLICT DO NOTHING.
  //   Requires: the observations table, and @repo/market-data's slot0/observe reads.
  // TODO(E14a): endpoint liveness detection -> enqueue transition into @app/jobs.
  //   The transition itself executes in jobs, never here (decomposition E14a).
  await new Promise<void>((resolve) => {
    shutdown.signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

await main()

export {}
