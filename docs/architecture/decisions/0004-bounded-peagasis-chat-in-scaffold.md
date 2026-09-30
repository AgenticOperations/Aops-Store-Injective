---
created: 2026-08-29
status: decided
binds: docs/build/2026-08-27-ui-scaffold-plan.md (line 33, hard stop 5),
  2026-08-25-peagasis-concierge-ryuk.md, 2026-08-25-discovery-engine-ryuk.md §5.5
decided_by: Kaushal
---

# Decision 0004 — Bounded PEAGASIS chat (v1 only) is back in scope for the hackathon scaffold

## The conflict this resolves

`docs/build/2026-08-27-ui-scaffold-plan.md` line 33 lists "PEAGASIS chat" under "Deferred, do
not scaffold," and hard stop 5 says "do not treat unverified PEAGASIS/v2 docs as routes to
build." That deferral was written for the *whole* PEAGASIS concept without separating it from
the v1/v2 split `2026-08-25-discovery-engine-ryuk.md` §5.5 had already drawn — v1 (bounded
text-to-structured-query, deterministic ranking underneath) and v2 (conversational,
weight-setting, non-deterministic by design) are different systems with different risk
profiles, but the plan's blanket "do not scaffold" line didn't distinguish them.

Separately: a landing-page chat surface was raised as a way to lower the barrier for a
zero-Agent-Studio-knowledge visitor. That's a real fit for the Functionality judging axis
("someone with zero Agent Studio knowledge should get through it without hitting a dead end"),
but only the bounded version — v2's non-determinism is indefensible for something judges need
to reproduce reliably.

## Decision

**v1-bounded PEAGASIS is in scope for this scaffold. v2 stays deferred exactly as decided.**

1. A chat/search input ships on `apps/web`'s landing page, **above** the existing category
   grid — not replacing it. The grid remains a zero-typing, guaranteed fallback path.
2. The chat's only job is `2026-08-25-discovery-engine-ryuk.md` §4's bounded contract: free
   text → the E8 structured-query schema (`category`, `risk_tolerance`, `budget_ceiling`,
   `min_trust_tier`, `capability_requirements`, `availability_required`,
   `free_text_original`). If `category` can't be confidently resolved, it asks **one**
   clarifying question — it never guesses and never asks a second round.
3. Resolved queries feed the **same deterministic fixture-filter** the category grid already
   uses. Chat and grid are two input paths into one function — not two code paths that could
   drift.
4. Real LLM call (Gemini, small/fast model — free tier), not a stub. A fake parser would
   undercut the exact axes (Functionality, Data Quality) this is meant to help. Server-side
   only, new route `apps/web/src/app/api/discover/route.ts`, one new env var
   (`GEMINI_API_KEY`).
5. Deterministic keyword→category fallback (no network) fires on any Gemini failure, timeout,
   or free-tier throttle — the surface must never dead-end or error out from an LLM hiccup
   during judging.

## What this does not change

- v2 (conversation-set ranking weights, semantic/vector retrieval) stays exactly as
  `discovery-engine-ryuk.md` §5.5 decided: designed, not shipped this hackathon.
- No chat-driven hiring or signing. The hire flow stays "not wired," per the existing plan.
- No Agent Studio content of any kind reaches the buyer marketplace. Agent Studio is
  builder-side tooling, out of scope for `apps/web` — see reasoning captured
  2026-08-29 (buyer journey is judged on needing *zero* Agent Studio knowledge, and Agent
  Studio itself is organizer-provided tooling, not something to rebuild a wrapper around).
- Ring boundaries are unaffected: the new route touches only fixtures + Gemini, never
  `@repo/custody`, `@repo/settlement`, `@repo/domain`, or `@repo/database`.

## Why

Category-grid-only discovery is safe but doesn't address the friction a zero-knowledge visitor
faces picking a category from a cold start. The bounded v1 concierge was already fully designed
for exactly this — the plan's blanket PEAGASIS deferral was scoped too broadly by not
separating v1 from v2. Building only what was already speced, with the grid kept as a guaranteed
fallback, adds the UX benefit without reopening the determinism/testability problem v2 was
correctly deferred for.
