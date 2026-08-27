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

## Deliberately absent — `00` Part 9 open decisions, not oversights

| # | Open decision | Effect on this scaffold |
|---|---|---|
| 1 | **Web framework not recorded.** "A single framework across `web` and `console` is settled; the specific choice is not." | `apps/web` and `apps/console` have a manifest and `src/`, and **no framework**. Adding one is a decision, not a scaffold step |
| 2 | Bootstrap method — fresh vs. strip an existing config | Chose **fresh**, against these rules directly |
| 4 | `console` and `web` as one app or two | Followed `00` §2.1's tree: **two** |
| 5 | How `census` is rate-limited and scheduled at population scale | Package exists; scheduling policy does not |
| 3, 6 | Own on-chain contracts · agents-repo location | Out of scope for this repo |

## Next

`bun install`, then build into the tree. Per `final-review-docs/03` §12 Tier 1, the marketplace
side starts at `market-data` (five reads) → `metrics` (four pure KPIs) → `apps/watch` tick
accumulation. `E16`'s delivery contract should be written down before `evidence`/`scoring` are
built, because both inherit whatever it guarantees.
