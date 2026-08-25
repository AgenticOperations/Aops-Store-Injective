# Handoff Log — KC

Append-only. Each agent session adds a new entry below at session close — what was done,
what's still open, anything the next session needs to know. Never edit or delete prior
entries; correct forward with a new entry if something above turns out wrong.

> Created 2026-08-24 alongside `HANDOFF_RYUK.md`, when the two-collaborator (Ryuk/KC)
> workflow was formalized. See `CLAUDE.md` for which file a session appends to.

---

## 2026-08-24 — Handoff note left by Ryuk's session, for whoever/whatever works next on KC's side

Read `CLAUDE.md` and `PRODUCT-STATE.md` first if you haven't — this note assumes both.

**Before building anything new: verify what's already marked done, don't just trust the
label.** `docs/final-review-docs/01-ingestion-and-registration-of-agents.md` (Ingestion &
registration, the DISCOVERED→LIVE ladder, Low/Medium/High trust tiers) and
`docs/final-review-docs/02-fraud-sybil-detection.md` (sybil signal mechanics, self-dealing
guard extension, sandbox rate-limit) were both written and reconciled against
`docs/architecture/` this session, each audited directly against primary sources (not asserted
from memory — see `HANDOFF_RYUK.md`'s matching entry for exactly what was checked and fixed).
Re-verify them yourself before treating them as bedrock — that's the standing rigor bar in
`CLAUDE.md`, not a one-time pass.

**Then, in order:**

1. **Category-agent execution architecture** (`docs/architecture/04-category-agent-execution-
   architecture.md` + `04b-category-agent-strategy-models.md`) — promote to
   `docs/final-review-docs/`. This is the actual mechanics of the four mandated categories
   (rebalancing, grid trading, yield optimization, health-factor monitoring) — the core
   hackathon deliverable. While you're in there: `04` currently has a false citation (claims
   Venus's `≥1.30`/`≥1.40` recovery thresholds are "confirmed in Section 3" — they aren't,
   verified via direct grep; only `04b`'s citation of `venus-agent-skills` has them) — fix the
   attribution when you promote it, don't carry the error forward.
2. **Formalize execution, hiring-job, and proof/evidence work** — `docs/architecture/03-
   evidence-trust-engine-pipeline.md` and `05-buyer-trust-hiring-hosting.md` are the relevant
   source material; they're content-accurate but still carry stale package-path naming
   (`apps/worker`, `chain-adapters/aacp`) against Section 0's ring architecture — see
   `docs/final-review-docs/README.md`'s "not yet reconciled" list for exactly which sections.
3. **Resolve the two open decisions in `01` §12** — where `commercial_config` (position/tx/
   slippage limits, auto-pause threshold) fits now that `COMMERCIAL_VERIFIED`/`RISK_REVIEW`/
   `APPROVED` are gone, and whether/how the TermiX L6 benchmark re-enters as a named High-trust
   evidence source. These need an actual decision, not more architecture — flag back to Ryuk/KC
   directly if it's a product call rather than a technical one.

**Do not start Builder Console yet.** It was explicitly deferred this session — it's a UI over
flows (the Medium-trust sandbox trigger, the High-trust job flow) that are mechanically
specified in `01` §6-7 but have no console-facing interaction model defined, and it's blocked
by the two open decisions in item 3 above. Build it once the flows it exposes, and those
decisions, are real — not before.

**The end goal**: get everything above finalized enough that the **Discovery Engine is the
last unbuilt component**, with every one of its dependencies — especially the proof/evidence
engine — ready end-to-end before it's started.

---

## 2026-08-25 — Proof Engine work, two items assigned to KC

Ryuk's session worked the Proof Engine this round (full write-up:
`docs/unverified-ideas-and-flows/2026-08-25-proof-engine-ryuk.md` — unverified/exploratory,
not yet reconciled against `docs/architecture/`, per the repo's split of labor: KC owns
connecting/syncing E1-E16, Ryuk+AI own Discovery+Proof content). Two concrete items came out of
it that are yours specifically, since they depend on the actual agents you're building — not
something we can spec top-down without you:

1. **E5 per-category grading logic.** The on-chain KPI pipeline (`03`§3.4) can read real chain
   state for each category (PancakeSwap/Venus addresses already confirmed), but has no rule yet
   for what counts as a *good* outcome — e.g. how close to the target split counts as a pass for
   the rebalancer, what recovery threshold/timing counts as good for the health-factor monitor,
   what counts as a clean fill vs a miss for the grid trader, what margin gap justifies a move
   for the yield optimizer. **This needs to come from you**, since you're building the agents and
   know what "correct" actually looks like per category — please define it as you frame each
   agent, don't treat it as separable from the build.
2. **Sandbox-compatibility is a build requirement, not a post-hoc check.** Every one of the four
   agents needs to correctly execute under a marketplace-granted session running in
   `mode: simulate` (Anvil fork of BSC mainnet, `01`§6) — accepting whatever RPC/chain target the
   session hands it and acting on it exactly as it would for a real job, with zero test-aware
   branching. Design this in from the start of each agent, not bolted on after. Sandbox trust
   stays optional/non-blocking for third-party agents generally (`01`§5 unchanged), but for our
   own four it's a build requirement since the sandbox is now the primary proof mechanism (see
   next point).

**Also decided this session, so you have the context**: AACP evidence stays capped at L3
permanently (it's a 3-evaluator panel vote, not a cryptographic proof — confirmed against five
AACP primary-source doc pages, nothing TEE/zkVM/Groth16-based exists in AACP itself). Because of
that, **the sandbox — not AACP — is meant to be the primary point of ingestion/proof** for the
four mandated agents. AACP stays real supplementary evidence, just not the lead mechanism. Full
reasoning in the linked doc's §5.

---
