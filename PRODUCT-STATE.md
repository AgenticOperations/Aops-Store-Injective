# Product State — Aops-Store-BNB

Living snapshot, not a log — overwritten as things progress. For chronological history, see
`HANDOFF_RYUK.md` / `HANDOFF_KC.md`. For the doc pipeline this file assumes, see `CLAUDE.md`.

**Last updated**: 2026-08-24

## What this is

Agent marketplace for BNB Chain's "Build the Era" hackathon (Smart Money Era track) —
ERC-8004-based discovery/comparison/hiring marketplace for BNB AI agents, covering four
mandatory categories (rebalancing, grid trading, yield optimization, health-factor
monitoring). Targets the main track plus Altana, TermiX, and PancakeSwap partner tracks.
Submission deadline: 2026-09-09.

## Phase

**Pre-build.** All work so far is architecture/design in `docs/architecture/`, being
progressively promoted to `docs/final-review-docs/` as sections reach a proven-robust state.
No implementation has started.

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

## In progress

- **Builder Console (minimum)** — architecture drafted in chat (`apps/console`, zero Ring 3
  access, construct-not-sign pattern for owner-funded flows; claim/register, status
  dashboard, Medium-tier trigger, High-tier dual entry, commercial-config editor, revoke,
  read-only disputes), not yet written to `docs/final-review-docs/`.

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

## Doc restructuring (2026-08-24)

`docs/arch-wireframe-v0/` + `docs/decisions/` merged into `docs/architecture/` (with
`decisions/` as a subfolder) and reconciled against the current trust-tier design.
`docs/final-review-docs/` unchanged. New: `docs/unverified-ideas-and-flows/` (raw-idea drop
zone), root `CLAUDE.md` (workspace rules, auto-loaded every session), this file, and
per-collaborator handoffs (`HANDOFF_RYUK.md`, `HANDOFF_KC.md`, split from the single prior
`HANDOFF.md`). Full rationale in `CLAUDE.md`.

## Next steps

Goal: finalize everything below so the **Discovery Engine is the last unbuilt component**,
with all its dependencies — especially the proof/evidence engine — ready end-to-end before
it's started. Full detail in `HANDOFF_KC.md`'s 2026-08-24 entry.

1. Promote `docs/architecture/04`/`04b` (category-agent execution — the actual mechanics of
   the four mandated categories) to `docs/final-review-docs/`, fixing `04`'s false Venus
   threshold citation along the way.
2. Formalize execution, hiring-job, and proof/evidence work — `docs/architecture/03` and `05`
   are the source material; reconcile their remaining stale package-path naming as each
   section is promoted.
3. Resolve the two open gaps above explicitly (user decision needed, not an inline default).
4. Builder Console stays deferred until 1–3 are real — it's a UI over flows that don't have a
   console-facing interaction model yet, and it's blocked by gap #1 above.
