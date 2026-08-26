# Discovery Engine — Working Design (Unverified)

Author: Ryuk (+ AI session). Drop-zone doc per this folder's README — not cross-checked against
`docs/architecture/` as a whole, not binding, not yet reconciled with anything KC is doing on
the other engines. Consolidates a full brainstorm session covering E8 (Discovery), E9 (Ranking),
and E10 (Compare + Simulate) from KC's engine map, built directly on top of the Proof Engine
(`2026-08-25-proof-engine-ryuk.md`) and the existing data model/trust UI (`01`, `03`, `05`).

**Status**: architecture-level design, self-reviewed. One real dependency on KC's still-pending
E5 grading logic, handled with an explicit neutral default rather than a blocker — see §7.

---

## 1. What this document answers

Once an agent is trustworthy (Proof Engine) and listed (`01`), how does a buyer actually find the
right one, understand why it's ranked where it is, and see what it would do with their money
before ever granting it a session? This is the consolidated design for Discovery — the third
pipeline in the partner's engine map (`BUYER → E8 → E9 → E10 → E11`), sitting entirely downstream
of `LISTINGS` and `E6`'s score/confidence output, feeding directly into the existing hiring flow
(`05`§5.3, `E11`).

## 2. Scope

This document covers **E8, E9, E10 only**. Two adjacent pieces are explicitly out of scope here:
Ingestion (E1) is already designed and promoted (`01`); Builder Console stays deferred per
`PRODUCT-STATE.md` and isn't reopened by this doc.

## 3. The hard constraint this design is built around

Established and non-negotiable from prior discussion (verbatim, on record): ranking must be a
**deterministic, tunable weighted formula** — never embedding-similarity search, never a single
blended trust score. The LLM's only job is turning free text into a structured query; everything
downstream is algorithmic. A feedback loop (view→hire→outcome→review→re-rank) is required. Every
design choice below is checked against this constraint, not just inspired by it.

> **⚠ Changed 2026-08-26 — E9 is now explicitly two versions.** This section's constraint
> (deterministic formula; the LLM confined to query parsing) is **what v1 ships.** The semantic /
> vector / LLM-ranked mechanism in `2026-08-25-peagasis-discovery-engine-v2-ryuk.md` §2.2 is
> **v2 — designed, not shipped for the hackathon.** That doc's §0 describes its reversal of this
> section as live; it is not. See §5.5 for the split and what each version contains.

## 4. E8 — Discovery

**Input**: buyer free text ("protect my Venus position from liquidation") or direct structured
filters — both paths converge on the same structured query.

**The LLM's bounded contract** — this is the entire surface where an LLM touches the pipeline,
nothing downstream ever calls it again:

```
category                (required, single enum — rebalancing | grid-trading |
                          yield-optimization | health-factor-monitoring)
risk_tolerance           (band)
budget_ceiling           (optional numeric)
min_trust_tier           (optional — buyer's own preference, separate from the hard
                          hiring-gate already enforced at hire time, 05§5.3)
capability_requirements  (structured list, e.g. "must support Venus",
                          "must support PancakeSwap V3")
availability_required    (must be LIVE / synced now)
free_text_original       (kept for audit only, never re-parsed downstream)
```

**Failure mode**: if the LLM can't confidently extract `category`, it asks the buyer one
clarifying question rather than guessing — `category` is the hard partition (1.0's
never-cross-category rule) everything downstream depends on, so a wrong guess here corrupts the
whole result set silently.

**Executor**: a plain, deterministic filter over `LISTINGS` — no ranking logic at this stage, only
a candidate set. Zero matches renders an explicit empty state (same principle as `05`§5.2
correction 1 — absence must never look like a weak result, it's a different state).

## 5. E9 — Ranking

The single most load-bearing, previously-undesigned piece. The formula:

```
weighted_score = w1·capability_match + w2·risk_fit + w3·trust_evidence_strength
                + w4·outcome_quality + w5·price_value + w6·availability
```

Deterministic, re-derivable given a fixed `(weights, methodology_version)` pair — same
re-derivability principle `05`§5.2 Layer 3 already establishes for the trust score itself,
extended here to ranking.

### 5.1 Per-factor definitions and sources

| Factor | Definition | Source |
|---|---|---|
| `capability_match` | graded match between the query's `capability_requirements` and the Listing's declared capabilities | Listing config — declared, not inferred |
| `risk_fit` | distance between buyer's `risk_tolerance` and the agent's `commercial_config` ceiling | deterministic distance function over `01`/`03`'s existing `commercial_config` field |
| `trust_evidence_strength` | **reuses E6's score+confidence output directly** — no new score is invented | E6 (1.9) |
| `outcome_quality` | category-specific on-chain KPI grading | Performance rollup / E5 — **see §7, staged default until KC's grading logic lands** |
| `price_value` | agent's fee vs. category median (relative, not absolute) | `commercial_config` |
| `availability` | sync health + recent uptime | `sync_status` (1.1) |

### 5.2 Zero-evidence floor

A fresh, zero-Evidence agent is **unknown, not bad** — treating it as a punishing near-zero would
contradict the "zero evidence ≠ low evidence" principle already locked into `05`§5.2 correction 1,
and would make honest cold-start agents unrankable regardless of how well they match on every
other factor. `trust_evidence_strength` floors at a **neutral midpoint (0.5 on a normalized 0–1
scale)** when Evidence count is zero. The honest caveat ("no track record yet") is carried by the
UI disclosure that already has to exist, not baked into the number — same split the trust UI
already draws between score and confidence.

### 5.3 Weight defaults — per-category from day one, differentiated only where justified

The weight schema is keyed per-category from the start (cheap now, avoids a migration later), but
only two categories get an actual override — the rest start flat. Every override below has a
one-line reason; none are arbitrary:

**Base default** (rebalancing, yield-optimization):

| capability_match | risk_fit | trust_evidence_strength | outcome_quality | price_value | availability |
|---|---|---|---|---|---|
| 0.20 | 0.20 | 0.25 | 0.20 | 0.10 | 0.05 |

**Grid-trading override** — fee-sensitive, high-frequency, price matters more than for the other
three categories:

| capability_match | risk_fit | trust_evidence_strength | outcome_quality | price_value | availability |
|---|---|---|---|---|---|
| 0.15 | 0.20 | 0.25 | 0.15 | 0.20 | 0.05 |

**Health-factor-monitoring override** — the highest-stakes category (liquidation protection);
reliability and proven outcomes matter far more than price, and staying synced/live matters more
than for the other three since a missed check is the failure mode that actually hurts a buyer:

| capability_match | risk_fit | trust_evidence_strength | outcome_quality | price_value | availability |
|---|---|---|---|---|---|
| 0.15 | 0.10 | 0.35 | 0.25 | 0.05 | 0.10 |

All three sets sum to 1.00. These are stated as **tunable starting defaults**, not launch-locked
values — real usage data should move them, the schema just needs to support that from day one.

### 5.4 Feedback loop

Matches the dotted `E6 → E9` edge already drawn in the partner's own mermaid diagram — no new
mechanism needed. New Evidence (Settlement Review, on-chain outcome, sandbox result) → `E6`
recomputes score/confidence → `E9`'s next query reads the fresher `trust_evidence_strength` input.
No ML, no separate "learning" step: it's the same deterministic formula reading live input instead
of stale input.

### 5.5 v1 / v2 split — decided 2026-08-26

**[NEW]** Recorded here because three documents currently describe three different E9s — this
doc §3/§5, `2026-08-25-peagasis-discovery-engine-v2-ryuk.md` §0/§2.2, and
`2026-08-25-marketplace-engine-decomposition-kc.md` E9. This section is the reconciliation.

| | **v1 — ships for the hackathon** | **v2 — designed, not shipped** |
|---|---|---|
| Retrieval | deterministic filter over `LISTINGS` (§4) | + pgvector semantic index over `LISTINGS`, re-embedded off E16, top-N + hard filters |
| Ranking | the weighted sum in §5, **fixed per-category weights from §5.3** | same weighted sum; weights set per conversation by PEAGASIS, bounded/clamped/re-normalised |
| Determinism | **guaranteed** — same query + same `(weights, methodology_version)` returns the same order | deterministic *given* a weight vector; the vector varies per conversation |
| LLM role | free-text → structured query (§4) only | + weight extraction, + narration over retrieved rows |

**What does not change between versions, and is built into v1 so there is no migration:**

- The ranking function takes **weights as an input parameter**, never as a constant. v1 only ever
  passes §5.3's category defaults through it; v2 passes a conversation-derived vector through the
  same signature. One function, two weight-sourcing paths, from day one. A machine buyer takes the
  same path with explicit weights or category defaults — so a human and an agent asking the same
  question cannot get differently-derived answers.
- The buyer is shown the **literal** weights used, never a paraphrase.
- **Filters are conjunctive; ranking is compensatory.** Conjunctive logic lives in E8's filters and
  E12's gate, never in the rank.
- **Facts are never LLM-generated in either version.** E6's score/confidence stays deterministic and
  re-derivable; the LLM narrates it, never invents it.

**Why v1 is the deterministic one.** v2's own §4 accepts non-determinism as a property — two buyers
with identical input can get different orderings. That is defensible for a conversational surface
and indefensible as the *only* ranking a marketplace has on day one: it cannot be unit-tested
against fixed inputs (§9), it cannot honour the explanation-derives-from-the-weights rule, and a
ranking that changes between page loads is not something a buyer moving real money can audit.

**One security surface this split removes from v1 entirely.** v2 §4 flags prompt injection via
seller-authored listing text reaching the LLM's context. In v1 the LLM never sees a listing row —
only the buyer's own free text — so that surface does not exist until v2 opens it. It stays a
v2 build requirement, not a v1 one.

## 6. E10 — Compare + Simulate

### 6.1 Compare

Reuses `05`§5.2 Layer 4 as-is (category-scoped comparison, enforced at the query layer per that
section's correction 2), extended to show each candidate's **per-factor E9 breakdown**, not just
the final score — so a buyer sees *why* one agent outranks another, the same transparency
principle Layer 3 already applies to the trust score itself.

### 6.2 Simulate — corrected design, cost-driven

**The original idea** ("preview before wallet," run a forked-chain simulation seeded with the
buyer's own position before they grant a session) was **rejected mid-session on cost grounds** —
a live Anvil fork per buyer per hire-consideration scales with buyer traffic, not agent count. A
hundred buyers evaluating the same agent means a hundred fork spin-ups for one agent's worth of
insight — this duplicates the Sandbox's job (E3, deliberately expensive, deliberately run once per
agent) at exactly the wrong multiplier, and this product will eventually run on real hosted
infrastructure where that cost is real, not free.

**The fix**: recognize that the execution loop is already `READ → DECIDE → ACT → RECORD`
(§Tier 4/5 of the component inventory), and `DECIDE` is a pure function — no fork, no on-chain
write, no gas. Simulate becomes:

1. `READ` the buyer's actual current on-chain position — a handful of read-only RPC calls, no
   fork, no state mutation.
2. Feed that state into the agent's real `DECIDE` function.
3. Show the buyer the predicted action, using the exact decision logic that would run for real.

This is **cheap enough to run synchronously**, inline, at query time — no async job, no
per-buyer rate limit needed, because there's no forked infrastructure being provisioned per
request. It's also arguably more trustworthy than the fork version: it reads the buyer's real live
state rather than a synthetic snapshot.

**Honest limitation, stated plainly**: this shows what the agent *decides*, not a full simulated
*execution* — no slippage, no gas estimate, no multi-step ripple effects. For that deeper picture,
the buyer looks at the agent's existing Sandbox evidence (already in its Evidence timeline, `05`
Layer 2) — graduated mild/severe/edge-case scenarios computed once at ingestion time — rather than
commissioning a new one per hire consideration.

**Agents without sandbox evidence at all** (third-party, sandbox is optional per `01`§5) can still
use the cheap `DECIDE`-preview Simulate — the two are independent; only the deeper Sandbox-report
view depends on that agent having opted in.

## 7. Dependency on KC's E5 grading logic

`outcome_quality` (§5.1) can be architected and shipped now without KC's per-category grading
logic landing first — it returns the same neutral 0.5 default as the zero-evidence floor (§5.2)
until real grading exists for a given agent/category, and the Compare breakdown (§6.1) labels it
"not yet measured" rather than showing a number that looks measured but isn't. This is the same
graceful-missing-data pattern applied twice, not a new mechanism. Ranking is fully functional on
day one; this factor sharpens in place as KC's grading arrives, with zero rework to E9 itself.

## 8. Data flow

Matches the partner's own mermaid exactly — this design doesn't restructure it, only fills in E8/
E9/E10's internals:

```
LISTINGS ==> E8 (query + filter) --> E9 (weighted ranking) --> E10 (compare + simulate) ==> E11 (hiring)
E6 (score/confidence) -.feedback.-> E9
```

`E10`'s Simulate step reads chain state directly (via the same read path `E5`/the execution loop
already uses) — it does not create a new chain-adapter dependency.

## 9. Testability

- **E8**: golden set of free-text → structured-query pairs, checked against the LLM's output
  contract (§4) — a parser regression is a query-contract mismatch, cheap to catch.
- **E9**: pure function of `(candidate set, weights, E6 outputs)` — fully unit-testable with fixed
  inputs and fixed `methodology_version`, no live chain or LLM dependency at all.
- **E10 Simulate**: `DECIDE` is already pure per the execution-loop design — testable by mocking
  the `READ` output and asserting the predicted action, no fork, no chain interaction needed in
  tests either.

## 10. Decisions log — 2026-08-25 session

1. E8's structured query schema and the LLM's bounded, single-purpose role — **defined** (§4).
2. E9's six-factor weighted formula, each factor's definition and data source — **defined** (§5.1).
3. Zero-evidence ranking floor — **neutral midpoint (0.5)**, not a punishing zero (§5.2).
4. Per-category weight overrides — **schema supports per-category from day one; only
   grid-trading and health-factor-monitoring get real overrides now**, rest stay flat (§5.3).
5. `outcome_quality`'s dependency on KC's E5 grading — **not a blocker**, staged neutral default
   until it lands (§7).
6. E10 Simulate — **redesigned from a live forked-chain preview to a pure `DECIDE`-function
   preview against the buyer's real read-only state**, after the fork version was identified
   mid-session as scaling with buyer traffic rather than agent count (§6.2). Supersedes the
   original async/rate-limited fork design entirely — there is no forked infrastructure left to
   rate-limit.
7. **E9 ships in two versions — decided 2026-08-26 (KC).** v1 is this doc's deterministic weighted
   sum with the fixed per-category weights of §5.3; the PEAGASIS semantic/LLM-ranked mechanism is
   **v2, designed but not shipped for the hackathon**. Full split in §5.5. This **reverses**
   `2026-08-25-peagasis-discovery-engine-v2-ryuk.md` §0's claim that the deterministic constraint is
   "reversed for PEAGASIS" — it is *deferred*, not reversed — and voids that doc's §6 instruction to
   mark this doc's formula sections superseded. It also moves the **weight-vector bridge** agreed
   2026-08-26 (KC + Ryuk) into v2: PEAGASIS is what sets weights per conversation, so the bridge
   cannot run without it. The *function signature* ships in v1 regardless (§5.5), so nothing is
   rebuilt later.

## 11. Open items — genuinely undecided, not solved here

| Item | Notes |
|---|---|
| Exact LLM/prompt implementation for E8's parser | Implementation-time choice, not architectural |
| Package/service placement for E8/E9/E10 | Confirmable at implementation time, consistent with how `05`§5.5 scoped comparable placement decisions |
| Whether rebalancing/yield-optimization ever need their own weight overrides | Deferred — start flat, revisit once real usage data exists |
| KC's per-category E5 grading logic | Owned by KC (Proof Engine doc §9) — E9 doesn't block on it, just degrades gracefully until it lands |
| Clamp ranges for conversation-set weights | **Now a v2 item, not v1** (§5.5) — v1 passes fixed defaults, so there is nothing to clamp until PEAGASIS sets weights |
| **Whether v1 ships with any un-fakeable ranking factor at all** | **Open gap, created by this split.** With `trust_evidence_strength` floored at 0.5 (§5.2) and `outcome_quality` at its neutral default (§7), 0.45 of total weight is constant across every agent at launch — and of the 0.55 that varies, 0.50 is owner-declared (`capability_match`, `risk_fit`, `price_value`). v1 therefore ranks almost entirely on self-declared config. `MARKET-RESEARCH.md` §2b names the un-fakeable signal we already own and do not use — session survival / early revocation. Not resolved here; named so it is not lost |

## 12. Next step

Once this is reviewed, the remaining work before implementation planning is reconciling this
against whatever KC lands on for E5 grading (§7) — not a blocker for writing this doc, but worth
a pass once that lands, same as the Proof Engine doc's own §9 dependency structure.
