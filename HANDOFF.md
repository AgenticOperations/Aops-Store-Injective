# Handoff Log

Append-only. Each agent session adds a new entry below at session close — what was done,
what's still open, anything the next session needs to know. Never edit or delete prior
entries; correct forward with a new entry if something above turns out wrong.

---

## 2026-08-16 — repo bootstrap

- Initialized git repo, set default branch to `main`, added remote `origin` →
  `https://github.com/AgenticOperations/Aops-Store-BNB.git`.
- Created `.gitignore` (excludes `docs/agent-chats/`, standard Next.js/Foundry/node
  ignores), `README.md`, this `HANDOFF.md`.
- Created `docs/arch-wireframe-v0/01-data-model-state-machines.md` — Section 1 of the
  architecture design (six core objects: Agent/Listing/Authorization/Job-Service/Evidence/
  Performance; state machines; proof taxonomy; rating/scoring formula; AACP integration).
  Verified against primary sources on 2026-08-16 (Altana docs, 8004scan Developer Hub, AACP
  whitepaper + termix-agent-skills repo) — see the Provenance section at the top of that
  file for what was confirmed vs. corrected vs. new. Key decision made during verification:
  AACP integrated as a `PROGRAM`-type verification service only, never as a custody rail —
  its `CEX_CAPITAL` vault-based type has unshipped ("Planned") core contracts, so buyer
  capital stays entirely on Altana's Keystore/session rail.
- Created branch `planning/docs`; docs pushed there first, ahead of any code.
- Still open: Sections 2 onward of the architecture doc (module/repo layout mapping to the
  "three worlds" boundary, evidence/trust engine pipeline detail, category-agent execution
  architecture, hiring-flow/Altana integration detail, build phasing/sequencing) — not yet
  written. This is mid-way through the `superpowers:brainstorming` architectural-path
  process (approaches proposed and approved, Section 1 approved after two revision rounds,
  Sections 2+ not started). No implementation has begun.

## 2026-08-16 — Section 2 written, Section 1 & 3 corrected against live AACP state

- Created `docs/arch-wireframe-v0/02-module-boundaries-repo-layout.md` (package tree,
  `chain-adapters` split by submodule so `apps/web` stays execution-loop-blind, two distinct
  web↔worker channels, state-machine guards centralized in `core-domain`, deployment targets).
- Deep-audited Sections 1–3 directly against primary sources: raw AACP whitepaper text
  (curl'd, not WebFetch-summarized — WebFetch was caught fabricating a plausible-looking but
  non-literal function signature earlier this session), `gh api` reads of the full
  `termix-agent-skills` doc set (14 skill docs), and live `curl` calls to
  `aacp-backend.termix.live` (`/api/v1/config`, `/api/v1/stats`, and several `/api/v1/agents`,
  `/api/v1/jobs` shapes referenced from the skill docs).
- Corrected into `01-data-model-state-machines.md` (Provenance Addendum added): (1)
  `CEX_CAPITAL` is real and shipped (90,329 jobs network-wide) — it's CEX futures trading via
  a TEE, wrong domain for our four categories, not "unshipped" as previously stated; (2) AACP
  PROGRAM-proof evidence level downgraded L4→L3 network-wide — `GET /api/v1/config` returns
  `realGroth16: false`, so Groth16 proof isn't cryptographically enforced yet; designed to
  auto-upgrade to L4 when that flag flips, no schema change needed; (3) new-agent
  `reputationScore` default corrected 50→90 per the live `client-create-job.md` doc (flagged
  as an open discrepancy vs. whitepaper narrative, not fully closed); (4) added the real
  Client-side staking prerequisite (`createJob` reverts with `0x4e236e9a` without it) and the
  real `createJob(...)`/`setBudget(...)` ABI, replacing an assumed `fund()` step; (5) softened
  the Institutional trust-tier's AACP-dependency language to match the L3 finding.
- Wrote `docs/arch-wireframe-v0/03-evidence-trust-engine-pipeline.md` — ingestion, onboarding
  verification, AACP job orchestration (with the corrected ABI/staking/L3 findings baked in
  directly, plus a scheduled `claimRefund` sweep and a self-dealing guard that refuses to
  write Evidence if the Evaluator on one of our own Client/Provider jobs resolves to an
  identity we control), domain-KPI pipeline, performance rollup, sybil/independence
  recomputation, and idempotency/testnet-mainnet-parity posture.
- Investigated whether AACP assigns Evaluators to PROGRAM jobs via VRF or open bidding
  (relevant to how avoidable self-dealing risk is in practice): confirmed Provider assignment
  is Client-discretionary (`client-set-provider` skill, explicit `setProvider` call after
  reviewing submitted offers), but found **no equivalent Evaluator-assignment skill anywhere**
  in the 14-doc `termix-agent-skills` set — no `client-set-evaluator`, no evaluator-side
  browse/offer flow. Treated as evidence (by absence, not by an explicit spec statement) that
  Evaluator assignment is protocol-controlled rather than choosable by either side — this
  reduces but doesn't eliminate self-dealing risk (only 9 evaluators exist network-wide, so
  coincidental self-pairing isn't impossible), so the guard in 3.3/3.6 is built and tested on
  testnet from day one regardless.
- Explained to the user, in more depth and calibrated to a real mainnet deployment (not just
  demo risk): what `AACPStaking.registerEvaluatorStrategy` does, why self-evaluating our own
  jobs is a permanent integrity/anti-collusion-detection problem rather than a testnet-only
  concern, and that registering as a *general-purpose* PROGRAM Evaluator for the wider network
  (never assigned to our own jobs) is a legitimate, valuable, separate move — especially given
  only 9 evaluators exist network-wide.
- Confirmed with the user that the full build (staking, job orchestration, self-dealing guard,
  etc.) should be built and proven entirely on BSC Testnet (chain ID 97, using the AACP
  `Faucet` contract for test USDC) before any mainnet deployment; testnet→mainnet is designed
  as a `chain-adapters/{aacp,defi}` environment-config change only, never a code change —
  stated explicitly in 3.7.
- Committed and pushed Sections 1 (corrected) and 3 (new) to `planning/docs`.
- All three items above were closed in the same session via direct primary-source
  verification (no docs-site summarizing, no inference): BSC-testnet PancakeSwap V3
  addresses confirmed from `pancakeswap/pancake-v3-contracts`'s `deployments/bscTestnet.json`
  (mainnet addresses cross-checked against `bscMainnet.json` and matched what was recorded
  earlier). Yield/health-factor lending protocol confirmed as **Venus Protocol** —
  `VenusProtocol/venus-protocol`'s own testnet (`bsctestnet_addresses.json`, chainId 97) and
  mainnet (`bscmainnet_addresses.json`, chainId 56) deployment manifests. **Notable find**:
  Venus ships an official agent-skills package, `VenusProtocol/venus-agent-skills`, with a
  ready-made health-factor formula (`health = weightedCollateralUSD / debtUSD`, thresholds
  1.15/1.35), an `hf_monitor.py` script, and market/APY tooling — flagged in Section 3 as a
  build accelerator to evaluate for the health-factor and yield category agents rather than
  building that logic from scratch. Altana testnet confirmed via its own `llms.txt` (BNB
  Testnet chain 97, full-stack: keystore, account contracts, relay). 8004scan testnet
  confirmed via a live `GET /api/v1/public/chains` call (`bsc_testnet`, chainId 97,
  `enabled: true`). All findings written into Section 3's Verification Addendum, committed
  and pushed (`cd95fae`).
- Section 4 (category-agent execution architecture) not yet started — now unblocked, since
  every dependency it needs (PancakeSwap testnet, Venus testnet + agent-skills, Altana
  testnet, 8004scan testnet) is confirmed real. `README.md`'s branch-protection/PR-workflow
  note still not added (small, repeatedly deferred, low urgency). No implementation has
  begun.

## 2026-08-16 — Section 4 written (why we build agents, resolved; four category agents' shared execution shape)

- User raised a direct design challenge: "we're a marketplace, why are we building agents?"
  Resolved by separating two concepts that had been implicitly conflated: the marketplace
  (Sections 1–3, agent-agnostic — discovers/verifies/scores *any* agent) vs. the four category
  agents (just the first four Listings in it, built by us, going through the identical
  pipeline any third party's agent would). Grounded the answer in two sourced facts from
  `docs/bnb-hackathon/research-findings.md` (the project's pre-existing hackathon-research
  file, read this session): (1) the main track's judging criteria explicitly require "Agent
  Diversity — all 4 categories equal depth," single-category submissions "score poorly by
  design"; (2) a cited academic study found only ~3% of BSC-registered ERC-8004 agents expose
  a live, reachable endpoint — the real third-party agent ecosystem is overwhelmingly
  non-functional today, so relying on organic third-party listings to fill all four categories
  by submission time isn't realistic. User confirmed: build simple versions of all four now,
  both to satisfy the requirement and to serve as a live end-to-end integration test of the
  Section 1–3 pipeline (Listing → Authorization → Evidence → Performance rollup) with real
  testnet chain activity behind it, before any third-party agent ever lists.
- Wrote `docs/arch-wireframe-v0/04-category-agent-execution-architecture.md`: opens with the
  above resolution (4.0) so it isn't left as an implicit assumption again; dependency map to
  Sections 1–3 (4.1); a shared READ→DECIDE→ACT→RECORD loop shape common to all four agents,
  explicitly validated against the `senior-architect` skill's pattern-selection workflow as a
  Modular-Monolith + Hexagonal(Ports & Adapters) fit rather than picked ad hoc (4.2); the four
  agents' first-version decision rules kept deliberately simple (threshold checks, not
  optimizers) — rebalancer/grid via PancakeSwap V3 `SwapRouter`, yield/health-factor via Venus
  `vToken` actions, health-factor reusing Venus's own published risk formula from
  `venus-agent-skills` (confirmed in Section 3) rather than inventing risk math (4.3); how
  actions route through the existing Altana-session default rail vs. optional AACP-wrapping
  per action, introducing no new capital-custody rail (4.4); an explicit rationale for why
  "simple" is a deliberate engineering choice (isolates pipeline bugs from strategy bugs,
  trivially unit-testable pure DECIDE step, upgradeable later without touching the pipeline)
  (4.5); what a clean four-agent testnet run actually proves about the pipeline (4.6); and
  open items explicitly scoped as implementation-time config decisions, not architectural gaps
  (4.7 — threshold values, AACP-wrap-every-action-vs-sampled question, extent of
  `venus-agent-skills` reuse).
- Followed the standing present→approve→write process: first draft used architecture
  terminology without enough plain-language grounding (user feedback: "i cannot understadn
  what you gave"), rewritten from scratch around concrete examples; user then approved
  proceeding to write it to file.
- Section 5 (hiring flows / Authorization / Altana integration) and Section 6 (build
  phasing/sequencing) remain not started. `README.md` branch-protection note still deferred.
  No implementation has begun.

## 2026-08-16 — Section 5 written (buyer-facing trust UI, hiring flows, Settlement Review,
hosting/`aops` CLI, Watcher)

- User raised the design gap directly: trust-data engine (Sections 1–3) had no buyer-facing
  surface designed at all — "how detailed and in depth can we show the proof of work... this
  should be focused on the marketplace as well from the client and ui perspective." Also
  proposed a Trustpilot/Yelp-style settlement-triggered peer review system, and asked where
  agents actually run/get hosted, floating a marketplace-hosted-cloud tier as a monetizable
  differentiator.
- Researched BNB Agent Studio primary sources before answering (not guessed): fetched the
  `@bnbagent/studio-cli` npm package's own README + 13 bundled skill reference docs via
  `npm pack` (its GitHub source repo, `bnb-chain/bnbagent-studio`, returns 404 — not publicly
  listed, only the compiled npm artifact is inspectable), and the `bnbagent-sdk` repo README
  via `gh api`. Confirmed: `bag` (Agent Studio's CLI) is Commander.js-based and explicitly
  built for automation (`bag deploy --provider aws --yes` supports non-interactive runs); the
  AWS deploy path is delegated to a separate pinned tool authenticating off standard AWS
  credentials (env/profile), not hardcoded per-user — meaning "deploy to AgentOps's own AWS
  account instead of the user's" is the documented self-deploy path pointed at different
  credentials, not a new mechanism. AWS Bedrock AgentCore pricing (pay-per-use,
  vCPU-hour/GB-hour) and BNB's "no AWS account/credit card required" trial were confirmed as a
  capped ~$3,000 promotional campaign, not permanent managed billing — this directly informed
  keeping the four category agents self-hosted in `apps/worker` rather than building a
  competing hosting platform prematurely.
- Delivered a feasibility verdict on the user's proposed `aops` CLI wrapper idea (wrap `bag`,
  offer self-host vs. AgentOps-hosted-with-$5-credit at deploy time) before writing Section 5,
  per the user's explicit sequencing — confirmed feasible, with the concrete mechanism being
  credential-swap on `bag`'s existing delegated AWS deploy path, not a fork or new deploy tool.
- Wrote `docs/arch-wireframe-v0/05-buyer-trust-hiring-hosting.md`: buyer-facing trust UI as
  four layers (agent card / evidence timeline / methodology transparency / category-scoped
  comparison); the four hiring flows with explicit failure paths; a new **Settlement Review**
  Evidence source (settlement-triggered, optional+public for human buyers, policy-enforced
  mandatory structured feedback for agent-to-agent buyers, ties into 1.9's existing
  `economic_relationship_tier` term rather than adding a new scoring path); a **Watcher**
  subsystem for the hosted tier (CloudWatch + independent chain reads, never trusting the
  agent's own self-report); and the hosting-tier/`aops` model with a billing-ledger sketch,
  AWS-quota multi-tenancy handling, and per-agent secret isolation.
- Ran a self-audit pass before writing (user explicitly requested this) and found 9 real gaps
  in the chat-drafted version — missing UI empty-states, an unenforced category-scoping rule,
  an unredacted-payload disclosure risk, missing hiring-flow failure paths, a hand-waved
  agent-hires-agent flow, Settlement Review firing before dispute-window resolution, no
  enforcement mechanism or authenticity binding on reviews, no hosting billing/quota/isolation
  mechanics, and — most substantively — Watcher evidence being scored as if independent when
  it's actually operator-observed (the platform watching its own hosted infrastructure, not a
  third party). All nine fixed inline in the written section, not deferred, since each was a
  correctness/security issue rather than a tuning parameter. Three genuinely
  implementation-time-only items (grace-window length, whether agent-to-agent review
  enforcement is later strengthened to contract-level, exact package placement for the
  hosting ledger/`aops`) are scoped explicitly in 5.8, matching Section 4.7's pattern.
- Section 6 (build phasing/sequencing) remains not started. `README.md` branch-protection note
  still deferred. No implementation has begun.

## 2026-08-24 — Section 4b written (deep strategy models for the four category agents)

- User asked for a review of the plan (Sections 1–5) against the wider research corpus
  (`RESEARCH.md`, `HACKATHON-FIRST-PRINCIPLES.md`, `MARKET-RESEARCH.md`, `LEARN-ONE-DAY.md`,
  `BuildtheERA.md`, `AGENT-ECONOMY.md` — all in the parent `marketplace/` folder, outside this
  repo), then asked for best-in-market agent designs to replace 4.3's threshold rules.
- Wrote `docs/arch-wireframe-v0/04b-category-agent-strategy-models.md`. It **supersedes 4.3's
  decision-rule table only** — 4.2's READ→DECIDE→ACT→RECORD loop, the pure-DECIDE isolation,
  the Section 1–3 dependency map, and the two-rail custody design are all unchanged and were
  re-confirmed as correct. Numbered `04b` deliberately, not `06`, so it does not take the
  Section 6 slot the findings doc reserved for the Discovery Engine.
- Core finding: three of 4.3's four rules route through `SwapRouter`, making every agent a
  **taker** (pays the fee, pays price impact, sandwichable). The maker alternative — a
  one-sided V3 **range order** via `NonfungiblePositionManager` — receives the fee, has no
  price impact, and has nothing to front-run. This is Charm Alpha Vaults' base+limit design,
  needs no hooks and no Infinity, works on PancakeSwap V3 today, and **unifies the rebalancer
  and grid agents onto one adapter surface**. Honest trade-off disclosed in the doc: a range
  order can un-fill if price crosses back, so fill rate becomes a published KPI.
- Second finding: 4.3's Rebalancer reads *wallet token split* and swaps to restore a ratio —
  that is a **portfolio rebalancer**, not an LP-range rebalancer. It never calls
  `NonfungiblePositionManager`. As specified, the hardest mandated category was not covered at
  all. This remains the top unspiked risk in the project (also `RESEARCH.md` §10).
- Third finding: 4.3's health-factor agent says "repay debt or add collateral" — which assumes
  the user holds spare stablecoins, which a user whose collateral is crashing generally does
  not. **Verified fix**: Venus has native flash loans on the BNB Chain Core Pool via a Diamond
  `FlashLoanFacet` (`executeFlashLoan(...)` / `IFlashLoanReceiver.executeOperation(...)`,
  ~0.09% fee, all vTokens except vBNB), with **self-liquidation and deleveraging named as
  intended use cases**. That enables atomic collateral-funded deleveraging requiring zero idle
  capital. Introduces no new custody rail — the flash loan opens and closes inside one tx and
  the Altana session stays the sole rail per 1.3/4.4.
- Fourth finding: 4.3's yield rule has no cost term. Break-even on $10k chasing +1% APR is
  ~110 days (`LEARN-ONE-DAY.md` C2) — the rule loses money while displaying an optimisation.
  Replaced with a net-of-cost + persistence + utilisation-drift gate, Yearn-v3-style marginal
  allocation instead of wholesale switching, and a UI that shows the break-even arithmetic
  **including when the recommendation is "do not move."**
- Fifth finding: 4.3's grid has no inventory model, which is the known blow-up mode (buys all
  the way down, shows positive profit-per-trade while the account bleeds). Added the
  Avellaneda–Stoikov inventory-skew term, a trend-filter suspension, a max-drawdown kill, and
  a ≤20%-per-level cap.
- **New primary-source verification this session** (all via `gh api` against contract repos,
  not docs sites, per this repo's standing discipline):
  - **PancakeSwap Infinity CLAMM is deployed on BSC mainnet AND testnet (chain 97)** — testnet
    `clPoolManager 0x36A12c70c9Cf64f24E89ee132BF93Df2DCD199d4`,
    `clPositionManager 0x77DedB52EC6260daC4011313DBEE09616d30d122`, plus `clQuoter`,
    `clTickLens`, `vault`; mainnet `clPoolManager 0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b`.
    Official CL hooks exist (`limit-order`/`CLLimitOrder.sol`, `dynamic-fee`, `full-range`,
    `geomean-oracle`, `vecake-exclusive`). Section 3's addendum had confirmed **V3 only**.
    **Decision [A]: build on V3 anyway** — the strategies need no hooks, V3 holds the deep
    liquidity, its addresses are already verified, the PancakeSwap-track pitch is a V3 story
    (retired Position Manager), and `CLLimitOrder` is *not* in Infinity's official deploy
    scripts so using it means maintaining a hook ourselves. Hedge scoped as Tier 3: mint one
    Infinity CLAMM position on testnet and surface it.
  - **`venus-agent-skills` read in full** — carries risk heuristics beyond the HF formula
    (concentration >70%, borrow liquidity <2× requested, utilisation >85%, +0.10 event
    buffer), is **simulate-by-default with an explicit `--confirm YES` broadcast guard**, and
    prescribes user-facing language ("estimated", never "safe for sure"). Notably it
    **monitors and simulates but does not intervene** on health factor — the sponsor's own
    reference agent stops at telling you, which is precisely the space our agents occupy.
  - **Altana's ten production skills contain no V3 range-management skill** (its PancakeSwap
    Liquidity skill is V2, and V2 pools have no ranges). So both of the two hardest mandated
    categories have no off-the-shelf path from any sponsor.
- 4b.8 fills a hole identified in the same review: Section 1.9's `metric_ontology_key` said
  "or a category-specific KPI" and never defined one — which is exactly where the rubric's
  *Agent Diversity / equal depth* axis lives. 4b.8 now defines primary/risk/cost/honesty KPIs
  per category, written through 3.4's existing pipeline with no schema change.
- 4b.10 tiers the work against the 16 days remaining (submissions close 2026-09-09). Tier 1 is
  four decision-logic changes plus one real engineering item (V3 range management), which goes
  first because it is the top risk and still unspiked.
- **Still open, and raised in the same review but NOT yet addressed in any doc**: (1) Section
  1.2's state machine has no defined `DISCOVERED → CLAIMED` transition, so nothing from the
  ~200k BSC agent population can ever reach `LIVE` without its owner acting — there is no
  liveness/ingestion crawl anywhere in Sections 1–5; (2) the trust ladder deadlocks for
  third-party agents (Verified needs EXECUTION evidence, which only arrives via being hired or
  hosted); (3) `version_hash` reset lets a bad agent launder its record by redeploying
  (GIPS survivorship-bias problem, named in `MARKET-RESEARCH.md` §4a); (4) the L6 benchmark —
  TermiX's eligibility gate and the top of our own trust stack — exists only as a table row,
  with no pipeline; (5) no post-hire console, so Altana's explicit "user can see what their
  agent may do, and revoke it, inside your product" requirement has no design.
- Section 6 (Discovery/Ranking) and Section 7 (build phasing) remain not started. `README.md`
  branch-protection note still deferred. No implementation has begun. **File is written but
  not committed** — left on the working tree of `planning/docs` for review first.
