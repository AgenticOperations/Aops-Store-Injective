# Discovery & Proof Engine — External Review Synthesis

**Status: discussion / findings doc — not a finalized numbered section.** Nothing here is decided architecture yet. This exists so both of us can review the same analysis before we commit anything to Sections 1–5 or write new sections.

**Source material:** `2026-08-23-external-ai-research-deep-dive.md` in this same folder — two independent strategic reviews (ChatGPT deep research, Gemini) that [user] ran outside this repo, feeding in our existing docs. Full transcripts there; this doc is Claude's synthesis against our actual Sections 1–5.

---

## 1. Overall verdict

Both external reviews converge on one real finding: **we designed a trust engine and forgot to design discovery.** Sections 1–5 have a rich Evidence/Performance/trust-tier system and a rich buyer-facing trust UI *for an agent you're already looking at* — but nothing about how a buyer finds that agent in the first place. That's the one gap worth calling structural, not cosmetic.

Past that, both documents overreach in how they frame the fix — presenting it as "reorganize the whole architecture around a new paradigm" (three products, ProofGraph, Claim Registry) rather than "add the missing piece and extend a few fields." Most of what's genuinely valuable in both is **additive** — small, cheap extensions to fields/formulas we already built and already self-audited — not a rewrite. Recommendation: keep Sections 1–5 as the foundation, do not discard or restructure them.

---

## 2. What's already right (validated, not news)

Both reviews spend a lot of words rediscovering decisions we'd already made. Worth stating plainly so we don't second-guess these:

| Decision | Where | External validation |
|---|---|---|
| Reviews bound to `job_id`/`authorization_id` | Section 5 correction 7 | ChatGPT's "Interaction Receipt" requirement — exact match |
| Version-hash trust boundary | Section 1.1 | ChatGPT's "version binding" requirement — exact match, called out as unusually strong |
| Time decay in scoring | Section 1.9 `recency_decay` | ChatGPT's "freshness" requirement — exact match |
| Downgrade-not-delete suspicious evidence | Section 1.10 | ChatGPT's Sybil-handling recommendation — exact match |
| AACP labeled L3 not L4 (`realGroth16: false`) | Section 1.5/1.8 | ChatGPT's "don't oversell AACP" point — we got there first, from primary-source verification |
| Watcher labeled operator-observed, not independent | Section 5.6 correction 9 | ChatGPT's point on Watcher framing — we caught this ourselves in the prior session's self-audit, independently |
| Economic-relationship-tier as anti-Sybil weight | Section 1.9, 1.7 staking | ChatGPT's "economic stake as credibility" point |

No action needed on any of these — they're confidence, not gaps.

---

## 3. The real gap: Discovery has no design

Neither Sections 1–5 nor any prior design pass defines how a buyer's raw intent becomes a ranked, explained list of candidate agents. We designed the trust engine assuming a buyer already has an Agent Detail page open. This needs its own section (proposed: **Section 6 — Discovery Engine**) before build phasing, since phasing needs to know it exists.

**Important correction from this session's discussion:** the recommendation/ranking layer must be a real deterministic engine, not a thin LLM wrapper. The LLM's only job is turning free text into a structured query — everything downstream is algorithmic:

- **Structured query representation**, independent of input path (typed sentence, filter UI, category browse, agent-to-agent API call) — intent-parsing is one of several ways to produce this, not the engine itself.
- **A real ranking function** with named, tunable weights: capability-match × risk-fit × trust-and-evidence-strength × outcome-quality × price-value × availability. Not embedding similarity search, not a single blended trust score.
- **A feedback loop** — hires, outcomes, and reviews feed back into ranking signal over time (view → hire → outcome → review → re-rank), so ranking quality compounds as the marketplace runs.
- **Explanation generation** bound to the same weights that produced the rank — not decorative.

This is real algorithmic surface area, distinct from Discovery (query/retrieval) — treated as its own engine (Ranking/Recommendation Engine) in the service inventory below.

---

## 4. Cheap, high-value additions — extend existing sections, don't replace them

| Addition | Attaches to | Why |
|---|---|---|
| `outcome_status` enum on Evidence (SUCCESS/FAILURE/TIMEOUT/PARTIAL/POLICY_REJECTED/UNAUTHORIZED_ATTEMPT) | Section 1.5 | One field. Turns "97% success" into a real failure ledger instead of hiding failure modes. |
| **Diversity term** in the scoring formula — discount weight when many Evidence rows share a counterparty/wallet-cluster | Section 1.9 | One multiplier, using data 1.10 already computes. The one genuinely good idea from ChatGPT's "ProofGraph" proposal worth taking without taking the whole graph rearchitecture. |
| **Policy Compliance Rate** — actions-within-policy vs. blocked vs. unauthorized-attempt, rolled up per agent | Section 1.5/1.9 (`payload.permissions-used` already logs this) | Rollup metric only, no new capture needed. Strongest genuinely-novel differentiator in either review, and close to free because Altana's on-chain permissions already give us data no generic agent marketplace has. |
| **Structured review dimensions** (task-completed / quality / speed / value / permissions-followed / would-hire-again) instead of one star rating | Section 5.4 Settlement Review | Schema addition to the review payload, not a new pipeline. |
| **Auto-drafted review from evidence facts**, buyer confirms/edits | Hiring flow, Section 5.3 | UI behavior only — the facts already exist in Evidence by review time. |
| **Simulate / Preview button** — run the DECIDE step against current or hypothetical state, show the would-be action, no ACT/RECORD | Section 4.2 | Nearly free: DECIDE is already a pure function specifically so this is possible. Best example of prior architecture paying for itself. |
| **Evidence Vector display** (Capability/Execution/Outcome/Safety/Independence/Freshness shown separately) instead of one blended number | Section 5.2 Layer 1/3 | Display-layer change only — internal scoring stays one formula for ranking; UI stops collapsing it. |
| **"Verified by us" vs. "Discovered via 8004scan"** provenance label | Section 5.2 Layer 3 | Label only, using data we already have (source of Listing creation). |
| **Category-templated Claims tag** — each Listing gets a small fixed claims list per category (e.g. health-factor: "monitors HF," "can repay," "can add collateral," "cannot withdraw principal"); Evidence rows get a `claim_ids[]` tag | New, lightweight | The one part of "invent a Claim Registry" worth taking — tag, not a schema rearchitecture. See §5. |

---

## 5. Where we're pushing back — explicit scope risk for a hackathon timeline

Both reviews propose research-grade ideas that are bigger lifts than presented. Not building these now:

- **Full Claim Registry / ProofGraph schema rearchitecture** (every Evidence row FK's to a Claim entity, five-axis Assurance formula replacing 1.9 entirely) — elegant, but obsoletes work already built and self-audited across sessions, for a rewrite with real risk of not finishing. The `claim_ids[]` tag above gets most of the credibility/UX value at a fraction of the cost, additively.
- **Full adversarial capability-test taxonomy** (known-positive/negative/boundary/adversarial/regression/randomized/replay — 7 categories) — real value, too much alongside building 4 real agents + discovery + marketplace UI. Scoping to 2–3 cheap adversarial cases per category into the existing onboarding test instead.
- **Collusion graph as a separate system** — Section 1.10's Sybil-suspicion score (wallet-cluster proximity, timing-burst detection, reciprocal-pair detection) already is a lightweight version of this. Not building a second system.
- **8 separate stored evidence axes** (source/independence/groundedness/reproducibility/integrity/freshness/economic_relevance/scope) — most are already derivable from fields we have. Adding exactly one new field — `groundedness` (does this row tie to a real `job_id`/`tx_hash`, y/n) — since that's the single field the cited empirical ERC-8004 study found most predictive of fake reputation. Skipping the rest as redundant.
- **Discovery engine with a learned "recommendations" module** — both reviews mostly agree this is post-v0 too. Ranking is a deterministic weighted formula for v0, not ML — noting explicitly so we don't scope-creep into it later.

**Sequencing note, not a scope cut:** one review argues to deprioritize marketplace-hosted execution (`aops`, Section 5.5) for the hackathon build order — not to delete it. The design is sound and already written; the correction is build-order (discovery + evidence + four agents first, hosting after), not "don't build it."

**Unverified claim flagged, not adopted as fact:** Gemini's partner-track prize figures ($30k main track, 50,000 XP Altana, $6,000 TermiX, 1,000 CAKE PancakeSwap) are stated without a primary source in that transcript — treat as unconfirmed until checked against `docs/bnb-hackathon/research-findings.md` or the event's own materials.

---

## 6. Full service/engine inventory

Organized by dependency (matches the plain-language component inventory shared earlier this session, now filled out against the external review + this session's discussion). ✓ = already named/designed in some form; everything else is a genuine gap surfaced this session.

**Core transactional spine**
1. **Listing Service** ✓ — agent registration, listing lifecycle state machine, category taxonomy, ownership verification.
2. **Discovery Service** ✓ — query intake (NL, filters, category browse, API), retrieval.
3. **Recommendation / Ranking Engine** — *new, split out from Discovery deliberately.* Discovery answers "does this exist and match"; Ranking answers "which matches should be shown first, and why" — a deterministic weighted-scoring engine with a feedback loop (§3 above), not an LLM wrapper.
4. **Hiring & Job Service** ✓ — hire flow, job/authorization lifecycle, session creation.
5. **Proof Engine** ✓ — capability verification, onboarding tests, benchmark suite, claims.
6. **Job Evidence / Reputation-Authenticity Engine** ✓ — evidence collection, scoring, trust tiers, reviews.
7. **Payment & Autonomous Execution Engine** ✓ — Altana session custody, x402/CCTP, the agent's own READ/DECIDE/ACT/RECORD loop.

**Trust & risk — distinct operational concerns currently folded into #5/#6 conceptually**
8. **Risk & Permission Engine** — the policy boundary itself (spend caps, contract allowlists, session expiry) *enforced at execution time*, distinct from evidence *about* permissions. Makes "cannot withdraw principal" a provable claim rather than a marketing sentence.
9. **Fraud / Sybil Detection Engine** — always-on background process scanning wallet clusters, review timing, reciprocal-review patterns. Section 1.10 has the scoring formula; missing as a running service.
10. **Dispute Resolution Engine** — job disputes, refund/escrow release, arbitration path. Implicit in Settlement Review, no owning service yet.
11. **Compliance / Moderation Engine** — abuse reports, delisting bad actors, ToS enforcement, admin review queue. With an ingestion pipeline pulling from 8004scan's much larger agent population, bad listings are a certainty; nothing currently handles this.

**Growth & supply — the cold-start machinery**
12. **Ingestion & Recruitment Engine** — 8004scan crawler, liveness filter, invite-to-claim pipeline. Distinct from Listing Service: Listing *manages* state, Ingestion *proposes* new candidates into that state machine.
13. **Agent API / A2A-MCP Interface** — machine-facing surface (`/search`, `/agents/{id}`, `/quote`, `/hire`) for other agents (TermiX, agent-to-agent hiring). Auth/rate-limited surface, not Discovery with a JSON content-type — directly what TermiX and BNB interoperability criteria are judging.

**Comparison & decision support — event-critical, currently undesigned**
14. **Comparison Engine** — side-by-side agent comparison (capability/trust/cost/permissions/outcome), feeds the "Agent Advantage Report" TermiX requires.
15. **Simulation / Preview Engine** — run an agent's DECIDE step against real or hypothetical state, no capital committed. Cheap given Section 4's pure-DECIDE design, but a distinct service surface.

**Money, separated by who's moving what**
16. **Billing / Metering Service** — marketplace-side money: hosting credits (`aops`), transaction fees if any. Distinct from #7 (the agent's own trading capital) — different custody models entirely.
17. **Settlement / Escrow Service** — buyer payment held against job completion + dispute window, released/refunded based on Dispute Resolution's outcome. Own state machine (HELD → RELEASED/REFUNDED/DISPUTED).

**Operational backbone**
18. **Watcher / Observability Engine** ✓ (Section 5.6) — production telemetry, on-chain cross-referencing.
19. **Notification / Alerting Service** — job completion, HF-drop alerts, agent failure, dispute opened, billing near-exhaustion. Undesigned anywhere; with autonomous background agents acting for a buyer, silence is a trust failure.
20. **Event Bus** — internal spine wiring the above together (job completed → evidence created → ranking recalculated → notification fired). Infra, not a product surface, but needs to exist explicitly.

**Front-of-house surfaces (not services, but distinct product surfaces judges will click through)**
- Buyer app: Home/Discovery, Search Results, Agent Detail/Proof Card, Compare, Simulate, Hire, Active Agents dashboard, Job Timeline, Review.
- **Builder Console** — register/verify an agent, view analytics and earnings, respond to disputes. Currently zero design; this is the seller side of the marketplace, and BNB will expect third-party builders to onboard, not just consume our four agents.
- Admin surface — moderation queue, dispute arbitration, category/claim-template management.
- Public Agent API docs — the machine-facing contract for #13.

**The three flagged as most load-bearing and currently completely undesigned** (not just under-specified): **Ranking Engine (#3)** with its feedback loop, **Builder Console**, and **Ingestion & Recruitment Engine (#12)**. These turn this from "a UI in front of four agents" into an actual two-sided marketplace with supply, growth, and discovery — which is what's actually being judged.

---

## 7. Open question for next session

Order of drafting: Discovery/Ranking Engine as Section 6 first (biggest gap), or the cheap Section 1/5 additions (§4) first as a fast revision pass? Not yet decided — pending discussion.
