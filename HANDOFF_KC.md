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

## 2026-08-25 — Discovery Engine + PEAGASIS drafted; a real conflict with your E9 stance, needs your call

Ryuk's session wrote three docs this round, all in `docs/unverified-ideas-and-flows/`,
unverified/exploratory tier:

1. `2026-08-25-discovery-engine-ryuk.md` — full E8/E9/E10 design. **Deterministic weighted
   ranking**, matching `architecture/00`'s `discovery/` package contract ("Deterministic")
   and independently matching what you wrote the same day in
   `2026-08-25-marketplace-engine-decomposition-kc.md`. E10 Simulate was redesigned mid-session
   away from a per-buyer Anvil-fork preview (flagged as an unbounded, buyer-traffic-scaling
   infra cost that duplicates the sandbox's purpose) to reading the buyer's real position and
   feeding it into the agent's actual `DECIDE` function — no forking needed. This also
   independently converges with your own E10 description ("a preview of what an agent *would*
   decide, before any wallet is connected") — good sign the two designs agree here.
2. `2026-08-25-peagasis-concierge-ryuk.md` — verbatim capture of a conversational-concierge
   spec (PEAGASIS = "Personalised Agentic Service Infra for the Site"): multi-turn
   clarification, trust/evidence translation into plain language, 1-click Altana session
   construction in a chat drawer. Raw capture, kept as-provided per the folder's own
   don't-edit-others'-content rule, with a reconciliation note attached (stale
   Basic/Verified/Proven/Institutional tier naming in the worked example; stale
   `chain-adapters/*` paths that don't exist in the real package tree — should be
   `agent-registry/` and `custody/`).
3. `2026-08-25-peagasis-discovery-engine-v2-ryuk.md` — **this is the one that needs your
   input.** On direct, explicit, repeated instruction this session, PEAGASIS's ranking was
   redesigned around **semantic/vector search + LLM-driven, dynamic ranking**, specifically
   *not* the deterministic formula — full NLP support chat, not just a query parser in front
   of a fixed formula. Retrieval-grounded (LLM only ranks over real `LISTINGS`/`EVIDENCE` rows
   pulled by vector search, never invents an agent or a trust tier), but the ranking mechanism
   itself is now non-deterministic by design.

**This directly contradicts what you wrote the same day.** Your decomposition doc says, of E9:
"a deterministic weighted formula. **Not** embedding similarity. **Not** a learned
recommender — that is post-hackathon, recorded here so it does not get scope-crept back in."
`architecture/00-repo-architecture-and-agent-conventions.md` Part 2.1 says the same thing about
the `discovery/` package itself ("Deterministic"). Ryuk's v2 doc is the one design in the repo
that disagrees with both of you.

**Not resolved here — flagged for a direct conversation between you two.** Per
`unverified-ideas-and-flows/README.md`'s own rules, a contradiction sitting in that folder
isn't a blocker; it's pushed as-is with the conflict stated in-document (v2's §0), not silently
smoothed over. But it's a real product decision, not a technicality, and it shouldn't get
implemented either direction until you and Ryuk agree. See v2 doc §0 and §4 for the reasoning
on both sides (retrieval-grounding as the safety net if semantic ranking is kept; cost/latency/
non-determinism/prompt-injection risks named explicitly either way).

---
