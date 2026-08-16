---
created: 2026-08-16
project: BUILD-BNB — BNB "Build the Era" marketplace
status: drafted in chat, self-audited (9 corrections applied before write — see 5.1), approved
section: 5 of N — Buyer-Facing Trust UI, Hiring Flows, Settlement Review, Hosting
depends_on: 01-data-model-state-machines.md, 02-module-boundaries-repo-layout.md,
  03-evidence-trust-engine-pipeline.md, 04-category-agent-execution-architecture.md
---

# Section 5 — Buyer-Facing Trust UI, Hiring Flows, Settlement Review, Hosting

## 5.0 Scope and dependency map

This section is client/marketplace-surface-facing. It introduces exactly two new backend
concepts — **Settlement Review** (a new Evidence source) and **Watcher** (a new observation
component, hosted-tier only) — everything else is UI/flow structure over existing fields.

- **On Section 1**: reuses `trust_tier` (1.8), `evidence_level`/`source`/`payload` (1.5), the
  score/confidence formula (1.9), `economic_relationship_tier` (1.9), sybil discounting
  (1.10), the category-scoping rule (1.0), and the `dispute_window` (1.2/1.4) verbatim.
  Settlement Review is designed to satisfy 1.9's existing weight terms, not add new ones.
- **On Section 2**: hosting-ledger/metering logic and the `aops` CLI are new components not
  previously placed in the package tree — 5.5 proposes a location and flags it as
  implementation-confirmable, consistent with how 4.7 scoped open items.
- **On Section 3**: Settlement Review and Watcher both terminate in the existing Evidence
  pipeline (3.3/3.4) as new *sources*, not new *pipelines*. Watcher's self-observation status
  (5.6) is checked against 3's self-dealing guard logic and found to be a different concern
  (it's not an AACP Evaluator role) but is disclosed at a different weight for the same
  underlying reason that guard exists — the platform should never let its own observation of
  itself present as independent.
- **On Section 4**: hosting tiers apply identically to the four category agents and any
  third-party agent — no special-casing, consistent with 4.0's founding principle.

## 5.1 Self-audit findings and corrections applied before writing

A direct audit pass (not part of the original chat draft) found nine gaps between "presented
in chat" and "production-grade, fully functionally defined." All nine are fixed in the
sections below, not deferred, because each is a correctness or security issue rather than a
tuning parameter:

1. Layer 1/2 needed an explicit **empty-state** (zero evidence ≠ low evidence) — 5.2.
2. Layer 4 comparison needed the **category-scoping rule from 1.0 enforced**, not implied —
   5.2.
3. Layer 2's expandable payload needed a **redaction rule** — `payload` (1.5) can carry
   `permissions-used`/wallet detail that must not render verbatim to a public viewer — 5.2.
4. Hiring flows needed **failure paths** (gate-fail, funding-tx-fail, insufficient Client-side
   AACP staking per 1.7's real `0x4e236e9a` revert) — 5.3.
5. The agent-hires-agent flow needed to be **actually defined**, not hand-waved — 5.3.
6. Settlement Review needed to fire **after dispute resolution**, not at raw terminal-state
   entry, given 1.2/1.4's `dispute_window` — 5.4.
7. "Mandatory" agent-to-agent feedback needed a **concrete enforcement mechanism**, and every
   review needed **authenticity binding** to a real `job_id`/`authorization_id` — 5.4.
8. Hosting needed **billing-ledger mechanics, AWS-quota multi-tenancy handling** (bag's own
   docs: `L-F4575653` can be 0 on a fresh AWS account — directly relevant once *we* are the
   account hosting many tenants), and **per-agent secret isolation** — 5.5.
9. Watcher evidence needed to be **weighted as operator-observed, not independent** — scoring
   it like AACP's third-party evaluation would be a real trust-integrity error — 5.6.

## 5.2 Buyer-facing trust UI — four layers

**Layer 1 — Agent card** (discovery/comparison list): trust tier badge (1.8), score +
confidence shown together (1.9 — a high score at low confidence must never render
indistinguishably from a high-confidence one), live status (`sync_status`, 1.1), fee model
(1.2's `commercial_config`).

**Empty state (correction 1)**: a Listing with zero Evidence rows (fresh `LIVE`, Basic tier)
renders a distinct "No track record yet" state — not a 0 score, not a blank score, not
omitted. A low-confidence *populated* score renders differently again (visible confidence
band, e.g. a range or a muted-score treatment) — the three states (none / weak / strong) must
be visually distinguishable at a glance, since collapsing any two of them is a
misrepresentation of trust, not a display nuance.

**Layer 2 — Evidence timeline** (agent detail page): chronological Evidence feed (1.5), an
L0–L6 legend table in plain language, `tx_hash`/`verification_ref` links where present,
expandable payload.

**Payload redaction (correction 3)**: the expanded view renders a redacted projection of
`payload` — `decision`/`result`/`inputs` fields relevant to what happened are shown;
`permissions-used` renders as a scope summary (e.g. "spend cap: 500 USDC, contracts:
[PancakeSwap V3 Router]") never the raw signed session payload, and no wallet address beyond
the already-public `agent_id`'s associated address is surfaced. This is a rendering rule on
read, not a change to what's stored — the underlying Evidence row is untouched (1.5's
append-only/immutable guarantee is unaffected).

**Layer 3 — Methodology transparency**: 1.9's weighting formula explained plainly,
`methodology_version` shown, sybil-discount disclosure (1.10). **New disclosure (ties to
correction 9, detailed in 5.6)**: any Watcher-sourced Evidence is explicitly labeled
"observed by marketplace operator" wherever it's shown, distinct from AACP's "independently
verified" label — the UI must never let a reader conflate the two.

**Layer 4 — Comparison view**: side-by-side of 2+ agents. **Category enforcement (correction
2)**: the comparison UI only ever offers agents within the same `category` as selectable
comparison targets, enforced at the query layer (not just hidden in the UI), matching 1.0's
"never globally" rule verbatim — there is no code path that can assemble a cross-category
comparison, not just a UI affordance that avoids showing one.

## 5.3 Hiring flows — shared shape, four variants, explicit failure paths

Shared pre-steps: **(a) hiring-gate check** — buyer's minimum trust tier vs.
`Listing.trust_tier`, enforced (1.3); **(b) capital-rail setup** — creates the relevant
`Authorization`.

| Listing type | Authorization | Happy path | Failure paths (correction 4) |
|---|---|---|---|
| persistent-service | `ALTANA_SESSION` | Review trust data → set spend cap/allowlist/expiry → `grantSession` → `CONFIGURED→AUTHORIZED→ACTIVE` | Gate-fail: blocked before `grantSession` is ever offered, buyer sees the required tier and current tier side by side, not a generic error. `grantSession` tx failure/rejection: `Authorization` never created, buyer returned to the pre-hire state, no partial state to clean up. |
| task (`PLAIN`) | `ERC8183_ESCROW` | Buyer funds escrow, generic Altana lifecycle | Funding tx failure: escrow never reaches `Funded`, `Job/Service` stays uncreated — same no-partial-state guarantee. |
| task (`AACP_PROGRAM`) | `ERC8183_ESCROW` | Same escrow + AACP Client role, fee delta shown before confirm | **New check**: before offering this option, the flow verifies the marketplace's own AACP Client staking pool (1.7) has sufficient Available balance for this job's `budget × 5% ÷ reputationCoefficient` lock. If insufficient, `AACP_PROGRAM` is not offered as a choice at all (falls back to `PLAIN` transparently) rather than being offered and failing on `createJob`'s `0x4e236e9a` revert at confirm time. |
| paid-capability | `X402_PAYMENT` | request→402→pay→result | Payment failure: no result returned, no state persisted beyond the audit log entry (1.4 — "logged not stateful") — nothing to roll back. |
| agent-hires-agent | inherits underlying flow | **Defined (correction 5)**: identical gate-check and rail-setup logic runs programmatically via the Agent-to-Agent API — the calling agent submits the same fields a human would via UI (target trust tier requirement, rail-specific parameters), receives the same enforced gate/failure responses as structured API errors (not UI copy), and on success receives the same `Authorization`/`Job` identifiers a human flow would. No separate code path from the human flow beyond the transport (API call vs. UI form) — both terminate in the same gate-check and Authorization-creation logic, so there is exactly one place either can break. |

## 5.4 Settlement Review — new Evidence source

**Trigger timing (correction 6)**: fires strictly on a Job/Service reaching **final** terminal
state — for task listings with an open `dispute_window` (1.2/1.4), that means after the
window closes and any dispute resolves, not at raw `Submitted`/`Completed` entry. This
prevents a review being posted while the outcome it's rating is still contestable.

**Authenticity binding (correction 7)**: every review is created by the marketplace against a
specific `(job_id, authorization_id)` pair that reached the qualifying terminal state, from
the wallet recorded as buyer on that specific record — not a free-standing form. There is no
path to submit a review unattached to a real settled engagement.

**Human buyer**: dashboard-prompted, optional, public.

**Agent-to-agent buyer — enforcement mechanism (correction 7)**: v0 enforcement is
**protocol-adjacent, not smart-contract-enforced** — the Agent-to-Agent API's next-hire call
from the same buyer agent against *any* listing is gated on the prior qualifying job's
feedback log being present (a request-time check against outstanding-feedback state, not an
on-chain lock). This is stated explicitly as a policy-level gate, not a cryptographic
guarantee, because building the mandatory case as a contract-level block is a larger
scope than v0 needs — flagged in 5.7's open items as a strengthenable-later mechanism, but the
policy gate is fully specified and enforced now, not hand-waved.

**Immutability (correction 7, consistency with 1.5)**: a review is Evidence — append-only,
never edited. A buyer wanting to revise a review submits a new Evidence row referencing the
same `job_id`; the UI shows the latest as primary with prior versions visible in the Layer 2
timeline (1.5's append-only guarantee is unchanged, not special-cased for reviews).

**New Evidence source row (extends 1.5's table)**:

| Source | proof_type | evidence_level | Notes |
|---|---|---|---|
| Settlement Review (post-final-terminal-state, buyer-authored, bound to job_id) | OUTCOME | L2 | Boosted by `economic_relationship_tier` in 1.9 when the reviewer wallet has a `COMPLETED_JOB`/`REPEATED_CUSTOMER` relationship to the agent (existing 1.9 term, not a new one) — the first Settlement Review from a given buyer against a given agent moves that pair from `NO_INTERACTION` to `COMPLETED_JOB` on the existing ladder; a second engagement moves it to `REPEATED_CUSTOMER` |

## 5.5 Hosting tiers

**Self-hosted / external** (default): unchanged from Section 4 — agent runs outside our
control, observed only from outside via existing Evidence mechanics.

**Marketplace-hosted** (optional, promoted): config-based v0, reusing Section 4's
`agent-strategies` shape — not arbitrary-code sandboxing (roadmap).

**`aops` CLI**: thin wrapper over `bag` (confirmed scriptable via `bag deploy --provider aws
--yes`; deploy target is credential-driven, so pointing at AgentOps's AWS account instead of
the user's is the documented self-deploy path). `aops init agent` runs `bag init`/`doctor`/
`deploy prepare` unchanged; at deploy time offers self-host (user's AWS credentials) vs.
AgentOps-hosted (our credentials).

**Billing ledger (correction 8)**: a `hosting_credit_ledger` row per hosted Listing —
`credit_balance_usd` (starts at 5.00), `metered_usage_usd` (accrued from AWS AgentCore's own
per-vCPU-hour/GB-hour billing lines, read back via the deploy-cli's delegated status/logs
commands, not re-derived independently), `status`
(TRIAL_ACTIVE/TRIAL_EXHAUSTED/BILLING_ACTIVE/SUSPENDED). At `credit_balance_usd` reaching
zero: status moves to `TRIAL_EXHAUSTED`, the agent is given a defined grace window (config
value, not pinned here) to attach a payment method, and only moves to `SUSPENDED` (triggering
`bag deploy destroy`) after that grace window lapses with no payment attached — never an
instant, silent teardown of a running agent.

**AWS quota multi-tenancy (correction 8)**: `bag`'s own docs flag AgentCore's
`L-F4575653` ("Total Agents per Account") quota can start at 0 on a fresh account. Since
AgentOps-hosted agents all deploy into *one* AgentOps AWS account, this is a real operational
constraint, not a per-user edge case — the hosting-ledger service must track remaining quota
headroom before accepting a new AgentOps-hosted deployment and refuse new onboarding (falling
back to offering self-host only) when headroom is exhausted, rather than deploying and failing
at the AWS layer.

**Per-agent secret isolation (correction 8)**: `bag`'s own delegated-deploy mechanism already
provisions one Secrets Manager secret per project (`bnbagent/<project>/runtime`) with a
scoped runtime execution role — this isolation is inherited for free when AgentOps is the AWS
account owner, since each hosted agent is still deployed as its own distinct project/secret
under our account, not pooled into shared credentials. No new isolation mechanism needs
building; this section only confirms the inherited property holds under our account too.

**Package location**: `hosting_credit_ledger` and quota-tracking logic belong in
`apps/worker` (billing/metering is operational backend, not agent decision logic — consistent
with 2.2's dependency rules); `aops` is proposed as its own top-level package
(`packages/aops-cli` or a standalone `apps/aops-cli`) since it's a distribution artifact, not
a runtime dependency of the marketplace itself. Exact placement is confirmed at
implementation time, consistent with how 4.7 scoped comparable decisions — this is a location
choice, not an open design question.

## 5.6 Watcher — independent observer (marketplace-hosted tier only)

Watches hosted-agent execution directly at the container/runtime boundary — concretely, via
the CloudWatch monitoring `bag`'s own AgentCore deploy path already wires up (confirmed in the
`use-aws-agentcore` reference: `bag deploy logs --provider aws` delegates to CloudWatch tail)
plus independent direct chain reads — **never via the agent's own self-reported callback**,
since that would only be as strong as any other self-declared claim.

**Mechanism, made concrete**: Watcher cross-checks what the agent's Evidence-writing RECORD
step (4.2) claims happened against (a) the CloudWatch execution log for that time window and
(b) an independent chain-state read for the claimed `tx_hash`. Agreement produces no new
Evidence (the agent's own record stands, just corroborated). **Mismatch consequence
(correction 9 follow-through)**: a disagreement writes a new Evidence row —
`proof_type = RELIABILITY`, describing the discrepancy — which flows into 1.9's score exactly
like any other Evidence row; it does not trigger a separate gate or special penalty path,
consistent with there being no special-cased trust logic anywhere else in the design (4.0).

**Weighting (correction 9)**: Watcher-sourced Evidence is real, first-party, stronger than
self-declaration — but it is **operator-observed, not third-party-independent** the way an
AACP Evaluator is. Its `source` value is distinct from the AACP `PROGRAM`-job source in 1.5's
table specifically so 1.9's `source_rank(e.source)` term can weight it lower than genuine
third-party verification, even though both may render in a similar L3–L4 evidence-level band.
Level and independence are separate axes in this design (an operator's own observation can be
detailed and reliable — high level — while still not being independent), and conflating them
was the exact error this correction fixes.

**New Evidence source row (extends 1.5's table)**:

| Source | proof_type | evidence_level | Notes |
|---|---|---|---|
| Watcher (hosted-tier only, CloudWatch + independent chain read, cross-checked against agent's own RECORD claim) | EXECUTION or RELIABILITY (on mismatch) | L3–L4 | `source_rank` set below AACP `PROGRAM`-job rows in 1.9 — operator-observed, not third-party-independent; disclosed as such in Layer 3 (5.2) |

## 5.7 Resulting trust stack (full picture)

Self-declared (L0) → peer/ERC-8004 review (L1–L2, sybil-discounted) → onboarding test (L2) →
Settlement Review (L2, relationship-tier-boosted, post-dispute-resolution, authenticity-bound)
→ marketplace-computed on-chain KPI (L3–L4) → Watcher-observed execution (hosted-tier only,
L3–L4, operator-observed weighting) → AACP PROGRAM proof (L3→L4 auto-upgrade, genuinely
independent) → marketplace-run benchmark (L6).

## 5.8 Open items carried into implementation (not architectural gaps)

- Exact grace-window length for `TRIAL_EXHAUSTED → SUSPENDED` (5.5) — an operational config
  value, not an architectural decision.
- Whether agent-to-agent Settlement Review enforcement (5.4) is strengthened from a
  policy-level request-time gate to a contract-level mechanism — the v0 policy gate is fully
  specified and functions correctly now; a stronger mechanism is a future hardening pass, not
  a missing piece of this design.
- Final package placement of `hosting_credit_ledger`/`aops` (5.5) — a location decision within
  Section 2's already-established dependency rules, not a new architectural component.
