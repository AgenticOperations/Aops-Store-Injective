---
created: 2026-08-24
status: decided
binds: 00-repo-architecture-and-agent-conventions.md, 02-module-boundaries-repo-layout.md,
  04-category-agent-execution-architecture.md, 04b-category-agent-strategy-models.md
---

# Decision 0001 — the four category agents live in a separate repository

## The conflict this resolves

Two documents in `docs/architecture/` gave incompatible answers to "where does the
category-agent execution code live":

- **Section 2** (2026-08-16): inside this repository, as `packages/agent-strategies/` and
  `apps/worker/loops/`, talking to the outside world through `packages/chain-adapters/`.
- **Section 0** (2026-08-24): in a separate repository entirely — own wallet, own on-chain
  identity, own endpoint, own deployment, no shared code with this repo. This repo discovers,
  verifies, scores, and hires the four agents through exactly the same public path any
  stranger's agent goes through.

These are mutually exclusive claims about the same question, both currently committed. This
record settles it.

## Decision

**Section 0's model wins.** The four category agents are built and deployed as a separate
repository. This repository never imports their code, never runs their execution loop, and
measures them only by independently reading chain state — never by trusting their self-report.

## Why

- Confirmed directly by [user]: "marketplace and agents should not work together."
- The marketplace is simultaneously the operator of the platform and a seller inside it (our
  own four agents are listings like any other). Stated separately in a document, "we don't
  special-case our own agents" is an assertion. With no import path between the two repos, it
  becomes a checkable fact — there is no code path for special-casing to exist in.
- It makes our own four agents the first real test of third-party onboarding: every rough edge
  in listing, verification, and hiring gets hit by us, through the public path, before a
  stranger hits it.
- It matches how Section 0 already reasons about ownership and blast radius (Ring 3 / Part 1.3
  of that document) — agent execution logic is the agent operator's problem, not the
  marketplace's, and mixing the two erases that boundary.

## Consequences

- **`02-module-boundaries-repo-layout.md` is superseded** for repo topology, package tree, and
  the web↔worker communication design (its Postgres LISTEN/NOTIFY + chain-observation channels
  assumed agent loops running inside this repo, which no longer applies). Its guard-placement
  principle (state-machine guards as pure functions, called identically by every surface) is
  still correct and now lives in Section 0's `domain/` package. See the header added to
  Section 2 itself.
- **`04b-category-agent-strategy-models.md`'s references to `chain-adapters/*`** (4b.0, 4b.6,
  4b.10) now describe a package inside the *agents* repository, not this one. 4b's actual
  content — the DECIDE logic, the contract surfaces, the KPI definitions — is unchanged and
  ships wherever the agents repo's own equivalent of that boundary lands. Clarifying note added
  at 4b.0.
- **`metrics/` stays in this repository** (Section 0 §4.2, unchanged by this decision) — KPI
  computation is the marketplace's job, done by independently observing chain state, not the
  agent's job.
- No other section changes. Sections 1, 3, 5, and 4b's actual strategy content (4b.2–4b.9) were
  already written agent-agnostically and require no edits.

## Still open

Section 0 Part 9 item 6 — *where the agents repository physically lives and how its deployments
are configured* — is not answered by this decision and needs its own short design pass before
Category Agent build work can be scaffolded.

> **⚠ Scoped 2026-08-27.** That open item blocks **agent** scaffold only. It does not block UI
> work in this repository. KC's current queue is Decision
> [`0003`](0003-kc-ui-first-then-agents.md): scaffold `apps/web` + `apps/console` now, then
> move to the agents. Item 6 still has to be answered before anyone runs `create-*` in the
> agents repo.
