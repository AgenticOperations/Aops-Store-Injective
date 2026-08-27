# Final Review Docs — Canonical Truth Index

Files in this folder are the canonical, final, most-rigorously-checked versions of each
feature area, headed for actual review. **They are the source of truth.** Docs in
`docs/architecture/` (numbered sections + `decisions/` ADRs, merged as of 2026-08-24) are
reconciled toward these, never the reverse. When a topic below has an entry, stop reading
`docs/architecture/` for that topic — the corresponding sections there are kept current
enough not to contradict this folder, but this folder is authoritative on anything they
disagree on.

**Rule for adding a new entry**: the same turn a new final-review doc lands, grep
`docs/architecture/` for the topic and stamp every section it supersedes with a banner +
pointer, plus update the table below. Do not defer this — deferring it is exactly what let
three files describe three different trust-tier systems at once before this index existed
(see `HANDOFF_RYUK.md`, 2026-08-24).

## Status by topic

| Topic | Canonical doc | Supersedes (stamped) |
|---|---|---|
| Ingestion, registration, DISCOVERED→LIVE ladder, Low/Medium/High trust tiers | [01-ingestion-and-registration-of-agents.md](01-ingestion-and-registration-of-agents.md) | `architecture/01-data-model-state-machines.md` §1.2 (state ladder), §1.8 (trust-tier gating); `architecture/03-evidence-trust-engine-pipeline.md` §3.2 (onboarding mechanism); `architecture/decisions/0002-...md` Bug-1 fix; `architecture/05-buyer-trust-hiring-hosting.md` (Basic→Low rename) |
| Fraud / Sybil detection (additive, hackathon-deferred — see doc's §7) | [02-fraud-sybil-detection.md](02-fraud-sybil-detection.md) | `architecture/01-data-model-state-machines.md` §1.10 (signal categories, now fully specified); `architecture/03-evidence-trust-engine-pipeline.md` §3.6 (sybil precedent, mechanics now specified) and §3.3 step 6 (self-dealing guard, now extended to owner-controlled identities) |
| **Rebalancing category** — LP Range Rebalancer strategy model, independent measurement, KPIs, buyer surface, session scope | [03-category-agent-rebalancing.md](03-category-agent-rebalancing.md) | `architecture/04-category-agent-execution-architecture.md` §4.3 (Rebalancer row); `architecture/04b-category-agent-strategy-models.md` §4b.4 (expanded + corrected: MasterChefV3 surface, pool-viability gate) and §4b.9 (V3 TVL figure) |
| Grid trading / Yield / Health factor categories | *not yet written* — `architecture/04b` §4b.5–4b.7 remain the working source | — |
| Builder Console | *not yet written* — **surfaces are being scaffolded now** (Decision [`0003`](../architecture/decisions/0003-kc-ui-first-then-agents.md)); the console *doc* is still unwritten | `HANDOFF_KC.md` 2026-08-24 "Do not start Builder Console yet" (sequencing only, not the console's eventual content) |

## Not yet reconciled (known gaps, not silent)

- `architecture/03-evidence-trust-engine-pipeline.md`'s package paths (`apps/worker/...`,
  `chain-adapters/aacp`) throughout are stale against `architecture/00-repo-architecture-and-
  agent-conventions.md`'s ring architecture (`apps/jobs`, `agent-registry`, `custody`, etc.) —
  only §3.2 has been banner-stamped so far since that's the section the Ingestion doc
  actually superseded on mechanism, not just naming. §3.6/§3.3 step 6 are now content-current
  via the Fraud/Sybil entry but still carry the same stale package-path naming — fix
  opportunistically when each remaining section becomes relevant to a new final-review doc.
