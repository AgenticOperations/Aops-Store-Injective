# Proof Engine — Working Design (Unverified)

Author: Ryuk (+ AI session). Drop-zone doc per this folder's README — not cross-checked against
`docs/architecture/` as a whole, not binding, not yet reconciled with anything KC is doing on
the other engines. Consolidates a full brainstorm session, including the parts of it that were
already decided and the parts still explicitly open.

**Status**: proof-of-concept level design. Two of the four hackathon agents' worth of grading
logic and the sandbox-compatibility build requirement are explicitly assigned to KC, not solved
here — see §9.

---

## 1. What this document answers

How does an agent's trust in this marketplace actually get built, shown, and kept honest — from
before it ever registers, through hiring, through everything it does after? This is the
consolidated design for the "Proof Engine" — the second half of the Supply/Proof split from
KC's engine map (E3-E7 roughly, plus the score/weighting logic in E6).

## 2. The core framing

Simple black-box shape, stated early in this brainstorm and still the right mental model:

```
data inputs (evidence) --> [ proof engine ] --> trust + evidence history (per agent)
```

The engine's job is not to output a bare number ("9/10"). It's to output a **drillable,
transparent history** — every score, why it's what it is, when it changed, and what caused the
change — structured well enough that a human *or* an AI reviewing on the buyer's behalf can
actually parse it. This is the "Know Your Agent" (KYA) principle: a Trust Card per agent, never
a number alone.

Encouragingly, a chunk of the presentation layer for this already exists in
`docs/architecture/05-buyer-trust-hiring-hosting.md` §5.2 — a four-layer buyer-facing UI (agent
card, evidence timeline with payload redaction, methodology transparency with explicit
source-of-truth labeling like "observed by marketplace operator" vs "independently verified",
and a category-scoped comparison view). It's architecture-only, not yet promoted or explicitly
confirmed against the KYA framing above, but it's not a blank page.

## 3. Two convergence points

The proof engine has to account for evidence from two different moments in an agent's life,
which was flagged early as the structural spine of the whole thing:

1. **Pre-marketplace history** — an agent that already existed and operated somewhere before it
   ever registered here. What of that prior track record can we actually pull in, and at what
   trust weight, given we never had visibility into it as it happened?
2. **Post-hire evidence** — everything the marketplace can observe, gather, or receive after the
   agent is hired through us: on-chain outcomes, AACP job records, reviews/feedback, sandbox
   results, watcher observations.

Nothing in this doc resolves #1 concretely yet beyond what ERC-8004 registry/reputation pulls
already provide (`03`§3.1) — that stays an open thread, not urgent for the hackathon's four
mandated agents specifically since those start with no prior history by construction.

## 4. The two-plane distinction (new this session, load-bearing)

Agents split into two classes for evidencing purposes, and conflating them is a real design
trap:

- **Payment-after-execution agents**: money moves only *after* the job is judged complete. For
  these, a log-submission-gates-escrow-release mechanism is viable — the agent submits its
  execution logs/output, the marketplace (or an evaluator) reviews before releasing escrow. This
  evidence should be weighted low (self-reported, not independently computed — roughly L1-L2),
  but it's a legitimate mechanism for this class.
- **Runtime-financial agents**: the agent moves real funds *during* execution — this is all four
  of the hackathon's mandated categories (rebalancing, grid trading, yield optimization,
  health-factor monitoring). For this class, log-submission doesn't work, because the fund
  movement itself *is* the execution — there's no "after" to gate. The only real proof mechanism
  for this class is independently measuring the actual on-chain outcome (E5) and/or testing the
  agent under controlled, adversarial conditions before real money is ever at stake (the
  sandbox).

**Practical consequence**: log-submission-gates-escrow-release is explicitly **out of scope**
for the four hackathon agents — not because it's a bad idea, but because it doesn't apply to
this class. It stays a real, undesigned idea for future categories that do settle
payment-after-execution (deferred, §8).

## 5. Evidence sources — current state, decided vs open

### 5.1 Low trust — solid, no open items
Ownership + live endpoint + registry pull (`01`§2-4). Fully mechanized, zero agent cooperation
required. Nothing to design here.

### 5.2 Sandbox (Medium trust) — decided this session
- **Compulsory floor stays Low; sandbox stays optional** (`01`§5) — an agent that skips it is
  simply Low trust, not blocked from listing or hiring. This was previously decided, re-confirmed
  this session, not new.
- **Decision (2026-08-25): the sandbox becomes the primary point of ingestion/proof for the four
  mandated agents**, ahead of AACP. Rationale: AACP evidence is capped at L3 (§5.4 below) and is
  a panel vote, not an independent computation — the sandbox (Anvil fork, actively perturbed,
  graded on outcome, per `01`§6) is the mechanism we actually control end-to-end and can make
  rigorous. AACP stays a real evidence source, just not the lead one.
- **Decision (2026-08-25): sandbox-compatibility is a build requirement for our own four
  agents**, not an afterthought bolted on after they're built. Concretely: every one of the four
  agents must correctly execute under a marketplace-granted session in `mode: simulate` — accept
  the RPC/chain target it's handed, act on it exactly as it would for a real job, with zero
  test-aware branching. This needs to be designed into each agent from the start, not verified
  after the fact. **Assigned to KC** — see §9.
- **Still open, not resolved by this doc**: fork-provisioning mechanics (lifecycle, concurrency,
  cost), and the per-category grading thresholds. The threshold piece is explicitly KC's to
  define per §9, since KC is building the agents and is closest to what "correct" looks like per
  category. Fork-provisioning infra mechanics remain unassigned.

### 5.3 On-chain KPI measurement (E5) — ownership decided, content open
**Decision (2026-08-25): the grading logic for E5 (what counts as a good on-chain outcome per
category) is KC's to define**, not something to spec abstractly in advance. Rationale: KC is
building the four agents and is the person who actually knows what "correct execution" looks
like for each category — the grading rule should come from the builder, not be imposed
top-down before a single agent exists. Assigned to KC, tracked in `HANDOFF_KC.md`.

Still needed regardless of who defines it: the LISTINGS→E5 wiring itself (the missing input edge
identified in the diagram review, `docs/architecture/findings/` or equivalent) — that's a data-
plumbing task, separate from the grading content, and doesn't have an owner yet either.

### 5.4 AACP (High trust) — decided this session
**Decision (2026-08-25): AACP evidence stays capped at L3, permanently.** The `realGroth16`
feature flag in `03`'s design (meant to auto-upgrade AACP evidence L3→L4) does not correspond to
anything AACP actually provides — five AACP primary-source doc pages checked this session
(`overview`, `disputes`, `orders`, `roles`, `contract-reference`) contain zero mentions of TEE,
zkVM, Groth16, or any cryptographic proof layer. AACP's actual verification mechanism is a
3-evaluator panel majority vote on a submitted deliverable hash plus uploaded evidence artifacts
— a consensus mechanism, not an attestation mechanism. L3 is the honest ceiling for what that
actually proves. `03`'s `realGroth16` flag should be treated as dead/removed rather than a live
upgrade path, pending someone actually building a proof layer of our own on top of AACP (not
scoped here).

This is fine, not a blocker — see §5.2's ingestion-priority decision: the sandbox, not AACP, is
meant to be the primary trust-building mechanism for the four mandated agents. AACP is
supplementary evidence, honestly weighted.

### 5.5 Deferred — no mechanism designed
- **Log-submission-gates-escrow-release** — real idea, not applicable to the four mandated
  agents (§4), deferred to whenever a payment-after-execution category exists.
- **Connected-cloud-account** (agent owner delegates read-only CloudWatch/equivalent access
  from their own hosting account) — named, zero mechanism, zero data model, zero scope decision.
  Genuinely useful for the "agent hosted on AWS Bedrock" access-boundary problem raised early in
  this brainstorm, but not designed.
- **Immutability / on-chain attestation of sealed scores** — the idea that once a score is
  computed, it could be hashed and attested on-chain so it can't be silently altered after the
  fact. No mention anywhere in any architecture doc. Zero spec. Worth a future pass once the
  scoring pipeline itself is real — attesting a score that doesn't exist yet has nothing to
  attest.
- **TEE-based verification, built by us** — confirmed this session that AACP itself isn't
  TEE-based, so this isn't "duplicating AACP" if we ever build it. Still a substantial
  engineering lift, explicitly not in scope for the hackathon. Named as a differentiation
  candidate for later, not designed.

## 6. Competitive differentiation — findings, with confidence caveats

- **ERC-8004's own Validation Registry** (primary-source verified via direct fetch of
  `eips.ethereum.org/EIPS/eip-8004`): the agent owner directly picks which validator address
  gets asked to validate their own job, with no independence mechanism in the standard itself —
  "This function MUST be called by the owner or operator of agentId." Trivially self-dealing-able
  by design. Our AACP-based, protocol-controlled Evaluator assignment (confirmed via absence of
  a `client-set-evaluator` skill in `termix-agent-skills`, `03` Audit Note 4) is already stronger
  than raw ERC-8004 usage on this specific point — a real, citable differentiator.
- **AltLayer / agent.family**: secondary-source only (a Medium blog post, not AltLayer's own
  docs) — reportedly a 7-dimension reputation score mapped to trust levels 0-5, used as a pricing
  modifier. Mechanics behind each dimension (independently verified vs self-reported) unconfirmed
  — don't treat this as verified.
- **Coinbase x402 Bazaar / Agentic.Market**: secondary-source only — described as a discovery
  layer with generic "identity verification, periodic reviews, de-listing policies." Appears
  thin relative to what we're building; not independently confirmed.
- **Academic paper (arXiv "AgentReputation," 2605.00073)**: independently validates two design
  choices already in our docs — context-conditioned reputation cards preventing cross-domain
  score conflation (matches `05`§5.2 Layer 4's category-scoping) and a three-layer separation of
  task-execution / reputation-service / tamper-proof persistence (roughly matches our
  Evidence/Performance/re-derivability split).

## 7. Devil's-advocate readiness snapshot (as of 2026-08-25)

Not a repeat of the full audit — the short version, for anyone picking this doc up cold:

- **Solid, no gap**: Low trust ladder; on-chain contract addresses (PancakeSwap, Venus) for E5.
- **Right concept, real mechanism still missing**: sandbox fork-provisioning mechanics;
  per-category grading thresholds (both sandbox and E5) — now explicitly KC's to define, per §9.
- **Previously overstated, now corrected**: AACP is a panel vote, not cryptographic attestation
  — capped at L3 by decision (§5.4), not by a still-open question.
- **Nothing implemented yet, anywhere**: the whole AACP pipeline, the whole sandbox, in this
  repo, is 100% design — `PRODUCT-STATE.md` confirms "no implementation has started." Treat any
  "built and tested" language elsewhere in `docs/architecture/03` as unverified until code
  actually exists.
- **Not designed at all**: log-submission mechanism (deferred, out of scope), connected-cloud-
  account, immutability/attestation, our-own-TEE.

## 8. Decisions log — 2026-08-25 session

1. E5 grading logic (per-category on-chain quality thresholds) — **owned by KC**.
2. Sandbox-compatibility (works correctly under a `mode: simulate` scoped session, zero
   test-aware branching) — **build requirement for all four agents, owned by KC**.
3. AACP evidence — **stays capped at L3 permanently**; `realGroth16` L3→L4 path treated as dead
   pending a real proof layer, not currently planned.
4. Sandbox — **primary ingestion/proof point** for the four mandated agents, ahead of AACP.
5. Third-party compatibility standard (publishable skill-doc for e.g. BNB Agent Studio builders)
   — **sequenced after** our own four agents prove the sandbox+AACP mechanism actually works.
   Not written yet; deliberately deferred, not an oversight.

## 9. Open items — who owns what

| Item | Owner | Notes |
|---|---|---|
| E5 per-category grading logic | KC | Comes from the agent builder, not specified top-down |
| Sandbox-compatibility build requirement | KC | Design into all four agents from the start, not bolted on after |
| Sandbox fork-provisioning mechanics (lifecycle, concurrency, cost) | Unassigned | Infra question, separate from grading content |
| LISTINGS→E5 wiring (data plumbing) | Unassigned | Separate task from the grading logic itself |
| Third-party compatibility standard/skill-doc | Deferred | Only after our own four agents prove the mechanism |
| Log-submission-gates-escrow-release | Deferred | Not applicable to the four mandated agents |
| Connected-cloud-account | Deferred | No mechanism designed |
| Immutability / on-chain score attestation | Deferred | No mechanism designed |
| Own TEE-based verification | Deferred | Named as future differentiator only |

## 10. Next step

Once this is stable and reconciled with whatever KC lands on for the four agents' sandbox
compatibility and E5 grading rules, move to the **Discovery Engine** (E8-E10) — per the agreed
build order, Discovery is the last unbuilt component and depends on everything above being
settled first.
