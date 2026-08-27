# Aops-Store-BNB — Agent Workspace Rules

**Mode: BUILD.** You are implementing, not researching. Read this file, then
`PRODUCT-STATE.md`, then the current plan. Do not wander the architecture tree.

Current plan: [`docs/build/2026-08-27-ui-scaffold-plan.md`](docs/build/2026-08-27-ui-scaffold-plan.md)
Current sequencing: Decision [`0003`](docs/architecture/decisions/0003-kc-ui-first-then-agents.md)
— scaffold UI now, agents after.

---

## What to do this session

1. Open the current plan. Do the next unchecked task. Stop when the chunk's verify step passes.
2. If the plan is silent on something, it is out of scope. Do not invent it.
3. When a chunk is done, tick the checkboxes in the plan in the same turn.

## What you may read (and nothing else, unless the plan cites a section)

| Need | File |
|---|---|
| What to build next | `docs/build/2026-08-27-ui-scaffold-plan.md` |
| What phase we are in | `PRODUCT-STATE.md` |
| Where a screen goes | `docs/architecture/00` §7.2 — buyer screen → `apps/web` + `design-system`; builder screen → `apps/console` + `design-system` |
| Unclaimed / claim / ladder | `docs/final-review-docs/01` only if the plan's task names it |
| Rebalancing buyer surface | `docs/final-review-docs/03` §9 only if the plan's task names it |
| Four-layer trust UI | `docs/architecture/05` §5.2 only if the plan's task names it |
| Engine names / pipeline map | the scorecard **inside the plan** (copied from the decomposition). Do not re-derive it. |

Do not open `docs/unverified-ideas-and-flows/` to "check one more idea." Do not promote docs.
Do not write ADRs unless the human asks. Do not start the agents repo.

## Hard stops

- **No Ring 3 from the UI.** `apps/web` and `apps/console` do not import `@repo/custody` or
  `@repo/settlement`. Hire, revoke, attest, sandbox-run are shells. A disabled control with
  the reason on the page beats a fake success.
- **No `@repo/domain` or `@repo/database` writes.** Fixture types live in the app. Shared Ring 0
  types are a later joint commit, not this plan.
- **No vendor invention.** If you need Altana / AACP / Pancake / Venus / ERC-8004 behaviour
  that is not already on the page as fixture copy, stop. Do not curl docs. Do not guess.
- **No stack swaps.** Next.js App Router, Hono, Bun, Drizzle — already chosen (`00` Part 8).
- **No `console.log`.** Biome errors on it.
- **Do not push `main`.**

## Rings (still in force — this is how careful to be, not a research topic)

Dependencies run downward only. `design-system` imports no service package. `evidence` does
not import `scoring`. `apps/watch` does not import `custody` or `settlement`. If a change
seems to need two rings, it needs two files (`00` §7.2). Run `bun run check:boundaries`
before you call a chunk done.

## When a decision actually changes

The old research-era rules still apply to **decisions**, not to curiosity:

- Name the conflict. Do not silently overwrite, and do not treat the old line as a veto.
- Same turn: stamp `⚠ SUPERSEDED` at the exact section, update `final-review-docs/README.md`
  if that folder is involved, append the handoff **named for the reader**
  (`HANDOFF_RYUK.md` if writing to Ryuk, `HANDOFF_KC.md` if writing to KC).

You should almost never hit this while executing the UI scaffold plan.

## Handoffs

Append-only. File is named for whoever the note is **to**. Never edit prior entries.

## Branches

- `main` — stable. Do not push here.
- `planning/docs` — architecture/design. Do not dump UI code here.
- `build/staging` — this work.

## After this plan

When every checkbox in `docs/build/2026-08-27-ui-scaffold-plan.md` is ticked, stop and wait.
The next plan (marketplace engines, or agents) is a new file. Do not start it unasked.
