---
created: 2026-08-16
project: BUILD-BNB — BNB "Build the Era" marketplace
status: reviewed in chat (two passes — architecture-terms draft, then plain-language rewrite
  per user feedback), approved, written from the approved plain-language version
section: 4 of N — Category Agent Execution Architecture
depends_on: 01-data-model-state-machines.md, 02-module-boundaries-repo-layout.md,
  03-evidence-trust-engine-pipeline.md
---

# Section 4 — Category Agent Execution Architecture

## 4.0 Why these agents exist (resolved design question)

This section exists because of a direct question raised mid-design: *"we're a marketplace,
so why are we building agents ourselves?"* That's a legitimate challenge, resolved as follows
rather than left as an unexamined assumption:

- **The marketplace and the four agents are two different things.** The marketplace
  (Sections 1–3) is agent-agnostic — it discovers, verifies, scores, and lets buyers hire
  *any* agent, ours or a third party's, through one uniform pipeline. The four category
  agents are just the first four **Listings** in that marketplace, built by us, going through
  the exact same Listing/Authorization/Evidence/trust-tier machinery any outside team's agent
  would.
- **It's a sourced hackathon requirement, not a design preference.** The BNB "Build the Era"
  main track judges "Agent Diversity — all 4 categories equal depth," and single-category
  submissions "score poorly by design" (`docs/bnb-hackathon/research-findings.md`, the
  project's own hackathon-research file). A marketplace with an empty shelf across all four
  mandated categories cannot score well regardless of how good the discovery/verification
  layer is.
- **Real third-party supply can't be relied on to fill that gap in time.** The same research
  file cites an academic study finding only ~3% of BSC-registered ERC-8004 agents expose even
  a live, reachable service endpoint (~4% on Ethereum, ~15% on Base) — the real on-chain agent
  ecosystem is overwhelmingly non-functional today. Waiting for genuine third-party agents to
  organically populate all four categories before submission isn't realistic.
- **No special-cased trust path exists anywhere in the design for "our own" agents.** Nothing
  in Sections 1–3's state machines, Evidence sourcing, or trust-tier gating branches on who
  built a Listing. Building the four ourselves is a bootstrap/seeding move and a live
  integration test of the pipeline — not a permanent feature of what a "marketplace" is here.

## 4.1 Dependency map (this section on Sections 1–3)

- **On Section 1**: each agent's actions instantiate the `Job/Service` execution loop already
  defined in 1.4 (cadence table reused verbatim below), produce `Evidence` rows against the
  same source table in 1.5, and drive the same `Listing` state-machine transitions in 1.2 —
  `EXECUTION_VERIFIED` for these listing-types is reached via the marketplace-native fallback
  path or an AACP `PROGRAM` job, exactly as 1.2 already specifies for any capital-touching
  listing. `Authorization` is `ALTANA_SESSION` per 1.3, same as any persistent-service agent.
- **On Section 2**: each agent's decision logic lives in `packages/agent-strategies` (already
  named in 2's package tree, dependency rule `agent-strategies → core-domain,
  chain-adapters/{altana,defi}, db` — no direct AACP import, per 2.2). The execution loop
  itself runs inside `apps/worker/loops/`, per 2.1/2.3's chain-observation channel design —
  this section does not introduce a new runtime location, only fills in what already runs
  there.
- **On Section 3**: every real action an agent takes is written as Evidence through 3.4's
  domain-KPI pipeline (`OUTCOME`, L3–L4) or, when wrapped as an AACP job, through 3.3's
  pipeline (`EXECUTION`, L3, self-dealing guard applies identically). No new Evidence path,
  no new pipeline — this section only supplies the DECIDE-step logic that 3.4's loops read
  chain state into and act on.

No new primary-source facts are introduced in this section — the testnet contract addresses
and the Venus risk formula it uses were already confirmed in Section 3's Verification
Addendum and are only referenced, not re-verified, here.

## 4.2 Common shape: one loop, four fillings

All four agents share one execution loop, run by `apps/worker/loops/<category>.ts`, on a
timer or event subscription per the cadence in 1.4:

```
1. READ    — pull current position/price state from chain, via chain-adapters/defi
2. DECIDE  — pure function: given this state, what should happen? (agent-strategies)
3. ACT     — if action needed, send the transaction, via chain-adapters/{defi,altana}
4. RECORD  — write what happened as Evidence, via the Section 3 pipeline (3.3 or 3.4)
```

Steps 1 and 3 are the only steps that touch the outside world (PancakeSwap, Venus, the
chain) — that's exactly `chain-adapters`'s job per 2.2, so a PancakeSwap/Venus
address or ABI change only ever touches one adapter file, never an agent's decision logic.
Step 2 is a pure function — no network calls, no side effects — callable directly in a unit
test with a fake state object, no testnet RPC required. Step 4 never branches per category:
it's the same Evidence-writing call every category loop makes, per 3.3/3.4.

This is a deliberate instance of the **Hexagonal (Ports & Adapters)** pattern already used
elsewhere in the design (`chain-adapters` is the port; PancakeSwap/Venus/Altana SDKs are the
adapters behind it) combined with the **Modular Monolith** boundary from Section 2
(`agent-strategies` isolated from `chain-adapters`, both isolated from `apps/worker`'s
orchestration) — validated against `senior-architect`'s pattern-selection workflow rather than
picked ad hoc: four independent, narrow-scope loops sharing infrastructure but never each
other's code is exactly the shape that workflow recommends for "well-understood, narrow
domain boundaries, shared platform" (see `references/architecture_patterns.md`, Modular
Monolith / Hexagonal rows), as opposed to over-engineering this into four separate
microservices at hackathon scale.

## 4.3 The four agents, first version (deliberately simple)

Each agent's DECIDE step is a threshold check, not an optimizer — this is a scoping choice,
not a shortcut, explained in 4.5.

| Agent | Reads (step 1) | Decision rule (step 2) | Acts via (step 3) |
|---|---|---|---|
| **Rebalancer** | Wallet's token split (e.g. BNB/USDC balances) vs. configured target split | If actual split drifts more than a configured threshold from target, swap the excess side back to target | PancakeSwap V3 `SwapRouter` |
| **Grid trader** | Current pool price vs. a configured list of fixed price levels | If price crosses an unfilled grid level, place the buy/sell order for that level | PancakeSwap V3 `SwapRouter` |
| **Yield optimizer** | Deposited Venus market's current supply APY vs. other Venus markets' APY | If another market beats the current one by more than a configured margin, withdraw and redeposit there | Venus `vToken` withdraw/deposit |
| **Health-factor monitor** | Venus borrow position's `weightedCollateralUSD` / `debtUSD` | If health ratio drops below a configured safety line, repay debt or add collateral until it's back above target | Venus `vToken` repay/deposit-collateral |

The health-factor monitor reuses Venus's own published formula and thresholds from
`VenusProtocol/venus-agent-skills` (confirmed in Section 3's Verification Addendum:
`health = weightedCollateralUSD / debtUSD`, danger <1.15, target ≥1.30, ≥1.40 for volatile
collateral) rather than inventing risk math — that skill package is used as a reference to
consult, not code vendored in directly, consistent with how it was flagged in Section 3.

Cadence per agent (unchanged from 1.4, restated here for convenience): health-factor is
event-driven (react within seconds of a threshold crossing); rebalancing is
threshold-triggered (act when price exits configured range); grid is continuous
fill-watching; yield is periodic (daily or on-APY-change — lowest frequency, since
reallocation gas/slippage must be justified by the APY gain).

**Threshold numbers are deliberately not pinned in this section.** Drift %, grid spacing,
APY-switch margin, and health-factor safety buffer are config values per agent, not
architectural decisions — they belong in implementation, tuned against real testnet
behavior, not fixed in a design doc before any code exists.

## 4.4 What "acting" means concretely, per capital rail (ties back to 1.3/3.3)

- **Direct marketplace-native action** (default path): the agent's Altana session (1.3,
  `ALTANA_SESSION`) executes the swap/deposit/withdraw/repay directly. This is the primary
  rail — always available, doesn't depend on a third party.
- **AACP-wrapped action** (optional, per action, per 1.4's design): any individual action can
  additionally be wrapped as its own AACP `PROGRAM` job (3.3's pipeline) for independent
  Execution proof — the worker plays Client and Provider (never Evaluator) on that job, exactly
  as 3.3 already specifies. This is not required for the agent to function; it's an optional
  upgrade path to stronger (L3, auto-upgrading to L4) Evidence for a given action, subject to
  AACP's own ~1,000 USDC recommended job-size ceiling (1.7).

No new capital-custody rail is introduced here — both options were already fully specified in
Sections 1 and 3; this section only says which of the four agents' actions are eligible
candidates for AACP-wrapping (all of them, individually, per action, same as any other
persistent-service agent).

## 4.5 Why simple is a deliberate engineering choice, not corner-cutting

The point of building these four first is to prove the **pipeline** works end-to-end with
real chain activity behind it — not to win on strategy sophistication. Keeping DECIDE to a
plain threshold check (not a portfolio optimizer, not an ML model) buys three things
directly relevant to that goal:

1. **Isolates failure.** If something breaks during a testnet run, a trivial decision
   function makes it far more likely the bug is in the pipeline (adapters, Evidence writing,
   state-machine guards) — which is what actually needs proving right now — rather than
   hidden inside strategy logic.
2. **Trivially testable.** "Given price X, expect action Y" is a one-line unit test on a pure
   function, no testnet RPC call needed, per 4.2's step-2 isolation.
3. **Upgradeable without touching the pipeline.** Replacing a threshold rule with something
   smarter later is a change entirely inside `agent-strategies`' step-2 function — the
   READ/ACT/RECORD plumbing, the Listing, and the Evidence pipeline don't change, because
   step 2 is the only place that changed.

## 4.6 What a testnet run of all four proves, end-to-end

Running these four for real on BSC Testnet exercises every piece from Sections 1–3 together
for the first time: agent registers (`Listing` state machine, 1.2) → test wallet authorizes it
(`Authorization`, 1.3) → agent acts (`chain-adapters/defi` hits real PancakeSwap/Venus testnet
contracts, addresses confirmed in Section 3's Verification Addendum) → the action is scored
into `Evidence` (3.3 or 3.4) → `Evidence` rolls up into `Performance`/trust score (3.5). If
this closes cleanly for four simple first-party agents, the same pipeline is proven for a
genuine third-party agent later — no code path in Sections 1–3 is unique to "our" agents, so
there is nothing left to specially validate when a real outside team lists theirs.

## 4.7 Open items carried into implementation (not architectural gaps)

- Exact threshold/config values (4.3) — tuned during build against real testnet price/APY
  behavior, not fixed here.
- Whether to AACP-wrap every action by default or only a sampled subset, for testnet AACP
  staking-capital efficiency (3.3's Client/Provider stake is shared operating capital across
  all four agents' wrapped actions) — an implementation-time operational decision, not a new
  architectural component.
- `venus-agent-skills`' scripts remain a reference to consult for the health-factor and yield
  agents' step-2 logic, not a dependency to vendor in — final call on how much of it to reuse
  directly is deferred to implementation.
