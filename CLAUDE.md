# Aops-Store-BNB — Agent Workspace Rules

**Mode: BUILD.** You are implementing, not researching. Read this file, then
`PRODUCT-STATE.md`, then the current plan. Do not wander the architecture tree.

Current plan: [`docs/build/2026-09-02-v1-milestone-plan-kc.md`](docs/build/2026-09-02-v1-milestone-plan-kc.md)
Current sequencing: the UI scaffold (`docs/build/2026-08-27-ui-scaffold-plan.md`) is complete
and verified — every checkbox ticked, `check:boundaries`/typecheck/lint/tests all clean. This
plan is the backend build that scaffold was staged ahead of. Chunk 1 (Ring 0) is executable
now with zero blockers; later chunks are added to the plan as each prior one's verify step
passes — see that file's own note at Chunk 1.

---

## What to do this session

1. Open the current plan. Do the next unchecked task. Stop when the chunk's verify step passes.
2. If a chunk beyond the next one isn't detailed yet, chunk-ify it the same way Chunk 1 was
   built out from the plan's Phase-level description — cite the same source docs the Phase
   paragraph already names, don't invent new scope.
3. If the plan is silent on something, it is out of scope. Do not invent it.
4. When a chunk is done, tick the checkboxes in the plan in the same turn.

## What you may read (and nothing else, unless the plan cites a section)

| Need | File |
|---|---|
| What to build next | `docs/build/2026-09-02-v1-milestone-plan-kc.md` |
| What phase we are in | `PRODUCT-STATE.md` |
| Category ladder, claim/verify guards | `docs/final-review-docs/01` only if the plan's task names it |
| Fraud/sybil signals (deferred — do not build unless a chunk names it) | `docs/final-review-docs/02` |
| Rebalancing KPIs, strategy model | `docs/final-review-docs/03` §7 only if the plan's task names it |
| Agent-side onboarding, credentials, sessions | `docs/final-review-docs/04` only if the plan's task names it |
| Scoring formula, data model, state machines | `docs/architecture/01` only if the plan's task names it |
| Four-layer trust UI | `docs/architecture/05` §5.2 only if the plan's task names it |
| Where a package or screen goes | `docs/architecture/00` §7.2 |
| Engine names / pipeline map | the scorecard **inside the plan**, or the decomposition doc it's copied from. Do not re-derive it. |

Do not open `docs/unverified-ideas-and-flows/` to "check one more idea" beyond the
decomposition doc the plan already cites. Do not promote docs. Do not write ADRs unless the
human asks. Do not start the agents repo.

## Hard stops

- **Ring 3 (`custody`, `settlement`) is real work now, not a UI shell — and it is the one
  place these rules tighten, not loosen.** Simulate mode by default, testnet until an explicit,
  separate promotion (`architecture/00` §6.1). Human review required before any Ring 3 PR
  merges — this is the one thing in this repo that cannot be auto-merged.
- **`apps/web` and `apps/console` still do not import `@repo/custody` or `@repo/settlement`
  directly.** They call `apps/api` or `apps/jobs`-fronted endpoints; Ring 3 is reached through
  one composition point, not from either UI app.
- **`evidence` may not import `scoring`.** Lint-enforced; this is what keeps every score
  re-derivable forever (`architecture/00` §6.2).
- **`apps/watch` may not import `custody` or `settlement`.** It detects and enqueues, nothing
  else — no exceptions for "just this once."
- **No vendor invention.** If you need Altana / AACP / Pancake / Venus / ERC-8004 behaviour
  that is not already decided in a cited doc, stop and ask — do not curl docs mid-implementation
  and do not guess. (Vendor facts get checked and written into the docs *before* a chunk cites
  them, not discovered while building one.)
- **No stack swaps.** Next.js App Router, Hono, Bun, Drizzle — already chosen (`00` Part 8).
- **No `console.log`.** Biome errors on it.
- **Do not push `main`.**

## Rings (still in force — this is how careful to be, not a research topic)

Dependencies run downward only: Ring 0 imports nothing, Ring 1 imports Ring 0, Ring 2 imports
Rings 0–1, Ring 3 imports Rings 0–2, apps import packages. `design-system` imports no service
package. If a change seems to need two rings, it needs two files (`00` §7.2). Run
`bun run check:boundaries` before you call a chunk done — it reads every manifest's declared
`ring` and fails on any forbidden edge, including undeclared imports in source.

## When a decision actually changes

- Name the conflict. Do not silently overwrite, and do not treat the old line as a veto.
- Same turn: stamp `⚠ SUPERSEDED` at the exact section, update `final-review-docs/README.md`
  if that folder is involved, append the handoff **named for the reader**
  (`HANDOFF_RYUK.md` if writing to Ryuk, `HANDOFF_KC.md` if writing to KC).

You should rarely hit this executing an already-chunked task. You will hit it more often than
the UI scaffold phase did, because backend chunks touch canonical docs directly — that's
expected, not a sign something is wrong.

## Handoffs

Append-only. File is named for whoever the note is **to**. Never edit prior entries.

## Branches

- `main` — stable. Do not push here.
- `planning/docs` — architecture/design. Do not dump backend code here.
- `build/staging` — this work.

## After this plan

When every chunk in `docs/build/2026-09-02-v1-milestone-plan-kc.md` is ticked, stop and wait.
The next plan (fraud/sybil, the deferred engines, or the agents repo) is a new file. Do not
start it unasked.
