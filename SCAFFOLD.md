# Scaffold — `build/staging`

Structure generated from `docs/architecture/00-repo-architecture-and-agent-conventions.md`.
**No product logic.** Every `public/*.ts` is an empty contract marker. This branch establishes
the shape and the guards; engines get built into it.

## What is here

- **16 packages, 5 apps** — exactly the tree in `00` §2.1.
- **Rings declared in metadata.** Every workspace manifest carries a `"ring"` field
  (`0|1|2|3|"shared"|"app"`). It is what the boundary checker reads.
- **`public/` + `private/` per package** (`00` §3.1). `private/` is absent from `exports`, so it
  is unreachable from outside the package by module resolution — not by convention.
- **`exports` doubles as the table of contents** — read one `package.json`, know the whole
  public surface without opening a file.
- **`keys.ts` on every package that needs configuration** (`00` §3.7). Nothing else may read
  `process.env`. A misconfigured money-tier package must fail at boot, not at signing time.
- **Bun workspaces + root `catalog:`** (`00` §3.4) — one version of every shared dependency.
  Two versions of a signing library in one process is a bug nobody finds by reading.
- **Turborepo** for per-package filtered tasks (`00` §7.5).
- **Biome** — Rust-based lint/format, `noConsoleLog: error` (`00` Part 8: unattended operation
  means logs are the only witness).

## The part that actually matters

`tooling/check-boundaries.ts` implements `00` §6.4. The doc says *"Each is a lint rule, not a
paragraph. A violation fails the build."* This is that rule.

```
bun run check:boundaries
```

It reads declared dependencies **and** actual import statements — an undeclared import is still
an import — and enforces:

| Forbidden edge | Why |
|---|---|
| `evidence` → `scoring` | §6.2 — the single rule that keeps every score re-derivable forever |
| `apps/watch` → `custody` · `settlement` | §5.1 — the least-supervised process gets the smallest mandate |
| `design-system` → any service package | §6.4 |
| any package → any app | §3.3 |
| Ring N → Ring > N | §3.3 |

Verified by injecting both a `evidence → scoring` and an `apps/watch → custody` import: the
check failed with exit 1 and named the rule. A guard that has never failed is not a guard.

> `strategies (agents repo) → scoring · evidence · listings · discovery` is the sixth edge in
> §6.4. It cannot be checked here and does not need to be — it is enforced by those packages
> being in a different repository (`00` §4, Decision 0001). That is the point of the split.

## Stack — selected 2026-08-27, recorded in `00` Part 8

| Slot | Choice | Verified |
|---|---|---|
| Runtime · package manager | Bun 1.3.6 + root `catalog:` | ✅ 21 workspaces resolve, lockfile committed |
| Monorepo | Turborepo 2.10 | ✅ `turbo run typecheck` — 20/20 |
| `api` | **Hono** + `@hono/zod-openapi` | ✅ boots, `/openapi.json` generated from the zod schema |
| `web` · `console` | **Next.js 15** (App Router) | ✅ `next build` compiles under Bun, static pages emitted |
| `jobs` | Inngest | ⬜ not wired yet |
| `watch` | plain Bun + viem | ⬜ entry point only — see below |
| Chain I/O | **viem** | ⬜ not exercised yet |
| DB | Drizzle + Neon (Postgres) | ⬜ no schema yet |
| Validation | zod, everywhere | — one library, per `00` §3.4 |
| Testing | `bun test` + `fast-check` on Ring 0 | ⬜ no tests yet |
| Lint | Biome + `tooling/check-boundaries.ts` | ✅ boundaries pass |

**NestJS was evaluated and rejected.** It boots fine under Bun (verified: Fastify adapter,
constructor DI resolving). The objection is structural — Nest exists to structure business
logic, and `00` §3.5 forbids business logic in the app layer, so you pay the whole framework
cost for a benefit the design already rules out. It also contradicts Part 8's own word for this
surface: *light*.

**Mixed runtime, by design.** Bun runs `api`, `watch`, `jobs`, tooling. The Next apps target
Node, as Next does.

## `apps/watch` is the one time-sensitive component

`final-review-docs/03` §7.3, verified live against BSC: a V3 pool's oracle ring buffer spans
**≈98 minutes** on the busiest pool and far less on the 0.25% / 1% tiers. So
`time_in_range_pct` — the headline rebalancing KPI — **cannot be reconstructed retroactively**.

Every hour this process is not running is an hour of that number permanently lost. It is the
only component here whose output is a function of how long it has been alive. The alternative
is buying archive/subgraph data (open decision #2, `03` §13) — public RPC already returns
`-32005: limit exceeded` on a 200-block window.

Its dependency chain is short and does not include `metrics` or Inngest:

```
@repo/database (observations table) -> @repo/market-data (slot0/observe) -> apps/watch
```

## Still open in `00` Part 9

Items 1, 2 and 4 were resolved 2026-08-27 and stamped in the doc. Remaining: **#3** own
on-chain contracts, **#5** `census` rate-limiting at population scale, **#6** agents-repo
location.

## Next

`bun install`, then build into the tree. Per `final-review-docs/03` §12 Tier 1, the marketplace
side starts at `market-data` (five reads) → `metrics` (four pure KPIs) → `apps/watch` tick
accumulation. `E16`'s delivery contract should be written down before `evidence`/`scoring` are
built, because both inherit whatever it guarantees.
