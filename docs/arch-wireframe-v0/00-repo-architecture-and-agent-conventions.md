---
created: 2026-08-24
project: BUILD-BNB — BNB "Build the Era" marketplace
status: architecture decided in design discussion; open items explicitly listed in Part 9.
  This is Section 0 — it precedes Section 1 because it says where code goes and how careful
  to be. Read this before writing any code in this repository.
section: 0 of N — Repository Architecture & Agent Conventions
depends_on: none (Sections 1–5 describe *what* we build; this describes *how the repository
  is shaped* and *how work is done in it*)
---

# Section 0 — Repository Architecture & Agent Conventions

> **If you are a coding agent, read Parts 1, 2 and 7 before writing anything.**
> Part 7.2 is a lookup table: "I am adding X" → "it goes in Y".

---

## Part 1 — Why this product needs a specific repository shape

Most repositories can be laid out by feature and be fine. This one cannot, for six reasons
that are properties of the product rather than preferences about code.

### 1.1 What we are building

A marketplace where a person states a financial goal, finds an autonomous agent that can do
it, sees honest evidence of whether that agent actually works, grants it precisely-bounded
authority over their money, watches what it does, and can revoke it in one click.

The product's entire value is the **evidence layer**: the claim that the numbers we show are
real, independently derived, and reproducible. Everything about the repository shape exists to
make that claim structurally true rather than merely asserted.

### 1.2 Property one — some mistakes are recoverable and some are not

A wrong scoring weight is a bug. You notice it, you fix it, you recompute.

A wrong `grantSession` call, a wrong swap, a wrong repay amount is **money gone, irreversibly,
from a stranger who trusted us**. There is no rollback, no migration, no apology that returns
the funds.

These two kinds of code have nothing in common operationally. They need different test
discipline, different review requirements, different default behaviour, and different levels
of caution from whoever — or whatever — is editing them. A repository that mixes them in the
same folder gives the author no signal about which one they are in.

**Therefore: reversibility is the primary axis the repository is carved on.**

### 1.3 Property two — three different kinds of data ownership, three different failure modes

| Class | Examples | What goes wrong |
|---|---|---|
| **We can only read it** | chain state, ERC-8004 registries, agent endpoints, protocol oracles, external indexers | Our view is a **cache**. It can be stale. The chain is always the truth and our database is always an opinion. |
| **We own it** | listings, evidence, performance rollups, authorizations, reviews | We can migrate it, backfill it, correct it. Mistakes are recoverable. |
| **We write it outward** | session grants, escrow funding, payments, staked jobs | Once sent, it is not ours any more. Irreversible by construction. |

Code that treats a stale cached read as authoritative is a class of bug that only appears
under load or during a market move — exactly when it costs the most. Code that treats an
outward write like a database write is the class of bug that loses funds.

**Therefore: ownership class is visible in the package tree**, and a reader can tell which one
they are touching without reading the implementation.

### 1.4 Property three — the credibility-critical logic is pure

Three bodies of logic decide whether anyone should believe this product:

- the **state-machine guards** that decide whether a listing may go live or a hire may proceed,
- the **scoring formula** that turns evidence into a score, a confidence, and a trust tier,
- the **KPI computations** that turn raw chain observations into category quality numbers.

All three are pure functions of their inputs. None needs a network call, a database, or a
wallet. They are the easiest code in the system to test exhaustively and the most damaging
code in the system to get wrong.

They are also what we publish. The methodology page promises that **every score is
re-derivable from raw evidence**. That promise is only keepable if the derivation is isolated,
versioned, and free of hidden inputs.

**Therefore: pure logic is physically separated from everything that performs I/O**, and
cannot import anything that does.

### 1.5 Property four — three clocks

| Clock | Work | Shape |
|---|---|---|
| **Human speed** | discovery, comparison, hiring, dashboards | request → response, latency matters |
| **Batch** | evidence rollups, population census, refund sweeps, re-scoring | scheduled, retried, idempotent |
| **Continuous** | health-factor threshold crossings, position drift | must react in seconds, never sleeps |

The third is the awkward one, and it is not optional: **intervention latency — threshold
crossed to transaction confirmed — is a published quality metric** for the health-factor
category. A polling interval would become a self-imposed floor on a number we are asking
buyers to judge us on.

**Therefore: the runtime topology has three distinct shapes**, and which one a piece of code
runs under is a deliberate placement, not an accident of where it was written.

### 1.6 Property five — the vendor surface is unusually volatile

This is not a normal integration surface. In the space of a few weeks during design alone:

- the platform's wallet layer was replaced by a different provider,
- a verification protocol we integrate against had a feature flag that changes the evidentiary
  strength of everything it produces,
- the primary DEX shipped a new architecture alongside the one we target,
- a lending protocol shipped a native capability that changes how one of our agents works.

We should expect to swap, drop, or add a vendor **during the life of this product**, possibly
several times. If vendor names appear in the import graph, every such change is a repo-wide
rename with a long tail of missed references.

**Therefore: packages are named after the job they do, never after the vendor that currently
does it.** The vendor lives inside, unexported.

### 1.7 Property six — this repository is built by coding agents

This is a first-class requirement, not a convenience. It changes what "good structure" means.

An agent working here is different from a human in five ways that matter:

| | Consequence for the repo |
|---|---|
| It reasons well only over what fits in its context | Packages must be small enough to read whole. A package nobody can hold in mind gets edited blind. |
| It finds files by name, then guesses | Names must map predictably to jobs, or the agent writes a second copy of something that already exists. |
| **It will violate a rule that is only written down** | Every architectural invariant must be enforced by something that *errors*. Prose is documentation, not protection. |
| It stops verifying when the feedback loop is slow | Type-checking a single package must take seconds, or the agent starts asserting instead of checking. |
| It will "helpfully" undo a deliberate choice it does not understand | Decisions need recorded reasons, and the agent must be told which decisions bind which code before it edits. |

**Therefore: the repository carries its own operating instructions** (Part 7), and every rule
in this document is backed by a mechanism that fails loudly rather than a sentence that can be
ignored.

---

## Part 2 — The carve: four rings

Packages are grouped into four rings by **what happens when the code in them is wrong**. The
ring is the outer, visible boundary; capability is the inner one.

```
┌─ RING 0 · PURE ────────────────────────────────────────────────────────┐
│  No I/O. No network, no database, no wallet, no clock.                  │
│  Imports nothing from any other ring.                                   │
│  Testable exhaustively with fixtures. Zero mocks.                       │
│  WRONG HERE → a wrong number, caught by a unit test                     │
├─ RING 1 · OBSERVATION ─────────────────────────────────────────────────┤
│  Reads the outside world. Can never write to it.                        │
│  Everything it returns is a CACHE and may be stale.                     │
│  WRONG HERE → a stale or missing number. Never a loss.                  │
├─ RING 2 · OWNED STATE ─────────────────────────────────────────────────┤
│  Our database. We can migrate, backfill, correct.                       │
│  WRONG HERE → recoverable. Fix forward.                                 │
├─ RING 3 · IRREVERSIBLE ⚠ ──────────────────────────────────────────────┤
│  Money and authority leaving our control.                               │
│  Simulate by default. Testnet until explicitly promoted.                │
│  Human review required. Cannot be auto-merged.                          │
│  WRONG HERE → someone else's funds, gone, permanently                   │
└────────────────────────────────────────────────────────────────────────┘
```

Dependencies run **downward only**: Ring 3 may import Rings 0–2; Ring 0 may import nothing.

### 2.1 The package tree

```
packages/

  # ═══ RING 0 · PURE — no I/O, imports nothing ═══════════════════════════
  domain/            Entities, state machines, transition guards, shared types.
                     The vocabulary of the whole system. Changes rarely.
  scoring/           weight() · score() · confidence() · sybil/independence math.
                     Versioned: every result carries the methodology version that
                     produced it, so any score stays re-derivable forever.
  metrics/           Category KPI definitions and computations — % time in range,
                     net-of-cost APY, intervention latency, inventory skew,
                     drawdown. Pure functions over observations.

  # ═══ RING 1 · OBSERVATION — read-only, output is a cache ═══════════════
  agent-registry/    Who exists, who owns what, what they claim. Reads the
                     identity/reputation registries and the external indexer.
                     Vendors are private; callers see one contract.
  census/            Population-scale liveness probing across the registered
                     agent set. The only package that touches arbitrary
                     third-party endpoints — treats every response as hostile.
  market-data/       Pool state, positions, prices, APYs, protocol oracle reads.
                     Feeds metrics/. Oracle prices and DEX quotes are distinct
                     concepts here and are never interchanged.

  # ═══ RING 2 · OWNED STATE — our database ═══════════════════════════════
  database/          Schema, migrations, typed client. Owns nothing but storage.
  evidence/          Append-only evidence writes and queries. Never mutates a row.
                     Cannot import scoring/ — see 6.2.
  listings/          Listing lifecycle orchestration. Calls domain/ guards; holds
                     no guard logic of its own.
  discovery/         Structured query → candidate retrieval → ranking →
                     explanation. Deterministic. Reads scoring/, writes nothing
                     but its own caches.

  # ═══ RING 3 · IRREVERSIBLE ⚠ — money and authority ═════════════════════
  custody/       ⚠   Session construction, scope encoding, revocation. The blast
                     radius the buyer signs. Two packages in this repo can move
                     value; this is one of them.
  settlement/    ⚠   Escrow funding, per-call payments, staked verification jobs,
                     refund sweeps. The other one.

  # ═══ SHARED ═══════════════════════════════════════════════════════════
  design-system/     Components. Imports no service package, ever.
  observability/     Logging, error reporting, status. Used everywhere.
  utils/             Constants, shared primitives. No domain knowledge.
  typescript-config/ Tooling presets. Not runtime.

apps/
  web/               Buyer marketplace — discovery, agent detail, hiring,
                     active-agent console with visible revoke.
  console/           Builder side — register, verify, analytics, disputes.
  api/               Machine-facing surface: agent-to-agent, MCP, public API.
  jobs/              Scheduled and event-driven tasks. THE COMPOSITION POINT —
                     where pure logic, observation, state and settlement meet.
  watch/         ⚠   The one always-on process. Holds chain subscriptions.
                     DETECTS ONLY — it has no signing capability and no import
                     path to Ring 3. It enqueues a job and stops.
```

**Sixteen packages, five apps.** Each package is small enough to be read in full before it is
edited. That is a deliberate target, not a coincidence — see 1.7.

### 2.2 Why capability, not feature

A feature like "hiring" cuts across all four rings: a pure gate check, a read of current trust
tier, a database write, and an irreversible session grant. Carving by feature would put all
four in one folder and erase the only signal that tells an editor how careful to be.

Carving by ring and capability forces hiring to separate its parts — which is the correct
outcome. The parts are then composed in `apps/`, where composition belongs.

---

## Part 3 — Package rules

Every package obeys the same shape. There are no exceptions, because an exception is a thing
an agent has to know about, and things an agent has to know about are where errors come from.

### 3.1 `public/` and `private/`, enforced by the resolver

```jsonc
// packages/<name>/package.json
{
  "name": "@repo/<name>",
  "type": "module",
  "imports": {
    "#public/*":  "./public/*.ts",
    "#private/*": "./private/*.ts"
  },
  "exports": {
    "./server": "./public/server.ts",
    "./keys":   "./public/keys.ts"
  }
}
```

- `public/` — named exports only. This is the package's contract.
- `private/` — implementation. **Not listed in `exports`, therefore not importable from
  outside the package. Not by convention — by module resolution.**
- Inside the package: `#public/*` and `#private/*`.
- Outside the package: `@repo/<name>/<entry>`, and only entries listed in `exports`.

The `exports` map doubles as a table of contents. An agent that reads one `package.json` knows
the entire public surface of that package without opening a file.

**Why this matters here specifically:** our product's central promise is that its numbers are
independently derived and reproducible. That promise is unverifiable if any caller can reach
into any internal. The boundary is not tidiness — it is the thing that makes the claim
checkable.

### 3.2 Capability names, vendors private

Name the package after the job. The vendor that currently performs that job lives in
`private/` and is never mentioned in an import path outside its own package.

```
custody/                        NOT  altana/
  public/sessions.ts                   ← the contract callers depend on
  private/altana-client.ts             ← the vendor, swappable

market-data/                    NOT  pancakeswap/  venus/
  public/positions.ts
  private/pancake-v3.ts
  private/venus.ts
```

Per 1.6, we expect vendor churn. When it happens, exactly one `private/` folder changes and no
caller notices. When vendor names are in the import graph, the same change is a repo-wide
rename that an agent will do 90% of.

### 3.3 Dependency direction

```
Ring 0  →  nothing
Ring 1  →  Ring 0
Ring 2  →  Rings 0–1
Ring 3  →  Rings 0–2
apps    →  packages
```

Never: app → app · package → app · any cycle · design-system → any service package.

Forbidden edges beyond the ring rule are listed in 6.4 and enforced by lint.

### 3.4 One version of every shared dependency

Shared dependencies are declared once at the workspace root and referenced by every package as
`catalog:`. Version skew between packages that handle money is a real hazard, not a
housekeeping annoyance — two versions of a signing or encoding library in one process is a
class of bug nobody finds by reading.

### 3.5 Thin transport

Apps validate input and call packages. Business logic never lives in a route handler, a task
body, or a component.

**Why this is load-bearing here:** we have four surfaces — web, console, machine API, and
scheduled jobs — and all four must enforce the *same* gates. A hiring gate implemented once in
the web route and again in the API route will drift, and the day it drifts is the day the
machine surface lets through a hire the human surface would have blocked. Guards live in
`domain/`; every surface calls the same function.

### 3.6 Instances by default, factories when the caller must supply runtime values

Export a ready-to-use instance when the package can configure itself from its own validated
environment. Export a factory only when the caller must pass something the package cannot
know. This removes a decision an agent would otherwise make differently each time.

### 3.7 Environment and secrets

Each package that needs configuration owns a `public/keys.ts` that validates its own variables
at startup and fails loudly if they are missing. Apps compose package keys plus their own.
Nothing reads `process.env` directly outside a `keys.ts`.

A misconfigured money-tier package must fail at boot, not at the moment it is asked to sign.

### 3.8 Tests live next to the code they test

`private/compute-health-factor.test.ts` sits beside `private/compute-health-factor.ts`. Public
behaviour is tested through the public entry; internals are tested in place. An agent editing a
file sees its test in the same directory listing and has no excuse.

---

## Part 4 — Two repositories: the agent acts, the marketplace measures

Our four reference agents are **not** part of this repository.

Each is built and deployed as an independent service with its own wallet, its own on-chain
identity, and its own endpoint. Our marketplace discovers, verifies, scores and hires them
through **exactly the same public path** a stranger's agent goes through.

```
   THIS REPOSITORY                        THE AGENTS REPOSITORY
   the marketplace                        four independent deployables
   ───────────────────                    ─────────────────────────────
   discovers, verifies,                   read state · decide · act ·
   scores, ranks, hires,                  report
   measures
                                          each has: own wallet
   measures agents by                               own on-chain identity
   reading chain state                              own endpoint
   INDEPENDENTLY —                                  own deployment
   never by trusting an
   agent's self-report

           ╲                                      ╱
            ╲                                    ╱
             ╲──── no shared code ──────────────╱
              ╲                                ╱
               ╲   the only connection is      ╱
                ╲  the public hiring path     ╱
                 ╲  any third party uses     ╱
```

### 4.1 Why this is an architectural decision and not a deployment detail

We are simultaneously the operator of the marketplace and a seller inside it. That is a real
conflict of interest, and stating "we do not special-case our own agents" in a document is
worth very little.

Separating the repositories makes it a **fact that can be checked**: there is no import path
from our agents to our scoring, our evidence, our listings, or our ranking, because the code is
not in the same tree. Our agents are measured by the same machinery that measures anyone
else's, because no other machinery exists.

This is also the strongest possible proof that third-party onboarding works: we are the first
third party. Every rough edge in listing, verification and hiring gets found by us, before a
stranger hits it.

### 4.2 What stays here and what leaves

- `metrics/` (KPI definitions) stays **here**, not in the agents repo, because KPIs are
  computed *about any agent* by observing chain state independently. Measurement is the
  marketplace's job. The agent never computes its own score.
- Strategy logic and trade execution live **in the agents repo**. The marketplace never swaps,
  never mints a position, never repays a loan.

The consequence is that this repository's irreversible surface shrinks to **two packages**.
Everything else here is safe to move quickly in.

---

## Part 5 — Runtime topology

Five deployables, matching the three clocks in 1.5.

| Runtime | Clock | Contains | Ring 3 access |
|---|---|---|---|
| `apps/web` | human | Buyer marketplace. Constructs the authorization the buyer signs in their own browser | **constructs only, never signs** |
| `apps/console` | human | Builder-facing surfaces | none |
| `apps/api` | human / machine | Agent-to-agent, MCP, public API. Same gates as `web`, different transport | via `settlement` only |
| `apps/jobs` | batch | Scheduled and event-driven tasks — ingestion, verification, rollups, refund sweeps. Retries with backoff, idempotent by key | full |
| `apps/watch` ⚠ | continuous | Always-on. Holds chain subscriptions. **Detects and enqueues. Nothing else.** | **none — forbidden by lint** |

### 5.1 Why `watch` exists and why it is deliberately powerless

Property four (1.5) forces a continuous runtime: intervention latency is a published metric and
a polling interval would cap it artificially.

But an always-on process is also the least supervised thing in the system — it runs unattended
for weeks, and it is the hardest place to reason about failure. So it is given the smallest
possible mandate:

- it **detects** a condition and **enqueues** a job,
- it holds no keys and has no import path to `custody` or `settlement`,
- if it dies, jobs stop being enqueued and that is visible immediately; nothing is left
  half-done, because it never started anything.

Every consequence of what it detects happens inside a retried, logged, observable task.

### 5.2 Composition happens in `apps/`

`apps/jobs` is where a pure decision, a cached observation, an owned-state write and an
irreversible action are combined into one operation. That is the correct place for it: the
composition is visible in one file, and each part is independently testable.

The cost is that a cross-cutting feature touches three or four small files instead of one large
one. That is the trade we are making deliberately, and it is the right one when the code is
being written by agents: small, clearly-labelled, independently-verifiable units beat one file
that does everything.

---

## Part 6 — Ring 3 rules, and the invariants the import graph guarantees

### 6.1 The Ring 3 protocol

Exactly two packages (`custody`, `settlement`) and no app-level exception. Everything in them
obeys all five rules:

1. **Simulate by default.** Every action takes an explicit `mode: "simulate" | "broadcast"`.
   `simulate` is the default. Calling code must ask for `broadcast` in so many words.
2. **Testnet until promoted.** `broadcast` additionally requires an explicit network assertion.
   Mainnet is a deliberate, separate, reviewed promotion — never a config drift.
3. **Human review required.** These paths are owned in `CODEOWNERS`. They cannot be
   auto-merged, by anyone or anything.
4. **Fail at boot, not at sign.** Missing or invalid configuration must stop the process
   starting, not surface at the moment money moves.
5. **Every action produces an evidence record**, including refusals. An action nobody can
   reconstruct afterwards did not happen as far as this product is concerned.

### 6.2 Invariant — scores are re-derivable from raw evidence

**`evidence` may not import `scoring`.**

Enforced by lint. The consequence is that a computed score can never be written into an
evidence row, so evidence stays raw and any score can be recomputed from it at any later date
under any methodology version.

This matters beyond tidiness. Independence weighting is deliberately recomputed at rollup time
against *current* knowledge, not frozen at write time — so a record that looked independent
last month can be discounted harder this month as new information arrives, without any row
being edited. That behaviour is only possible if scores were never baked in, and this import
rule is what makes baking them in impossible.

### 6.3 Invariant — adversarial input is contained

`census` and `agent-registry` are the only packages that touch arbitrary third-party input:
endpoints we do not control, registry entries anyone can write, feedback that is frequently
coordinated and fake.

Nothing they produce reaches `domain/` without crossing a validation boundary in their own
`public/`. One place to harden, one place to audit, one place to look when something malformed
appears downstream.

### 6.4 The forbidden edges, in full

```
strategies (agents repo)  ✗→  scoring · evidence · listings · discovery
evidence                  ✗→  scoring
apps/watch                ✗→  custody · settlement
design-system             ✗→  any service package
any package               ✗→  any app
Ring N                    ✗→  Ring > N
```

Each is a lint rule, not a paragraph. A violation fails the build.

---

## Part 7 — Working in this repository as an agent

### 7.1 Four layers of context

| The question being asked | Where the answer lives |
|---|---|
| *What is this repo, and where does code go?* | `AGENTS.md` at the root, always loaded. Short. Points at everything below. |
| *How careful must I be in this file?* | The ring, visible in the path and declared in the package's `package.json` |
| *How do I do this specific recurring thing?* | `.agents/skills/<name>/SKILL.md` — one per task shape |
| *Why is it like this — may I change it?* | `docs/decisions/*.md`, with `AGENTS.md` mapping which decision binds which package |

`AGENTS.md` stays short on purpose. It is loaded into every session; length there is a tax on
every task. It routes; it does not explain.

### 7.2 Where does this code go?

| I am adding… | It goes in | Ring |
|---|---|---|
| A new entity, state, or transition guard | `domain/` | 0 |
| A change to how scores or confidence are computed | `scoring/` — **and bump the methodology version** | 0 |
| A new category quality metric | `metrics/` | 0 |
| A new way to read the chain or a protocol | `market-data/` | 1 |
| A new registry or indexer source | `agent-registry/` | 1 |
| Anything that probes third-party endpoints | `census/` | 1 |
| A new evidence source | `evidence/` (write path) + `metrics/` if it needs computation | 2 / 0 |
| A change to listing lifecycle | `listings/` for orchestration, `domain/` for the guard itself | 2 / 0 |
| Ranking, filtering, explanations | `discovery/` | 2 |
| Anything that grants, scopes, or revokes authority | `custody/` ⚠ | 3 |
| Anything that moves value or stakes capital | `settlement/` ⚠ | 3 |
| A scheduled or event-driven pipeline | `apps/jobs/` — composition only, logic stays in packages | — |
| A new chain condition to watch for | `apps/watch/` — **detection only, no action** | — |
| A buyer-facing screen | `apps/web/` + components in `design-system/` | — |
| A machine-facing endpoint | `apps/api/` — same guards as `web`, different transport | — |

**If a change seems to need two rings, it needs two files.** That is the design working, not
the design obstructing.

### 7.3 Skills to write

One per recurring task shape, each stating the one correct way and naming the common wrong
ways explicitly:

- writing a scheduled / event-driven task
- adding an evidence source end to end
- adding a chain read adapter
- **writing a Ring 3 action** — the longest and strictest
- adding a category KPI
- adding a state-machine transition and its guard

A skill that only says what to do is half a skill. Naming the plausible-but-wrong alternative
is what actually prevents it.

### 7.4 Decision records

Decisions with a non-obvious rationale get a record in `docs/decisions/`, and `AGENTS.md` maps
each to the packages it binds — so an agent is told *before* editing that a choice here was
deliberate.

At minimum, these need records, because each one is a decision an agent would otherwise
reverse in the name of helpfulness:

- why independence weighting is recomputed at rollup rather than frozen at write time
- why a redeployed agent's track record is treated the way it is
- why we hold no custody, ever
- why our own agents live in a separate repository
- why `watch` cannot sign
- why third-party verification is supplementary and never a hard dependency

### 7.5 Verification loop

Type-check a single package in seconds, not the whole repo in minutes. Slow feedback is a
correctness problem, not a comfort problem: when checking is expensive, agents stop checking
and start asserting, and asserting is how wrong code reaches Ring 3.

---

## Part 8 — Tooling, and what each piece is actually for

| Concern | Choice | Why this one |
|---|---|---|
| Runtime, package manager | Bun, with a root catalog | One version of every shared dependency (3.4) |
| Monorepo orchestration | Turborepo | Per-package filtered tasks — the fast feedback loop of 7.5 |
| Language | TypeScript everywhere | The official wallet-session provider is TypeScript-only; a single language across web, jobs and watch removes a whole class of boundary bugs |
| Database | Postgres, typed schema + migrations | Evidence is append-only and long-lived; schema drift is unacceptable |
| Scheduled / event work | A managed task runner with retries, backoff and observability | Section 3's pipelines *are* retried scheduled tasks. And the product must run unattended for weeks after submission — retries and visibility are requirements, not conveniences |
| Continuous watch | One small always-on process | 5.1 |
| Secrets | Managed store + per-package validation at boot | 3.7 |
| Web | One framework across buyer and builder surfaces | Shared design system, one set of patterns for agents to learn |
| Machine API | A light HTTP framework | The agent-to-agent surface is a first-class product, not an afterthought on the web app |
| Errors, logs, product analytics | Dedicated services, wrapped in `observability/` | Never `console.log`. Unattended operation means logs are the only witness |
| Lint / format | Fast Rust-based tooling, plus custom rules for 6.4 | The forbidden-edge rules are the point; speed is what makes them get run |
| Infrastructure | Declarative infrastructure-as-code | Reproducible, reviewable, and recoverable |

---

## Part 9 — Open decisions, deliberately not settled here

These are real and unresolved. They are listed so nobody assumes silence means agreement.

1. **Web framework.** A single framework across `web` and `console` is settled; the specific
   choice is not formally recorded. Earlier design assumed one; current working practice
   points at another. Decide and write a decision record.
2. **Bootstrap method** — scaffold fresh against these rules, or start from an existing working
   configuration and strip it. Does not change the architecture; changes the first day of work.
3. **Do we need our own on-chain contracts?** Probably eventually — a benchmark attestation and
   a challenge-nonce registry are the two candidates. Not required by anything in Parts 1–8, so
   it stays out until something needs it.
4. **`console` and `web` as one app or two.** Two is cleaner conceptually; one is less to
   deploy and share. Not decided.
5. **How `census` is rate-limited and scheduled** at population scale — a real operational
   design question, not answered by the package boundary alone.
6. **Where the agents repository lives** and how its deployments are configured. Out of scope
   for this document; needs its own.

---

## Part 10 — The short version

If you remember four things from this document:

1. **The ring tells you how careful to be.** Two packages in this repository can move value.
   Everything else, move fast.
2. **Packages are named after jobs, never vendors.** The vendor is inside, unexported, and
   expected to change.
3. **Every rule here is enforced by something that errors.** If you find a rule that is only
   written down, that is a bug in this document — fix it by adding the mechanism.
4. **The agent acts; the marketplace measures; they share no code.** That separation is the
   product's central claim, and the reason it is checkable rather than merely stated.
