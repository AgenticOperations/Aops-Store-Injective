---
created: 2026-08-16
project: BUILD-BNB — BNB "Build the Era" marketplace
status: audited against Sections 1 and 2, and against live AACP testnet API + raw whitepaper
  text, before being written (see Audit Notes and Dependency Map)
section: 3 of N — Evidence / Trust Engine Pipeline
depends_on: 01-data-model-state-machines.md, 02-module-boundaries-repo-layout.md
---

# Section 3 — Evidence / Trust Engine Pipeline

## Dependency map (this section on Sections 1–2)

- **On Section 1**: every pipeline below exists to write one of the seven `Evidence` rows in
  1.5's source table, drive one of Listing's guarded transitions (1.2), or compute
  Performance/score per 1.6/1.9/1.10. The AACP job-orchestration pipeline (3.3) is a direct
  build-out of 1.7's Client/Provider/Evaluator roles and the corrected `createJob`/
  `setBudget` ABI, staking prerequisites (Client- and Provider-side), and L3 evidence level
  now stated there. Nothing here introduces a new Evidence source or a new state-machine
  transition beyond what Section 1 already defines.
- **On Section 2**: every pipeline runs inside `apps/worker` (2.1) — ingestion in
  `apps/worker/ingestion/`, onboarding verification in `apps/worker/verification/`, AACP
  orchestration also in `apps/worker/verification/` (the only caller of
  `chain-adapters/aacp`, per 2.2's dependency-direction rule), and rollup in
  `apps/worker/scoring/`. State-machine guards invoked mid-pipeline call the same
  `core-domain/state-machines/` pure functions `apps/web` uses synchronously (2.4) — no
  guard logic is duplicated here. The two Section 2.3 channels both terminate in these
  pipelines: the command/state channel (Postgres) triggers the onboarding-verification and
  AACP-orchestration pipelines; the chain-observation channel directly feeds the
  domain-KPI pipeline (3.4).

---

## Audit notes (fixes made before this file was written)

This section was presented in chat once already; a deep re-verification pass against the raw
AACP whitepaper, live `gh api` reads of `termix-agent-skills`, and live `curl` calls to
`aacp-backend.termix.live` surfaced corrections, folded in below rather than carried forward
as originally drafted:

1. **`createJob`/`setBudget`, not a `fund()` step.** The real ABI is
   `createJob(clientId, budget, deadline, strategyType, programHash, rubricHash) → jobId`,
   funding via a separate `setBudget(jobId, amount)` call. 3.3 reflects this.
2. **Client-side staking is a hard prerequisite, not just Provider-side.** `createJob`
   reverts with selector `0x4e236e9a` if the Client (our marketplace) has no staking pool
   with ≥100 USDC. 3.3 states this as a deploy-blocking precondition, not an optional
   hardening step.
3. **`claimRefund` needs a scheduled sweep.** `Funded`/`Submitted` jobs that never reach a
   terminal state (Evaluator never shows up, Provider stalls) sit as locked Client/Provider
   stake and locked buyer-adjacent budget until someone calls `claimRefund`. Nothing in the
   protocol calls this automatically. 3.3 now names this as a required cron job, not an
   edge case.
4. **PROGRAM-evaluator assignment: protocol-controlled, not Client- or Evaluator-
   discretionary — confirmed by absence, not by a positive spec statement.** The full
   `termix-agent-skills` doc set (14 skill docs) includes an explicit `client-set-provider`
   skill — the Client calls `ACPCore.setProvider(jobId, providerId)` to *deliberately choose*
   which Provider (from those who submitted offers via `provider-browse-jobs`/
   `provider-submit-offer`) gets the job. **No equivalent skill exists for assigning an
   Evaluator** — there is no `client-set-evaluator`, no `evaluator-browse-jobs`, no
   evaluator-side offer-submission doc anywhere in the skill set. `provider-submit.md`
   states only that "the Evaluator will now be able to call `evaluate()`" once a job reaches
   `SUBMITTED`, with no mechanism shown for how that Evaluator got attached to the job. This
   is consistent with — though not a direct positive confirmation of — Evaluator assignment
   being protocol-automatic (plausibly VRF-style, matching the confirmed VRF selection for
   the `human` consensus mode and for Arbitrators in disputes) rather than something either
   side can choose. **Practical conclusion**: neither our Client identity nor a
   self-registered Evaluator identity we control appears to have a documented lever to
   *deliberately* pair the two on the same job — this meaningfully reduces, but by whitepaper
   silence rather than explicit denial, the risk that a self-dealing pattern could be
   engineered on purpose. It does not eliminate the possibility of *coincidental* self-pairing
   (network currently has only 9 evaluators total), so the guard in 3.3 stays mandatory
   regardless of which mechanism turns out to be true.
5. **AACP evidence level is L3, not L4, pending `realGroth16`.** Carried through from
   Section 1's Provenance Addendum — 3.3's Evidence-writing step stamps L3, with the
   worker reading the live feature-flag at ingestion time so the stamp auto-upgrades to L4
   without a code change once `realGroth16: true` on the integrated deployment.
6. **Testnet-to-mainnet parity is a stated constraint, not an implicit assumption.** All of
   AACP (`aacp-backend.termix.live`, BSC Testnet chain ID 97), the `Faucet` contract for test
   USDC, and (pending confirmation) Altana/8004scan's own testnet endpoints, exist so the
   entire pipeline below — including staking, job orchestration, and the self-dealing guard —
   can be built and proven on testnet before any mainnet deployment. 3.7 states this
   explicitly: `chain-adapters/aacp` and `chain-adapters/defi` take contract addresses/RPC
   URLs from environment config only, never hardcoded, so testnet→mainnet is a config change,
   not a code change.

---

## 3.1 Ingestion pipeline (`apps/worker/ingestion/`)

Three idempotent, diff-based pulls, each on its own interval:

- **agentURI resync** — re-fetches each tracked Agent's `agentURI`, diffs against the stored
  `version_hash` (1.1). A change triggers the version-boundary reset (new version restarts at
  Basic trust tier, per 1.1) — this pipeline only detects the change and writes the new
  `Agent` row; it does not itself re-run onboarding verification (3.2 owns that, triggered
  off the same event).
- **ERC-8004 feedback pull** — pulls new feedback events from the Identity/Reputation
  registries, writes each as an `Evidence` row at L1 (1.5's table), sybil-discounted at read
  time by 1.10, never at write time.
- **8004scan pull** — pulls aggregate reputation/discovery data via the REST client
  (`chain-adapters/8004scan`), used for cross-referencing, not written as its own Evidence
  source (no L-level assigned to raw 8004scan pulls in 1.5's table — it's a discovery/
  cross-check input, not a scored evidence source).

All three are diff-based against last-seen state, so a re-run after a crash or restart is
naturally idempotent — no duplicate Evidence rows, no double-counted version transitions.

---

## 3.2 Onboarding verification pipeline (`apps/worker/verification/`)

Triggered by the command/state channel (2.3.1) when `apps/web` writes a new Listing row, or
by 3.1's agentURI-resync detecting a version change:

1. Runs the endpoint-uptime check (1.2's `OWNERSHIP_VERIFIED → ENDPOINT_VERIFIED` guard) —
   3 consecutive successful ticks, calling the `core-domain/state-machines` guard function
   with freshly-fetched uptime data (2.4).
2. Runs the marketplace onboarding execution test — a safe, non-capital test invocation
   scoped to the Listing's category — and on success writes an Evidence row at L2
   (`CAPABILITY`, 1.5's table) and drives the guard call for
   `ENDPOINT_VERIFIED → CAPABILITY_VERIFIED`.
3. Stops here — `CAPABILITY_VERIFIED → EXECUTION_VERIFIED` is listing-type-dependent (1.2)
   and, for capital-touching listing types, is owned by 3.3, not this pipeline.

---

## 3.3 AACP job-orchestration pipeline (`apps/worker/verification/`, `chain-adapters/aacp`)

The only place in the entire codebase `chain-adapters/aacp` is imported (2.2). The worker
plays two roles here, per 1.7 — Client (marketplace, on behalf of the buyer) for
`AACP_PROGRAM`-variant escrow, and Provider (wrapping a category agent's own action) — never
Evaluator for a job it also touches as Client or Provider (see Audit Note 4 and the guard
below).

**Preconditions, both deploy-blocking, not optional hardening:**
- The marketplace's own Client identity must hold an AACP staking pool with ≥100 USDC
  (Section 1's `0x4e236e9a` revert finding) — funded and monitored as its own operating-
  capital line, separate from the category-agent Provider identity's stake.
- The category-agent Provider identity must independently hold ≥100 USDC staked.

**Lifecycle, real ABI (Section 1's Provenance Addendum, Audit Note 1):**

1. `createJob(clientId, budget, deadline, strategyType=PROGRAM, programHash, rubricHash) →
   jobId` — worker acting as Client.
2. `setBudget(jobId, amount)` — funds escrow; job moves `Open → Funded`. Can revert
   (`Rejected`) pre-fund if the Client-side guard checks fail.
3. `setProvider(jobId, providerId)` — worker (Client) deliberately assigns its own
   category-agent identity as Provider (this is a documented, Client-discretionary call —
   see Audit Note 4 — so this pairing, Client=us/Provider=us, is intentional and expected;
   it's the *Evaluator* side that must never also resolve to an identity we control).
4. Category agent executes its real action under the Altana session (1.4); worker computes
   `deliverableHash`, calls `submit(jobId, deliverableHash)` — job moves `Funded → Submitted`.
5. An Evaluator (assignment mechanism per Audit Note 4 — protocol-controlled, not chosen by
   either side as far as the documented skill set shows) calls `evaluate()`/`complete()` —
   job moves `Submitted → Completed`. On success, the worker writes an `EXECUTION` Evidence
   row at **L3** (not L4 — `realGroth16: false` on testnet; auto-upgrades to L4 when the
   integrated deployment flips that flag, per Section 1's Provenance Addendum), with
   `verification_ref = {aacp_job_id, evaluator_address, proof_hash}` (1.5).
6. **Self-dealing guard, enforced regardless of how Evaluator assignment actually works**:
   before writing the Evidence row in step 5, the worker checks `evaluator_address` against
   the set of agent identities the marketplace itself controls (its own registered Evaluator
   identity, if any, per the earlier design discussion). If they match, the worker does
   **not** write the Evidence row as a valid independent proof — it logs the anomaly, treats
   the job as unresolved for evidence purposes, and falls back to the marketplace-native
   verification path (1.2) instead. This is built and tested on testnet from the start (not
   deferred to a pre-mainnet hardening pass) — see Audit Note 6.
7. **Scheduled `claimRefund` sweep** (Audit Note 3): a cron in `apps/worker/verification/`
   periodically scans Client- and Provider-role jobs stuck in `Funded`/`Submitted` past their
   deadline and calls `claimRefund` to unlock stake and budget. Without this, a stalled
   Evaluator (or a Provider that never submits) permanently locks operating capital — this is
   a required piece of the pipeline, not a nice-to-have.
8. **Dispute path**: within AACP's 48h post-terminal-state window, either side may dispute
   (5% budget deposit, 5 USDC floor); resolution is VRF-selected 3-arbitrator commit/reveal
   voting (confirmed via `check-dispute.md`) — the worker does not automate dispute-filing in
   v0; it surfaces `DISPUTED` jobs for manual review only.

**Minimum-strategy sizing** (1.7): individual wrapped actions are kept under AACP's own
~1,000 USDC PROGRAM-strategy recommended ceiling; larger actions use the marketplace-native
fallback path instead of forcing AACP outside its own recommended range.

---

## 3.4 Marketplace-computed domain KPI pipeline (`apps/worker/loops/` output → `evidence-engine`)

Each category loop (2.1, cadence per 1.4) reads chain state directly via
`chain-adapters/defi` and writes an `OUTCOME` Evidence row at L3–L4 (1.5) on every real
action:

- **Rebalancing/grid**: PancakeSwap V3 contracts — mainnet addresses confirmed
  (`PancakeV3Factory 0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865`,
  `NonfungiblePositionManager 0x46A15B0b27311cedF172AB29E4f4766fbE7F4364`, plus SwapRouter/
  QuoterV2/TickLens/MasterChefV3) via `developer.pancakeswap.finance/contracts/v3/addresses`.
  **BSC-testnet-specific addresses for these same contracts are still unconfirmed** — the
  table didn't extract cleanly from the fetched page; this stays an open item to close before
  Section 4 depends on it (flagged, not guessed).
- **Yield/health-factor**: lending-protocol identity (candidate: Venus) is **unverified** —
  explicitly not fact-checked this session. Also required to close before Section 4.

---

## 3.5 Performance rollup cron (`apps/worker/scoring/`)

Runs on a schedule, computes `score`/`confidence` (1.9) per
`(agent_id, version_hash, category, metric_ontology_key)` from all Evidence accumulated since
the last rollup, appends new `Performance` rows (never overwrites — 1.6). `methodology_version`
is pinned per row so every score stays re-derivable from raw Evidence at any later point.

---

## 3.6 Sybil/independence scoring — recomputed at rollup time, not write time

`independence_confidence` (1.10) is deliberately **not** baked into an Evidence row at write
time — it's computed by the rollup cron (3.5) against the *current* wallet-cluster/timing/
reciprocal-pair state. This means a Performance score is **not strictly monotonic** with time
for a fixed Evidence set: a review that looked independent when the rollup last ran can become
retroactively more suspicious (and get discounted harder) as new wallet-cluster evidence
accumulates, even though the underlying Evidence row never changes. This is intentional
(1.10's design) and is called out explicitly here so it isn't mistaken for a bug later.

---

## 3.7 Pipeline-wide idempotency and testnet/mainnet parity posture

- **Idempotency**: 3.1's pulls are diff-based against last-seen state; 3.2/3.3's writes are
  keyed to the triggering Listing/Job so a re-run after a crash doesn't duplicate an Evidence
  row; 3.5's rollup is naturally idempotent (append-only, re-derivable, keyed to
  `methodology_version`).
- **Testnet/mainnet parity** (Audit Note 6): `chain-adapters/aacp` and `chain-adapters/defi`
  read all contract addresses and RPC URLs from environment configuration — sourced live from
  `GET /api/v1/config` for AACP, and from environment variables for PancakeSwap/lending
  addresses — never hardcoded in application code. The entire pipeline above, including
  staking, job orchestration, and the self-dealing guard, is built and proven end-to-end on
  BSC Testnet (chain ID 97) first; moving to mainnet is a configuration change to
  `chain-adapters/{aacp,defi}`'s environment, not a code change to any pipeline in this
  section.

---

## Verification addendum (2026-08-16) — all three prior open items closed

All three items previously carried forward as open/unverified are now closed, each against a
primary source, not a docs-site summary:

1. **BSC-testnet PancakeSwap V3 addresses — confirmed**, from PancakeSwap's own
   `pancakeswap/pancake-v3-contracts` repo, `deployments/bscTestnet.json` (ground truth, not
   the docs site — which turned out to be a client-rendered SPA with no server-side content
   to scrape, so the earlier "confirmed via docs site" mainnet addresses were re-verified
   against `deployments/bscMainnet.json` from the same repo and matched exactly):
   `PancakeV3Factory 0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` (same address both chains),
   `NonfungiblePositionManager 0x427bF5b37357632377eCbEC9de3626C71A5396c1` (testnet — differs
   from mainnet's `0x46A15B0b27311cedF172AB29E4f4766fbE7F4364`), `SwapRouter
   0x1b81D678ffb9C0263b24A97847620C99d213eB14` (same both chains), plus `QuoterV2`, `TickLens`,
   `MasterChefV3`, `V3Migrator`, `PancakeV3PoolDeployer`, `NonfungibleTokenPositionDescriptor`,
   `PancakeInterfaceMulticall` — all confirmed per-chain in the same manifest.
2. **Yield/health-factor lending protocol identity — confirmed as Venus Protocol**, via
   `VenusProtocol/venus-protocol`'s `deployments/bsctestnet_addresses.json` (chainId 97,
   `Unitroller 0x94d1820b2D1c7c7452A163983Dc888CEC546b77D`, `vBNB
   0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c`) and `bscmainnet_addresses.json` (chainId 56,
   `Unitroller 0xfD36E2c2a6789Db23113685031d7F16329158384`). **Significant additional find**:
   Venus ships its own official agent-skills package,
   `VenusProtocol/venus-agent-skills` (`skills/venus-protocol-ops/`), purpose-built for
   exactly our health-factor and yield categories — read-only risk analysis, health-factor
   monitoring (`scripts/hf_monitor.py`, default safety line 1.2), market/APY comparison
   (`scripts/fetch_markets.py`, official API `api.venus.io`, confirmed mainnet-only —
   `chainId=56` in its own verified-endpoints notes; testnet market-data API availability is
   not confirmed, but on-chain reads work on testnet regardless since the contracts are
   deployed there), and simulate/execute scripts for deposit/withdraw/borrow/repay/collateral
   actions. Its documented risk formula — `health = weightedCollateralUSD / debtUSD`,
   thresholds High <1.15 / Medium 1.15–1.35 / Low ≥1.35 — is a directly reusable reference
   point for our own health-factor category agent's guard logic (Section 4). This should be
   evaluated as a build accelerator for that category, not re-derived from scratch.
3. **Altana testnet — confirmed**, directly from `docs.altana.network`'s own `llms.txt`:
   "BNB Smart Chain Testnet (chain id 97) is Altana's full-stack testnet — the keystore,
   account contracts, and the Altana testnet relay are all deployed there," with a
   ready-made `BNB_TESTNET` SDK config.
4. **8004scan testnet — confirmed**, via a live call to
   `GET https://8004scan.io/api/v1/public/chains`: `{"chain_key":"bsc_testnet","chain_id":97,
   "name":"BSC Testnet","is_testnet":true,"enabled":true,"provider_status":"available"}`.

Testnet-first, full end-to-end (Altana + 8004scan + AACP + PancakeSwap + Venus, all four
category domains), is now confirmed supportable with no remaining unverified dependency.
