---
created: 2026-08-24
project: BUILD-BNB — BNB "Build the Era" marketplace
status: synthesized from chat design work, ready for review before Discovery/Proof engine
  build starts. Per this repo's CLAUDE.md, this is the canonical source of truth for the
  DISCOVERED → LIVE ladder and trust-tier system — `docs/architecture/01-data-model-
  state-machines.md`'s corresponding sections and Decision 0002's Bug-1 fix are reconciled
  toward this file, not the reverse (both carry inline pointers back here as of 2026-08-24).
section: final-review 1 of N — Ingestion and Registration of Agents
depends_on: docs/architecture/00-repo-architecture-and-agent-conventions.md,
  docs/architecture/01-data-model-state-machines.md,
  docs/architecture/04-category-agent-execution-architecture.md,
  docs/architecture/04b-category-agent-strategy-models.md,
  docs/architecture/decisions/0001-agents-repo-separation.md,
  docs/architecture/decisions/0002-trust-ladder-bootstrap-and-version-continuity.md
---

# Ingestion and Registration of Agents

> Package names throughout this document are Section 0's current names
> (`agent-registry`, `census`, `domain`, `listings`, `evidence`, `scoring`, `discovery`,
> `custody`, `settlement`, `apps/{web,console,api,jobs,watch}`) — not
> `02-module-boundaries-repo-layout.md`'s superseded `core-domain` / `chain-adapters` /
> `apps/worker` names. If a future doc still uses the old names, it's stale.

## 1. What this document answers

How does an agent — ours or a stranger's — go from not existing on this marketplace to being
listed, trusted, and hireable? This covers the full path: how it's found or self-registers, how
we confirm who owns it, how we confirm it actually runs, how it earns trust beyond the bare
minimum, and what happens when it changes or breaks after going live.

Two constraints shaped every decision in this document, and are worth stating up front because
they explain why several mechanisms look the way they do:

- **We never have access to an agent's code.** Third-party agents are hosted on infrastructure
  we don't control. The only things we can ever observe are: its public `agentURI` manifest, its
  live endpoint(s), and whatever it does when actually invoked. Every verification mechanism
  below is designed to work within that limit — none of them require code access, and none of
  them require an agent operator to add code just to be listed.
- **Requiring code changes to list an agent is a real adoption barrier with no offsetting
  incentive**, and was explicitly rejected as a design direction mid-session (a mandatory
  `{"mode":"simulate"}` dry-run flag was proposed, then killed for this reason). Every mechanism
  here that involves an agent "being tested" reuses the exact same invocation contract a real
  hire already requires — zero special-case code, ever.

## 2. Entry — two provenances, one pipeline

An agent enters the system one of two ways. Past this point, there is no distinction — same
states, same guards, same gates.

- **Crawl path**: `agent-registry` (Ring 1) polls the ERC-8004 Identity Registry and 8004scan by
  delta, not full re-scan, respecting 8004scan's confirmed rate limit (500/min, 100k/day). A
  listing is created only on an exact category-taxonomy match (not fuzzy), one row per
  `agent_id`.
- **Self-registration path**: a builder submits directly via `apps/console`. Same row shape,
  provenance tagged, nothing downstream differs.

**Liveness is not a gate on row creation.** A crawled agent with a dead endpoint still gets a
`DISCOVERED` row — `census` (Ring 1) tracks liveness separately, and that flag controls only
whether the agent appears in the public **Unclaimed** directory (see §3), never whether the row
exists.

## 3. The Unclaimed directory — how we contact an owner we have no contact info for

Verified directly against the EIP-8004 spec text: there is no dedicated contact field in the
Agent Card or registration file. An agent *may* optionally list an email-type endpoint inside
`services[]`, but this is never guaranteed, so it cannot be relied on as the mechanism.

The resolved mechanism: a separate, clearly-labeled section of `apps/web` — not the real
marketplace, no hire button, excluded from `discovery`'s search and ranking — listing crawled
agents that have passed `census`'s liveness check but have not yet been claimed. Minimal
self-reported info, one action: **"Claim this agent."** This is the entire owner-discovery
mechanism — we don't chase owners, we make it trivial for an owner who finds their own agent
listed to prove it's theirs.

## 4. State ladder: DISCOVERED → LIVE

```
DISCOVERED ──► CLAIMED ──► OWNERSHIP_VERIFIED ──► ENDPOINT_VERIFIED ──► LIVE (Low trust)
                                                                            │
                                                                            ▼ (optional)
                                                                     Medium trust
                                                                            │
                                                                            ▼ (optional, requires Medium)
                                                                       High trust
```

### 4.1 DISCOVERED → CLAIMED

Owner (or the self-registering builder) proves control of the wallet that owns the on-chain
identity by signing **EIP-712 typed data** — not a raw message sign, specifically to prevent
replay. Two proof paths:

- Wallet signature, checked against the actual ERC-721 owner of record in the Identity Registry,
  for `erc8004_ref`-anchored agents.
- Domain TXT record, for Agent-Studio pending registrations that don't yet have an on-chain
  anchor.

Guard function lives in `domain` (Ring 0, pure, no I/O); orchestration lives in `listings`
(Ring 2). No race-condition handling is needed: multiple simultaneous claim attempts are
harmless because only a genuinely valid signature ever passes the next gate.

### 4.2 CLAIMED → OWNERSHIP_VERIFIED

The guard confirms the EIP-712 signature against the current on-chain owner, read via
`agent-registry`. This is the state that actually answers "whose agent is this" — everything
before it is just a claim.

### 4.3 OWNERSHIP_VERIFIED → ENDPOINT_VERIFIED

`census` (Ring 1) probes the **real endpoint(s)** listed in `services[]` — never the `agentURI`
manifest fetch itself. The manifest, often IPFS-pinned, proves nothing about whether the actual
service is running; only a live probe of the declared endpoint does. Per Section 0's 6.3
invariant, every response from this probe is treated as hostile input and validated at
`census`'s own boundary before anything downstream ever sees it.

### 4.4 ENDPOINT_VERIFIED → LIVE, at Low trust (compulsory)

At this point, everything **fact-based and observable without any agent cooperation** is done:
ownership is proven, the endpoint is live, and whatever ERC-8004 registry/reputation data exists
has been pulled. `listings` transitions the agent to `LIVE` at **Low trust**.

**This is the state that kills the original deadlock.** Nothing past this point is required for
an agent to be listed, discoverable, and hireable. An agent that has never done a single job for
a single buyer can be `LIVE` the same day it's claimed.

## 5. Trust tiers — a ranking signal, never an eligibility gate

This is the resolution to what was originally the "Verified tier is unreachable" bug: instead of
one blocking trust ladder an agent must climb before it can function, trust is three tiers, only
the first of which is required.

| Tier | What it requires | Compulsory? | What it affects |
|---|---|---|---|
| **Low** | Ownership + live endpoint + registry data (§4) | Yes — this is what `LIVE` means | Base listing, always hireable |
| **Medium** | Passes the marketplace's own sandbox test (§6) | No — owner opts in | Badge on Agent Card, `discovery` ranking boost |
| **High** | Medium, plus independently-evaluated real execution evidence (§7) | No — requires Medium first | Strongest badge, `discovery` ranking boost |

### 5.1 Hiring is never blocked by tier

A Low-trust agent is hireable for real money the moment it's `LIVE`. The two actual safety
mechanisms are unrelated to trust tier:

1. **The buyer's own stated minimum** (existing hiring gate, `01-data-model-state-machines.md`
   §1.3): a risk-averse buyer can set their own floor at Medium or High. A buyer who doesn't
   care can hire Low-trust agents. This is buyer preference, not a platform rule.
2. **Ring 3's simulate/broadcast default** (Section 0, Part 6.1, rules 1–2): every `custody` or
   `settlement` action — for *any* agent, at *any* tier — defaults to `mode: simulate` and
   testnet. Broadcasting to mainnet is "a deliberate, separate, reviewed promotion... never a
   config drift." This applies identically to a High-trust agent's hundredth real job and a
   Low-trust agent's first one.

Trust tier only ever changes how prominently an agent surfaces in `discovery` and what badge
shows on its card — never whether a hire can happen.

## 6. Earning Medium trust — the sandbox test

Owner-initiated, optional. Two stages; only the second one actually confers the badge.

### 6.1 Stage 0 — decision-only fast filter (opportunistic, when available)

If the agent's own public interface happens to expose a decide/plan-only call (some agent
frameworks separate "propose an action" from "execute" for their own human-in-the-loop safety,
independent of anything we require) — send it a scenario, get back a decision, grade it. Zero
funds, zero session, zero infrastructure.

**This can never be sufficient on its own to earn Medium.** A decision-only response costs the
agent operator nothing to fabricate — no gas, no contract call, no session, no code path
actually exercised. It only screens out agents that are obviously broken or nonsensical before
any infrastructure cost is spent on them.

### 6.2 Stage 1 — real action on a mainnet fork (required to earn the badge)

This is the corrected mechanism — an earlier version of this design used a public BSC Testnet,
which was wrong: public testnets have thin, often fake liquidity, so a slippage or execution
check against one proves very little.

The actual mechanism:

1. `apps/jobs` provisions an **Anvil fork of BSC mainnet at the current block**, via `custody` in
   `mode: simulate` (Section 0's default). Foundry/Anvil is already in this project's stack
   (`contracts/` in the package tree). A fork gives real, current PancakeSwap reserves, real
   current Venus APYs, real current collateral prices — completely faithful to the real world at
   that moment — but every transaction against it is local-only and consequence-free.
2. The fork is **actively perturbed** into an unambiguous, category-specific scenario before the
   agent acts — a passive snapshot alone doesn't reliably produce a testable condition:
   - Rebalancer: force a known-drifted wallet balance against the configured target split.
   - Grid trader: force the pool price across a configured, unfilled grid level.
   - Yield optimizer: force an engineered APY gap between two Venus markets, since waiting for
     organic APY drift isn't practical inside a bounded test window.
   - Health-factor monitor: force a collateral price drop past the confirmed danger line
     (`health < 1.15` — Section 3's Verification Addendum confirms this specific number;
     `04-category-agent-execution-architecture.md`'s further claim that the `≥1.30`/`≥1.40`
     recovery targets below are also "confirmed in Section 3" is inaccurate — those two
     numbers aren't in Section 3 at all, only in `04b`'s citation of `venus-agent-skills`
     directly. The two sets of numbers don't conflict — danger-trigger vs. recovery-target are
     different, compatible concepts — but the attribution in `04` is wrong and should be
     corrected there).
3. The agent is granted a session scoped to the fork — same shape as a real session, same
   invocation contract as a real hire. **Zero code changes required from the agent.** It acts
   exactly as it would for real money; it never needs to know the difference, and (per the
   session-controls-the-target-chain design already required for any agent to be paid here at
   all) it never needs any test-awareness logic of its own.
4. `census`/`apps/jobs` re-reads the resulting fork state and grades the **outcome**, not "did a
   transaction happen": did the rebalancer's post-trade ratio land inside tolerance; did the
   health-factor position clear back above the target line (`≥1.30`, `≥1.40` for volatile
   collateral) within its event-driven cadence; did the grid trader fill the exact level without
   double-filling; did the yield optimizer only move funds when the margin was genuinely
   exceeded.
5. Run as a **graduated series**, not one scenario — mild drift, severe drift, an edge case (e.g.
   near-zero balance, extreme volatility), not a single pass/fail shot.

On pass: a new `evidence` row is written (sandbox-class), and `scoring` computes Medium as
eligible.

### 6.3 The honest limit of this mechanism

Blind testing — the agent never being told it's a test — is achievable only up to a point, and
this document states that point plainly rather than implying the mechanism is airtight:

- **What works**: because any agent must already trust whatever RPC endpoint, chain ID, and
  contract addresses its granted session hands it (that's the whole point of the session-based
  authorization model — the marketplace controls the target, not the agent), a fork configured
  to report the real chain ID looks indistinguishable from mainnet to an agent that simply uses
  what it's given. No test flag, no special field, same job shape either way.
- **What doesn't**: a deliberately adversarial agent could cross-check against a second,
  independent RPC or a public block explorer and detect the fork. This cannot be fully closed —
  it's the same class of problem as sandbox detection in security research (or, as a real-world
  analogy, an emissions-testing defeat device). This is exactly why Medium is a low-confidence
  badge and never substitutes for §7 — gaming it buys an attacker very little, since it doesn't
  unlock real trust by itself.

## 7. Earning High trust — real, independently-evaluated execution

Optional, and **strictly requires Medium first** — a free sandbox filter exists precisely so a
real evaluator's time, or an owner's real money, is never spent on an agent that can't clear it.

Two paths, both producing genuine `EXECUTION`-class, L3 evidence via an independent AACP
Evaluator (never the marketplace itself grading its own test):

1. **Organic**: a real buyer hires the agent for real money; the job is wrapped as an AACP
   `PROGRAM` job per `03-evidence-trust-engine-pipeline.md`'s existing pipeline.
2. **Owner-funded showcase**: the owner funds their own real mainnet job with their own capital.
   The marketplace orchestrates the job and the independent Evaluator check, but **contributes
   zero tokens** — this is the owner voluntarily proving their agent's real value with their own
   money on the line, which is a more convincing signal than anything the marketplace could
   manufacture on its behalf.

**The marketplace never funds a real, capital-bearing test job for any agent, under any
circumstance.** This is a hard rule, and it corrects something Decision 0002 originally got
wrong (see §9).

Once one such record exists, `scoring` computes High as eligible.

## 8. Version changes — score persists, badges re-verify

Per Decision 0002 (unchanged by this document): a detected `version_hash` change — noticing the
public manifest changed on re-fetch, since code itself is never observable — never deletes
evidence or resets the numeric score. The score keeps its full accumulated history and takes a
temporary, fading discount via `version_continuity(e)` in the `weight(e)` formula (§1.9 of
`01-data-model-state-machines.md`).

Badges are handled by a mechanism this document adds, grounded in an invariant Section 0 already
states for a different reason (6.2: `evidence` may never have a score baked into it — every score
is recomputed at read time from raw evidence, so it stays re-derivable forever). Applying that
same rule to badges: **a Medium/High badge is never a stored flag.** It's computed live as
"eligible, AND no unresolved version change since the qualifying evidence was produced." A
redeploy therefore automatically puts a badge into a "re-verification pending" state — shown on
the Agent Card, not hidden — until fresh evidence (a new Stage-1 pass for Medium, new execution
evidence for High) lands under the current version. No new mechanism needed; this falls directly
out of the re-derivability rule already in place.

## 9. Correction this document makes to Decision 0002

Decision 0002's Bug-1 fix (§"Bug 1 — marketplace-funded onboarding test job") currently states
that the marketplace funds a real AACP `PROGRAM` job producing `EXECUTION`-class evidence. That
premise is superseded by the design in this document on two points:

- The marketplace-funded onboarding path is **testnet/fork-only**, never real funds (§6.2), and
  produces **sandbox-class evidence supporting Medium**, not `EXECUTION`-class evidence.
- The original deadlock is actually broken one step earlier than 0002 described — by decoupling
  High out of the required ladder entirely (§5), not by inventing a marketplace-funded path to
  `EXECUTION`-class proof.

`docs/architecture/decisions/0002-trust-ladder-bootstrap-and-version-continuity.md` carries an
inline amendment noting this correction (added 2026-08-24); its version-continuity fix (Bug 2)
is unaffected and remains correct as written.

## 10. Post-LIVE monitoring

`apps/watch` (always-on, detects-only, no signing capability, forbidden by lint from importing
`custody`/`settlement` — Section 0 §5.1) monitors endpoint health and enqueues a job on
failure — it never acts itself. `apps/jobs` carries out the
resulting `listings` transition:

- `LIVE ↔ DEGRADED` auto-recovers symmetrically on sustained endpoint failure / recovery.
- Sustained failure, or a fraud signal surfaced by `scoring`'s sybil/independence math
  (`01-data-model-state-machines.md` §1.10), moves the agent to `SUSPENDED` or `REVOKED`.
- A config or category change re-triggers **only the specific gate it affects** — a category
  change re-runs Medium's scenario suite for the new category; it never resets Low.

## 11. Open items — tuning values, not architectural gaps

Consistent with how `04-category-agent-execution-architecture.md` §4.7 and Decision 0002 already
treat threshold numbers: these are real, deferred to implementation, not unresolved design.

- Exact discount curve shape and window length for `version_continuity(e)` (Decision 0002,
  already flagged there).
- Per-category grading thresholds inside the Stage-1 scenario suite (§6.2) — tolerance bands,
  number of graduated scenarios, what counts as an edge case per category.
- Whether/how a decide-only interface (Stage 0, §6.1) gets a standard declaration point in the
  Agent Card, versus being discovered opportunistically per agent.
- Rate limiting on how often a given agent (or owner wallet) can re-attempt the Stage-1 sandbox
  test, to bound `apps/jobs` fork-provisioning cost under abuse — low severity now that Stage 1
  is fork-based and costs no real funds, but still an operational concern at scale.
- Challenge-signature (EIP-712, §4.1) expiry window; endpoint-probe (`census`, §4.3) cadence.
- Whether BNB Agent Studio gets an optional, pre-built compatibility module that gives
  Studio-built agents a working Stage-0 decide-only endpoint out of the box. If built, this is
  strictly opt-in tooling offered to agents being built fresh on that platform — never a
  requirement imposed on an already-deployed third-party agent, consistent with §1's adoption
  constraint.

## 12. Open architectural gaps — flagged during reconciliation, need an explicit decision

Unlike §11, these are not tuning values — they're real design questions this document
currently has no answer for, caught while reconciling `docs/architecture/` against this file
on 2026-08-24. Listed here, not silently dropped, per the doc-hygiene rule in the repo's
`CLAUDE.md`.

- **`commercial_config` / risk-tier ceiling.** The pre-redesign ladder had
  `EXECUTION_VERIFIED → COMMERCIAL_VERIFIED → RISK_REVIEW → APPROVED` as blocking states
  where `commercial_config` (max position size, max daily tx count, max slippage, auto-pause
  threshold) and a capital ceiling were set/reviewed. These states were dropped when the
  ladder became Low/Medium/High, without an explicit decision about where their function
  goes. Leaning proposal (unconfirmed): plain owner-editable field with safe platform
  defaults, capped by an automatic formula-driven ceiling (category baseline × trust tier)
  enforced by `custody` at session-grant time — no blocking gate, no manual review step. This
  belongs in the Builder Console final-review doc once written; it should resolve this gap
  explicitly rather than let it stay silently unresolved.
- **TermiX Agent Advantage Report / L6 benchmark.** The old "Proven"/"Institutional" tiers
  named a specific TermiX bounty-qualifying benchmark (≥3 tasks, ≥1 trading/security-adjacent,
  evidence level L6) as a named evidence source. §7 of this document doesn't currently name
  that benchmark as an accepted High-trust path. Needs an explicit decision on whether/how it
  re-enters the High-trust mechanism, not a silent merge into "real execution evidence."
- **Self-dealing on the owner-funded High-trust path (§7.2).** The existing self-dealing guard
  (`docs/architecture/03-evidence-trust-engine-pipeline.md` §3.3 step 6) checks
  `evaluator_address` against identities the **marketplace** controls — built for the case
  where the marketplace itself is Client/Provider. In the owner-funded showcase path, the
  **owner** is the Client instead. Nothing currently checks `evaluator_address` against
  identities the owner controls, so an owner who also registers an Evaluator identity could
  self-certify their own execution evidence undetected. This is a real gap in the strongest
  trust signal on the platform, not a theoretical one — it needs the guard extended (or an
  equivalent owner-side check added) before §7.2 should be considered safe to build. Belongs
  in the Fraud/Sybil final-review doc.
