---
created: 2026-08-24
status: decided
binds: 01-data-model-state-machines.md (1.0, 1.1, 1.5, 1.8)
---

# Decision 0002 — trust-ladder bootstrap path, and score continuity across version changes

## The two problems this resolves

Both were self-flagged in the partner's own HANDOFF entry as open bugs in Section 1, not yet
fixed in any doc.

**1. The Verified tier is unreachable for a genuinely new agent.**
Per 1.8, "Verified" requires ≥1 `EXECUTION`-class proof. Per 1.5's evidence source table, the
only source that qualifies as `EXECUTION` is an AACP `PROGRAM` job with an independent
Evaluator. That requires the agent to already be doing paid work — but no buyer will hire an
unverified agent to find out if it's any good. Circular: no jobs → no proof → stuck at Basic
forever, regardless of actual quality. This blocks third-party onboarding, which is the thing
Decision 0001 explicitly said our own four agents exist to stress-test.

**2. A redeploy erases bad history.**
Per 1.1 (as originally written): `version_hash` is a hash of the agent's public `agentURI` +
declared strategy config. Trust tier and Performance were scoped to
`(agent_id, version_hash, category)`, and 1.1 stated outright that a version change "restarts
at Basic trust tier" — prior Evidence stays attached to the old hash and does not carry
forward. An agent that behaves badly and accumulates negative Evidence can redeploy (even a
cosmetic change to its public manifest) and reappear with a clean slate. This is the
`version_hash`-reset laundering problem the project's own `MARKET-RESEARCH.md` §4a already
names as a survivorship-bias risk.

A clarifying constraint surfaced while resolving this: we never have access to an agent's
actual source code. These are hosted endpoints run by their own operators — the only thing we
can observe is the public `agentURI` manifest they publish. "Detecting a version change"
means noticing that manifest changed on re-fetch, not inspecting what changed internally. Any
fix has to work within that limit.

## Decision

**Bug 1 — marketplace-funded onboarding test job.**
Extend the mechanism 4.4 already specifies for our own four agents (marketplace acts as AACP
Client, funds a small job, agent is Provider, an independent third-party Evaluator checks the
work) to *any* newly listed agent, not just ours. Immediately after `CAPABILITY_VERIFIED`, the
marketplace can commission one small, marketplace-funded `PROGRAM` job against the agent
through the same independent-verification pipeline already built for Section 3's AACP
integration. This produces a genuine `EXECUTION`-class, L3 proof with no paying buyer required.
Marginal cost is just that one job's budget — the marketplace's AACP Client-side stake (1.7)
already has to exist for the system to function at all, so this isn't a new expense category,
just a new use of an existing one.

Added to 1.5's evidence source table as a new row; 1.8's Verified-tier gate now names this path
explicitly as an available route, not only "get hired."

**Bug 2 — score lives on the agent, not on a version snapshot.**
Trust tier and Performance move from `(agent_id, version_hash, category)` scoping to
`(agent_id, category)` scoping — the score is permanent, tied to the agent's identity, and
accumulates continuously as the agent works, redeploys included. `version_hash` is still
recorded on every Evidence row (unchanged field) and still detected the same way (re-fetch the
public manifest, compare the hash) — it's just no longer a partition key that resets anything.

Instead, a detected version change does two things:
- **A temporary, fading trust discount** — not a reset. The agent's score keeps its
  accumulated history but is weighted down for a window after a detected change, since the
  currently-live version is momentarily unproven; the discount fades back to full weight as
  new Evidence accrues under the new version. Exact discount curve is a tuning value, not an
  architectural one — same treatment 4.3 gave threshold numbers.
- **Transparent disclosure on the agent's public profile** — "manifest updated on [date],
  trust confidence temporarily reduced while the new version proves itself" shown directly on
  the Agent Card, not held back as an internal-only number. Matches the project's existing
  honesty-first pattern (the disclosed maker/taker trade-off in 4b.3).
- **A fraud-detection input, not a fraud-detection verdict.** Unusually frequent version
  churn — especially clustered right after negative Evidence lands — feeds into the existing
  sybil/independence scoring (1.10) as one more signal. It does not by itself block or flag an
  agent; one redeploy after a bug fix looks nothing like a pattern of churn timed to bad
  reviews, and the scoring should only catch the latter.

## Why

- Confirmed directly by the user: agent-level persistent score, version-change discount rather
  than reset, and manifest-change transparency, in that order, across two rounds of review.
- Keeps the fix inside what's actually observable — we only ever see the public manifest, never
  the agent's real code, so nothing here claims more verification power than the system has.
- Reuses existing mechanisms (4.4's marketplace-as-Client pattern, 1.10's sybil scoring, the
  Agent Card's existing UNCONFIRMED-capability display convention from 1.1) rather than adding
  new architectural components.

## Consequences

- `01-data-model-state-machines.md` 1.0's relationship diagram note, 1.1's version_hash
  paragraph, 1.5's evidence table, and 1.8's Verified-tier row are edited (not superseded) to
  match. See inline edits in that file.
- No change to Evidence's append-only/immutable design, to `version_hash`'s definition or
  computation, or to Performance's rollup mechanism (1.6) — only the partition key trust tiers
  read from, and the addition of a discount factor at read time (1.9's existing
  `weight(e)` formula is the natural home for this — see the file for the added factor).
- No change to Sections 0, 2, 3, 4, 4b, or 5.

## Still open

Exact discount-curve shape and window length (how fast it fades, how large the initial dip is)
— a tuning value, deferred to implementation same as 4.3's thresholds were.
