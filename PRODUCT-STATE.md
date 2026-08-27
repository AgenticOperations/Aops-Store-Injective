# Product State — Aops-Store-BNB

Living snapshot, not a log — overwritten as things progress. For chronological history, see
`HANDOFF_RYUK.md` / `HANDOFF_KC.md`. For the doc pipeline this file assumes, see `CLAUDE.md`.

**Last updated**: 2026-08-27

## What this is

Agent marketplace for BNB Chain's "Build the Era" hackathon (Smart Money Era track) —
ERC-8004-based discovery/comparison/hiring marketplace for BNB AI agents, covering four
mandatory categories (rebalancing, grid trading, yield optimization, health-factor
monitoring). Targets the main track plus Altana, TermiX, and PancakeSwap partner tracks.
Submission deadline: 2026-09-09.

## Phase

**UI scaffold.** Repo shape is standing on `build/staging` (16 packages, 5 apps). KC is
scaffolding the buyer and builder surfaces now, then moving to the agents. See Decision
[`0003`](docs/architecture/decisions/0003-kc-ui-first-then-agents.md). Architecture continues
to promote into `docs/final-review-docs/` alongside that.

## What's canonical right now

- **Ingestion & registration** — `docs/final-review-docs/01-ingestion-and-registration-of-agents.md`.
  The DISCOVERED → CLAIMED → OWNERSHIP_VERIFIED → ENDPOINT_VERIFIED → LIVE ladder, and the
  Low/Medium/High trust-tier system (Low compulsory/fact-only, Medium/High optional,
  tier is a discovery/ranking signal never a hiring gate). Replaces the old
  Basic/Verified/Proven/Institutional ladder and the old
  CAPABILITY_VERIFIED→EXECUTION_VERIFIED→COMMERCIAL_VERIFIED→RISK_REVIEW→APPROVED chain.
- **Fraud/Sybil detection** — `docs/final-review-docs/02-fraud-sybil-detection.md`. Wallet-
  cluster/timing-burst/reciprocal-pair suspicion signals feeding `independence_confidence`;
  self-dealing guard extended to owner-controlled identities (closes the §7.2 gap); sandbox
  rate-limit guard. **Scoped as additive and hackathon-deferred**: never gates the ladder or
  hiring, exact thresholds are explicitly left open (doc §7) — safe to build after the
  mandated-category work, not a blocker for it.
- **Rebalancing category (Category Agent 1)** — `docs/final-review-docs/03-category-agent-rebalancing.md`.
  The LP Range Rebalancer end to end: strategy model (base+limit, threshold triggers,
  pool-viability gate), the marketplace's independent measurement layer (`metrics`/`market-data`/
  `watch`), the category KPI set with formulas, the buyer surface, and the Altana session scope.
  Every contract fact verified by live call against chain 56/97 on 2026-08-25. **Three findings
  that change the plan**: MasterChefV3 owns 81,608 V3 positions (so `NPM.decreaseLiquidity`
  reverts on farmed positions); BSC testnet has liquidity but no order flow (pools last traded
  1.5–128 days ago vs. ~0s on mainnet), so no KPI can be produced from organic testnet activity;
  and the pool oracle only retains ~98 minutes of tick history, so `% time in range` must be
  accumulated continuously by `apps/watch` or backfilled from a paid data source.

## In progress

- **UI scaffold (KC, now)** — `apps/web` (buyer marketplace) and `apps/console` (builder).
  Page shells, layout, design-system wiring. Hire-card / `grantSession` wiring still waits
  on E11's four open decisions; that does not block standing the surfaces up. Decision 0003.
- **Agents (KC, next)** — progressive, in the separate agents repo (Decision 0001). Blocked
  on Part 9 item 6 (where that repo lives) *when that work starts*, not this week. E5 grading
  and sandbox-compat are defined as each agent is framed, not as a UI prerequisite.

## Known open architectural gaps (not silently dropped — tracked explicitly)

See `docs/final-review-docs/01-ingestion-and-registration-of-agents.md` §12 for full detail:

1. Where `commercial_config` (max position size, max daily tx count, max slippage,
   auto-pause threshold) and a risk-tier capital ceiling fit now that
   `COMMERCIAL_VERIFIED`/`RISK_REVIEW`/`APPROVED` are gone. Leaning: plain owner-editable
   field with a platform-ceiling formula, no blocking gate — unconfirmed, belongs in the
   Builder Console doc.
2. Whether/how the TermiX Agent Advantage Report (L6 benchmark) re-enters as a named
   High-trust evidence source — it isn't currently named as one in §7.
3. Fraud/Sybil's deferred thresholds (`docs/final-review-docs/02` §7) — hop limits, windows,
   z-score cutoffs, sandbox rate-limit N — need real values before those signals go live.
4. **Where rebalancing evidence comes from** (`docs/final-review-docs/03` §11, §13) — testnet has
   no order flow, so the options are shadow-measuring mainnet third parties (no capital, ready
   now), running our agent on mainnet with small real capital (a capital decision, needs a human
   call), and/or clearly-labelled synthetic testnet flow. Recommendation is shadow + labelled
   synthetic, with mainnet capital escalated. Also open: the historical data source, since public
   BSC RPCs reject `eth_getLogs`.

## Doc restructuring (2026-08-24)

`docs/arch-wireframe-v0/` + `docs/decisions/` merged into `docs/architecture/` (with
`decisions/` as a subfolder) and reconciled against the current trust-tier design.
`docs/final-review-docs/` unchanged. New: `docs/unverified-ideas-and-flows/` (raw-idea drop
zone), root `CLAUDE.md` (workspace rules, auto-loaded every session), this file, and
per-collaborator handoffs (`HANDOFF_RYUK.md`, `HANDOFF_KC.md`, split from the single prior
`HANDOFF.md`). Full rationale in `CLAUDE.md`.

## Next steps

**KC this week (Decision 0003):** scaffold the UI, then move to the agents.

1. **Now — UI scaffold** in `apps/web` and `apps/console`. Empty routes, layout, design-system
   wiring, page shells. Not hire-card mechanics, not `grantSession`.
2. **Then — agents**, progressively, in the separate agents repo. Rebalancer V3 spike is still
   the first engineering item *there* (`04b` §4b.10, `03` §12). Needs Part 9 item 6 answered
   first (where that repo lives).
3. Architecture catch-up, not a gate on (1): promote remaining categories (grid, yield,
   health-factor) one at a time; reconcile stale package paths in `architecture/03` and `05`;
   the four open gaps above stay named. Gap 1 still blocks *wiring* the hire card, not
   scaffolding the console around it.

`HANDOFF_KC.md`'s 2026-08-24 "Do not start Builder Console yet" is superseded by Decision 0003.
Do not treat that entry as current.
