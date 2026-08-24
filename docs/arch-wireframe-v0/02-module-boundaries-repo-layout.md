---
created: 2026-08-16
project: BUILD-BNB — BNB "Build the Era" marketplace
status: SUPERSEDED for repo topology, package tree, and web↔worker communication — see
  00-repo-architecture-and-agent-conventions.md and docs/decisions/0001-agents-repo-separation.md.
  This file assumed the four category agents run inside this repository (apps/worker/loops,
  packages/agent-strategies); Decision 0001 moved them to a separate repository. The
  guard-placement principle in 2.4 (pure functions, called identically by every surface) is
  still correct and now lives in Section 0's domain/ package. Kept for history, not as a build
  reference.
section: 2 of N — Module Boundaries & Repo Layout
depends_on: 01-data-model-state-machines.md
---

# Section 2 — Module Boundaries & Repo Layout

> **⚠ Superseded.** Do not build against this file's package tree (2.1) or communication design
> (2.3) — see the status note above. Section 1's data model and state machines, which this
> section only organizes, are still current.

## Audit notes (fixes made before this file was written)

The first draft of this section was presented in chat and provisionally approved, conditional
on an end-to-end audit against Section 1's object model. Three gaps were found and fixed here,
not carried forward as-is:

1. **`apps/web` cannot be `chain-adapters`-blind.** The hiring flow's `grantSession` call
   (1.3), the discovery/search UI against 8004scan, and the Agent-to-Agent API (another agent
   hiring ours, 1.4) all need to run from `apps/web` directly — routing them through the worker
   would add a request hop with no benefit and would make `apps/web` unable to construct a
   session grant a buyer's wallet needs to sign in the browser. Fix: `chain-adapters` is split
   by submodule, and `apps/web` is allowed to depend on the read/user-action-oriented
   submodules (`altana`, `erc8004`, `8004scan`) but not the execution-loop-only ones (`aacp`,
   `defi`) — see 2.2.
2. **"Communicate only through Postgres" was true for one channel, not two.** Section 1.4's
   event-driven health-factor cadence (react within seconds of a threshold crossing) cannot be
   built on `apps/web` writing a row and `apps/worker` polling/`LISTEN`ing Postgres — nothing
   ever writes that row; the trigger is on-chain state, not a marketplace action. Fix: two
   distinct channels are named explicitly in 2.3, not one.
3. **No stated owner for the state-machine guards.** Section 1.2–1.4 define real guards
   (signature checks, endpoint-uptime checks, spend-cap checks) for Listing/Authorization/
   Job-Service transitions. Left unassigned, they'd get implemented twice — once in
   `apps/web` to reject invalid buyer actions synchronously, once in `apps/worker` to drive its
   own loop — and drift apart. Fix: guards are pure functions in `core-domain`; both runtimes
   import and call the same functions. See 2.1.

---

## 2.1 Package tree

```
BUILD-BNB/
├── apps/
│   ├── web/                      # Next.js — only user-facing + Agent-to-Agent runtime
│   │   ├── app/                  # UI routes: discovery, agent card, hiring flow, dashboard
│   │   ├── api/                  # REST/A2A routes: search, hire, authorize, listing CRUD
│   │   └── ...
│   └── worker/                   # persistent Node process — the only other runtime
│       ├── loops/                # per-category execution loops (1.4)
│       ├── ingestion/            # agentURI resync, ERC-8004 feedback pull, 8004scan pull
│       ├── verification/         # onboarding tests, AACP job orchestration, fallback path
│       └── scoring/              # Performance rollup cron (1.6, 1.9)
│
├── packages/
│   ├── core-domain/               # zero internal deps
│   │   ├── entities/              # Agent, Listing, Authorization, Job, Evidence, Performance types
│   │   ├── state-machines/        # pure guard functions — imported by both apps, no I/O
│   │   └── scoring/                # weight()/score()/confidence() formula (1.9), pure
│   │
│   ├── chain-adapters/             # ONLY place raw external SDKs are imported
│   │   ├── erc8004/                # Identity/Reputation/Validation registry calls
│   │   ├── altana/                 # sessions, ERC-8183 SDK, x402 server SDK
│   │   ├── 8004scan/                # REST client
│   │   ├── aacp/                   # Client+Provider+Evaluator-role calls (see 2.2)
│   │   └── defi/                   # PancakeSwap / lending-protocol calls per category agent
│   │
│   ├── evidence-engine/            # Evidence writes, Performance rollup, sybil/independence (1.10)
│   ├── agent-strategies/           # the 4 category agents' decision logic (rebalance/grid/yield/HF)
│   └── db/                         # schema + migrations + typed client; Postgres LISTEN/NOTIFY helpers
│
├── contracts/                      # Foundry — only if the marketplace itself needs on-chain pieces
│                                    # (challenge-nonce registry, marketplace-run benchmark attestation)
│
└── docs/arch-wireframe-v0/
```

---

## 2.2 Dependency-direction rule (revised)

```
core-domain          → nothing internal
chain-adapters/*      → core-domain only. Raw external SDKs (Altana SDK, ERC-8183 SDK,
                        8004scan REST, AACP contracts/API, PancakeSwap/lending SDKs) are
                        imported HERE ONLY, nowhere else in the tree.
evidence-engine       → core-domain, db. Never imports chain-adapters directly — it consumes
                        Evidence rows already written, it doesn't produce chain calls itself.
agent-strategies      → core-domain, chain-adapters/{altana,defi}, db.
apps/worker           → everything. Owns chain-adapters/{aacp,defi} exclusively — no other
                        package or app may import these two submodules.
apps/web              → core-domain, evidence-engine (read-only queries), db,
                        chain-adapters/{altana,erc8004,8004scan} (read + user-initiated-action
                        calls: grantSession construction, discovery search, feedback lookup).
                        apps/web MUST NOT import chain-adapters/{aacp,defi} or agent-strategies
                        — no execution-loop logic, no direct AACP job orchestration, ever runs
                        in the serverless request path.
```

`aacp`'s submodule internally exposes both Client-side calls (`createJob`, `fundEscrow`,
role = marketplace acting on buyer's behalf) and Provider-side calls (`setProvider`, `submit`)
per Section 1.7 — one adapter, role selected by which credentials/context the caller passes in,
not two separate packages. Only `apps/worker` calls it, in both roles, since the marketplace is
simultaneously Client (for `AACP_PROGRAM`-variant tasks) and Provider (for wrapping the category
agents' own actions).

---

## 2.3 Web ↔ worker communication — two channels, not one

1. **Command/state channel (Postgres, via `packages/db`)**: `apps/web` writes rows — new
   Listing, Authorization granted/revoked, Job paused, onboarding-test request — and
   `apps/worker` reacts via `LISTEN/NOTIFY` (polling as an explicit fallback if a given
   Postgres host doesn't support long-lived `LISTEN` connections, e.g. some serverless Postgres
   tiers). This is the only channel `apps/web` uses to reach the worker; `apps/web` never opens
   its own chain-monitoring subscriptions or drives an execution loop itself.
2. **Chain-observation channel (direct, via `chain-adapters`, worker-only)**: each category
   loop in `apps/worker/loops/` subscribes to or polls chain state directly per its own cadence
   (1.4) — health-factor via event subscription, rebalancing/grid via threshold polling, yield
   via periodic re-evaluation. This never touches Postgres to detect the trigger; Postgres is
   only written to *afterward*, to record the resulting Evidence row. `apps/web` has no
   visibility into this channel except by reading the Evidence/Performance rows the worker
   produces.

These two channels only meet at the database: channel 1 is Postgres-native by construction;
channel 2 is chain-native by construction and Postgres only on its output side.

---

## 2.4 State-machine guards live in `core-domain`

Every guard listed in Section 1.2–1.4 (ownership-signature check, endpoint-uptime check,
spend-cap/circuit-breaker check, `Authorization.expiry` check, etc.) is a pure function in
`core-domain/state-machines/`, taking the current entity state plus whatever evidence/context
it needs and returning an allowed-transition decision — no I/O, no chain calls, no DB access
inside the guard itself. Both runtimes call the same functions:

- `apps/web` calls them synchronously in its API routes to reject an invalid buyer action
  before writing anything (e.g. refuse to grant Authorization if `Listing.trust_tier` is below
  the buyer's stated minimum — 1.3's hiring gate).
- `apps/worker` calls them inside its loops to decide its own next transition (e.g. whether an
  observed endpoint failure is enough consecutive ticks to move `LIVE → DEGRADED`).

The data needed to evaluate a guard (uptime tick count, current spend, trust tier) is fetched
by the caller via `chain-adapters`/`db` and passed in — the guard function itself stays testable
in isolation, with no mocking of chain or DB required.

---

## 2.5 Deployment targets

- `apps/web` → Vercel-shaped serverless host (Next.js default target).
- `apps/worker` → Railway, as a long-running service (not a cron-only job — the category loops
  and chain subscriptions need a persistent process). Railway MCP tooling is already available
  in this environment for provisioning.
- Both point at the same Postgres instance (`packages/db`'s single schema — no per-app DB
  split, since the command/state channel in 2.3 depends on both runtimes seeing the same rows).
- `contracts/` (Foundry) deploys independently, via its own CI step, to BSC testnet — not tied
  to either app's deploy pipeline.
