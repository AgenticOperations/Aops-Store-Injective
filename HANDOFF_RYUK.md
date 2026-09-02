# Handoff Log — Ryuk

Append-only. Each agent session adds a new entry below at session close — what was done,
what's still open, anything the next session needs to know. Never edit or delete prior
entries; correct forward with a new entry if something above turns out wrong.

> Split from a single shared `HANDOFF.md` on 2026-08-24, when the two-collaborator
> (Ryuk/KC) workflow was formalized. Every entry below this note predates the split and was
> written during sessions driven by Ryuk — attributed here on that basis, not because each
> entry says so explicitly. If any entry below actually belongs to KC, move it to
> `HANDOFF_KC.md` rather than editing it in place. See `CLAUDE.md` for the split rule going
> forward.

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

## 2026-08-24 — Section 0 written (repository architecture & agent conventions)

- Design discussion, not a research session. User set two framing constraints that drove
  everything: (1) **this is the production repo — the Sep 9 submission is a checkpoint, not
  the goal**, and (2) **the repo will be built by coding agents, so it must be fast and
  unambiguous for an agent to understand.** Constraint (2) is treated as a first-class
  engineering requirement in the doc, not a documentation nicety.
- Wrote `docs/arch-wireframe-v0/00-repo-architecture-and-agent-conventions.md`. Numbered `00`
  deliberately: it precedes Section 1 because it says where code goes and how careful to be.
- **Primary carve is ownership + reversibility, not feature nouns.** Four rings: Ring 0 pure
  (no I/O — domain, scoring, metrics) · Ring 1 observation (read-only, output is a cache —
  agent-registry, census, market-data) · Ring 2 owned state (database, evidence, listings,
  discovery) · Ring 3 irreversible ⚠ (custody, settlement). Dependencies run downward only.
  Rationale: a wrong scoring weight is a bug; a wrong `grantSession` is money gone. Carving by
  feature would put both in one folder and erase the only signal telling an editor how careful
  to be. 16 packages, 5 apps.
- **Four decisions taken in the discussion, each recorded in the doc:**
  1. *Production repo, deadline secondary* — removes the setup-cost objection to fine-grained
     packages and means Zone-B safety work gets built properly rather than cut.
  2. *Continuous watch runs as one always-on process, and is deliberately powerless* —
     `apps/watch` holds chain subscriptions, **detects and enqueues only**, holds no keys, and
     has no import path to Ring 3 (lint-enforced). Needed because intervention latency is a
     published KPI (4b.7) and a polling interval would cap a number we ask buyers to judge us
     on.
  3. **The four category agents move OUT of this repo entirely** — each becomes an independent
     deployable with its own wallet, on-chain identity and endpoint, discovered and hired
     through the same public path a stranger's agent uses. This turns Section 4.0's
     "no special-cased trust path" from an argument into a checkable fact (no import path
     exists because the code is not in the tree), and makes us the first third party through
     our own onboarding flow. Consequence: `strategies` and `market-execution` leave; this
     repo's irreversible surface shrinks to **two packages**. `metrics/` stays here, because
     measurement is the marketplace's job and the agent must never compute its own score.
  4. *One doc, in this repo* — rather than a separate reference doc.
- **Package rules**: `public/` + `private/` enforced by `package.json` `imports`/`exports` (not
  importable from outside — module resolution, not convention) · capability names never vendor
  names (vendor surface is volatile: wallet layer swapped, verification flag pending, DEX
  shipped a new architecture, lending protocol shipped flash loans — all during design alone)
  · catalog for shared dep versions · thin transport (four surfaces must enforce the same
  gates, so guards live in `domain/` and every surface calls the same function) · per-package
  `keys.ts` failing at boot · colocated tests.
- **Two invariants the import graph now guarantees**, both lint-enforced: `evidence ✗→ scoring`
  (so a score can never be baked into an evidence row — 3.6's rollup-time recomputation is only
  possible because of this), and `apps/watch ✗→ custody|settlement`. Full forbidden-edge list
  in 6.4.
- **Ring 3 protocol**: `mode: "simulate" | "broadcast"` with simulate as default · broadcast
  requires an explicit network assertion so mainnet is a reviewed promotion, never config drift
  · CODEOWNERS, no auto-merge · fail at boot not at sign · every action produces an evidence
  record including refusals.
- Part 7 is the agent-operating section: four context layers (`AGENTS.md` → ring → skills →
  decision records), a **"I am adding X → it goes in Y" lookup table** (7.2), the six skills to
  write, and six decision records that must exist because each is a deliberate choice an agent
  would otherwise reverse in the name of helpfulness.
- **Deliberately contains no reference to any other codebase** — every rule is justified from
  this product's own properties, per user instruction.
- **Six open decisions listed in Part 9, not silently assumed**: web framework choice
  (unrecorded — earlier design assumed one, current practice points at another) · bootstrap
  method · whether we need our own on-chain contracts · `web`/`console` one app or two ·
  how `census` is rate-limited at population scale · where the agents repo lives.
- **Both files from today (`04b-...` and `00-...`) plus these HANDOFF entries are written but
  NOT committed** — left on the working tree of `planning/docs` for review.

## 2026-08-24 — Doc-pipeline restructuring, Ingestion audit, Fraud/Sybil final-review doc

- **Root cause diagnosed**: recurring conflict where new ideas discussed in chat kept getting
  silently blocked by stale content in old docs, or silently overwrote it with nothing marked.
  Concrete evidence found via direct grep/read: three files (`01-data-model-state-machines.md`,
  `03-evidence-trust-engine-pipeline.md`, Decision `0002`) simultaneously described three
  different, contradictory trust-tier systems, and the old `COMMERCIAL_VERIFIED → RISK_REVIEW →
  APPROVED` chain had been dropped from the ladder with no record of the decision.
- **Restructured the doc pipeline into three tiers**: `docs/unverified-ideas-and-flows/` (raw,
  non-binding) → `docs/architecture/` (structured/verified, still refinable — merged from
  `arch-wireframe-v0/` + `decisions/` via `git mv`) → `docs/final-review-docs/` (canonical,
  factually-proven, source of truth; architecture reconciles toward it, never the reverse).
  Codified as a mandatory same-turn supersession rule in a new root `CLAUDE.md` (auto-loaded
  every session): the moment something is superseded, stamp/reconcile it, update the
  `final-review-docs/README.md` status table, and name any dropped item explicitly in an "open
  architectural gaps" section — never silently.
- Created root `PRODUCT-STATE.md` (living, overwritten snapshot — distinct from this
  chronological log) and split `HANDOFF.md` into this file plus `HANDOFF_KC.md`, one
  append-only log per collaborator.
- **Audited `final-review-docs/01-ingestion-and-registration-of-agents.md`** (already existed
  from a prior session) against primary sources for completeness, per explicit user request
  ("is it missing out on things"). Found and fixed four real issues: (1) frontmatter
  self-contradicted its own canonical-authority status; (2) `04-category-agent-execution-
  architecture.md` falsely claims the Venus `≥1.30`/`≥1.40` recovery thresholds are "confirmed
  in Section 3" — verified via grep they aren't, only `04b`'s direct `venus-agent-skills`
  citation has them; corrected the attribution in `01` (§6.2) — **`04` itself still needs the
  same fix, not yet done**; (3) the self-dealing guard (`03` §3.3 step 6) only checks
  `evaluator_address` against marketplace-controlled identities, not owner-controlled ones,
  leaving the owner-funded High-trust path (§7.2) open to owner self-certification — added to
  §12 as an explicit open gap, not silently patched since it needed real design; (4) a broken
  dangling sentence in §10 (`apps/watch`) fixed to match Section 0's actual table text.
- **Wrote `docs/final-review-docs/02-fraud-sybil-detection.md`** — the full mechanics behind
  `01`/`03`'s previously-just-named sybil signal categories (wallet-cluster proximity via
  on-chain graph walk + `IdentityLink` table, review-timing burst z-score, reciprocal-pair/
  short-cycle detection, noisy-OR combination into `independence_confidence`), plus the
  self-dealing guard extension from finding (3) above, plus a sandbox-attempt rate-limit guard
  keyed to owner-wallet-cluster. **Scoped explicitly, per user direction, as additive and
  hackathon-deferred** — never gates the ladder, hiring, or any trust tier; exact thresholds
  (hop limits, windows, z-score cutoffs, rate-limit N) are named as open in §7, not silently
  assumed. Stamped the sections it supersedes in `architecture/01` §1.10 and `architecture/03`
  §3.6 and §3.3 step 6; updated `final-review-docs/README.md`'s status table.
- **Builder Console explicitly deferred** — user correctly caught that I was starting to design
  UI/screens over flows (the Medium-trust sandbox trigger, the High-trust job flow) that,
  while mechanically specified in `01` §6-7, have no defined console-level interaction model
  yet, and two real open decisions (`01` §12: `commercial_config` ceiling formula, TermiX L6
  re-homing) still block it. Correct call — not building it until the flows it would expose are
  themselves real.
- **Verified `01` §6's sandbox mechanism is NOT under-specified**, contrary to an assumption
  raised mid-session — re-read directly: Stage-0 opportunistic decision filter, Stage-1's full
  mechanism (Anvil fork of BSC mainnet, category-specific perturbation, session grant, outcome
  grading, graduated scenario series) and an honest limits section (§6.3) are all already
  written. What's missing is the console-facing interaction layer on top of it, not the
  mechanism itself.
- **User-set goal for what comes next** (recorded here so it isn't lost): finalize
  `docs/architecture/04`/`04b` (category-agent execution — the actual mechanics of the four
  mandated categories) into `final-review-docs/`, formalize execution/hiring-job/proof-evidence
  work, and resolve the two open `01` §12 decisions — with the explicit end goal being the
  **Discovery Engine as the last unbuilt component**, once everything it depends on (especially
  the proof/evidence engine) is finalized end-to-end. See `HANDOFF_KC.md` for the corresponding
  forward-looking note left for the next session on that side.
- Committed and pushed to `planning/docs` this session (see commit history for exact hashes).

---

## 2026-08-25 — Note left by KC's session, for Ryuk

First entry written under the amended handoff rule (see below). Read `CLAUDE.md` first if you
haven't this session — one of its rules changed today.

**What this session produced:** one new Tier-1 doc,
`docs/unverified-ideas-and-flows/2026-08-25-marketplace-engine-decomposition-kc.md`.
It is **non-binding and supersedes nothing** — it re-cuts the mechanisms already decided in
`final-review-docs/01`, `02`, `03` and `architecture/00`–`05` along a second axis: **engines**,
as units of ownable work, so the two of us can build separate pieces without colliding. It adds
no mechanism. The one genuinely new thing in it is the axis itself, and the rule that keeps it
from fighting Section 0: **packages are the carve, engines are the assignment — an engine never
becomes a folder.** Seventeen engines (E1–E16, E14 split), one whole-system mermaid diagram,
a per-engine build brief with in/out contracts and hard rules, a parallel-work split, and a
ten-item table of decisions that block specific engines.

**Five corrections it makes to its own first draft, after review** — recorded because three of
them are things the canonical docs are right about and a diagram can quietly get wrong:

1. **E14 is two engines, not one.** `01` §10's endpoint-liveness watcher (→ listing state) and
   `05` §5.6's hosted-tier execution Watcher (→ `RELIABILITY` Evidence on mismatch) have
   different triggers, outputs, weighting and ship dates. Split into E14a / E14b, E14b marked
   deferred since hosting is deferred. Note all of E5, E14a, E14b run inside the same
   `apps/watch` process — that's the two axes doing different jobs, not a contradiction.
2. **Integrity reads Evidence, not just the chain.** Only wallet-cluster proximity is
   chain-sourced (`02` §3.1); timing-burst and reciprocal-pair are computed from review records,
   which live as Evidence rows (`02` §3.2–3.3).
3. **`02` §5 and §6 are hard gates, not discounts.** Per `02` §8's own effect table the engine
   has three distinct effect shapes — *discounts weight*, *blocks the Evidence write*, *blocks
   the sandbox action*. Only the first is soft. Worth guarding against in any future summary.
4. **High trust is reachable two ways.** `01` §7 names both organic (a real buyer's completed
   job) and owner-funded showcase. Showing only the second implies High trust is purchasable
   rather than earnable, which inverts the design.
5. **Measurement needs the listing, not only the chain.** The chain says what happened; only
   `LISTINGS` says whose position it is and what category it claimed.

**One real supersession-debt item, for you specifically.**
`architecture/03` §3.4 still reads as though each category loop writes its own `OUTCOME`
Evidence — the pre-Decision-0001 mechanism. `final-review-docs/03` §7.1 replaced that this
morning ("no KPI is ever computed from an agent's self-report… there is no import path from an
agent to `scoring/`, `evidence/`, or `metrics/`"). `final-review-docs/03` §14's supersession
record lists three stamps applied; **`architecture/03` §3.4 is not among them, and carries no
banner** — confirmed by grep on 2026-08-25. Anyone reading `architecture/03` for the
measurement pipeline currently gets the superseded mechanism. Two-line fix, and exactly the
failure mode `CLAUDE.md`'s supersession rule exists to prevent. Left for you rather than
applied here, since it's your supersession record to complete.

**Two open items this session surfaced that aren't in any §12 gap list yet:**

- Whether uptime/degradation history is itself written as `RELIABILITY` Evidence. It's absent
  from `01` §10 and from `1.5`'s Evidence source table, so today a `DEGRADED` transition changes
  listing state and leaves no trace in the evidence trail. Uptime is plainly a trust signal;
  the silence reads as oversight rather than decision.
- Where the ranking function physically lives. Section 0 puts ranking in `discovery` (R2), but
  a pure, versioned, exhaustively-testable function has every property of `scoring` (R0).
  Needs a call before anyone writes it.

**Two disagreements with a review of the doc, recorded so they don't get re-litigated:**

- **E5 is not blocked on a Decision 0001 gap.** A review flagged it as open, citing
  `architecture/03` §3.4 — the stale doc. `final-review-docs/03` §7.1 decides it outright. Per
  the final-review README's own rule, once a topic has an entry, `architecture/` stops being the
  source for it. E5's *actual* open items are narrower: only 1 of 4 category KPI sets is
  promoted, and the historical-data source (`03` §13.2) is a real cost dependency.
- **A system map should not go in `final-review-docs/`.** It was proposed there. Five of the
  engines it names have nothing written at all, so it can't meet that folder's rigor bar; and
  that folder's rule is that `architecture/` reconciles *toward* it, which would make a map
  outrank the content docs it summarises. Proposed instead: `architecture/06-system-map.md`,
  plus an E-number column on `final-review-docs/README.md`'s status table to link the two.
  Graduates to final-review only when no row reads ❌. Not written yet — your call.

**`CLAUDE.md` changed this session.** The handoff rule was **inverted**: a handoff now goes in
the file named for whoever it is written *to*, not whoever wrote it. Previously it read "each
session appends to the file matching whoever is driving that session." This entry is the first
written under the new rule — KC's session, addressed to you, therefore in `HANDOFF_RYUK.md`.
`HANDOFF_KC.md`'s existing entry already happened to follow the new convention. Pre-2026-08-24
entries above are author-keyed self-logs and are explicitly left as-is, not reinterpreted.
Change is stamped inline in `CLAUDE.md`.

**Not done, deliberately:** nothing committed or pushed this session — the new doc is untracked
on `planning/docs` and `CLAUDE.md` is modified in the working tree. `PRODUCT-STATE.md` not
touched, since a non-binding Tier-1 doc changes nothing canonical, in-progress, or gapped.

**Suggested next, in the order it unblocks people:** the `01` §12 `commercial_config` decision
(it is a product call, not architecture, and the Builder Console is stalled behind it), then
promoting `04b` §4b.5–4b.7 for the remaining three categories, then the system map.

---

## 2026-08-26 — E11 Risk & Permission researched against primary sources; three of your concierge doc's assumptions don't hold

KC's session. Transaction pipeline started, E11 first. One new doc:
`docs/unverified-ideas-and-flows/2026-08-25-e11-risk-permission-engine-research-kc.md`.

Everything tagged `[V]` in it was fetched live via `curl` on 2026-08-25 — `docs.altana.network/
llms-full.txt` (206 KB, `@altananetwork/sdk` 0.7.1) and four BNB Agent Studio pages — per
`CLAUDE.md`'s "don't invent Altana/AgentCore behaviour, verify against primary sources, not
WebFetch summaries" rule. Those `[V]` items are constraints, not proposals.

**The headline, because it resolves Open Gap #1 in a direction nobody expected.** An Altana
session enforces exactly three things: `calls` (contract + method *signature*), `spend` (per-token
rolling cap), `expiry`. That is the entire grammar. Against our own `commercial_config`: **max
position size** is only boundable in aggregate, and **max daily tx count**, **max slippage** and
**auto-pause threshold** have *no on-chain representation at all* — no count primitive exists,
`calls` never matches argument values, and sessions are static from grant to expiry. So `01`
§12's leaning proposal ("ceiling enforced by `custody` at session-grant time") works **only for
the capital ceiling**. The other three are marketplace policy, not guarantees, and the product
has to stop rendering them as the same kind of thing.

### Three things in your docs that need changing before the hire card is built

Not blocking your work generally — but all three are in the path between PEAGASIS and `custody`,
so they're worth reading before that surface is built rather than after.

1. **`2026-08-25-peagasis-concierge-ryuk.md`, Session Builder row — the signing model doesn't
   exist.** The row says "unsigned EIP-712 session grant payload for **browser-wallet
   signature**", and the diagram's "1-Click Signature" assumes a MetaMask-shaped flow. Altana's
   own error docs, verbatim: *"Injected wallet signers (e.g. MetaMask) need to sign a transaction
   but the current build of `@altananetwork/sdk` doesn't accept them as a signer type."* Supported
   signers are `signerFromPrivateKey`, `createPrivateKeySigner`, `createPasskey`,
   `createHeadlessPasskey`. `grantSession` is a userOp through the Altana relay signed by the
   wallet's **admin** signer — not typed data handed to a wallet. The viable non-custodial browser
   path is `createPasskeyWallet` (WebAuthn, Face ID / Touch ID, browser-only, key never leaves
   secure hardware). Consequence nobody has costed: **the buyer cannot hire with their existing
   MetaMask wallet or its funds** — they create and fund an Altana wallet as part of the flow, and
   since `createWallet` is counterfactual and `grantSession` pays a Keystore registration fee
   (**doubled on a fresh wallet's first admin action**), the real sequence is *create → fund gas →
   fund capital → grant*. "1-Click" is one click at the end of three steps.
2. **"max 300 USDC" in your worked example is underspecified, and the safe reading may be
   inexpressible.** `SpendPermission` **requires** a period — there is no lifetime-total primitive.
   "max 300 USDC" on a 7-day session compiles to `{limit: 300, period: "day"}`, which authorises
   **up to 2,100 USDC**, 7× what the buyer thinks they agreed. Every `period` value in Altana's
   entire doc set is `"day"` or `"hour"`; no `"week"`, `"month"` or numeric. **[GAP]** — the full
   enum isn't documented and needs one SDK-type check; if `"week"` exists the problem mostly goes
   away, if not the only way to bound a total is to shorten the expiry to one period. Separately:
   **USDC is 18 decimals on BNB**, not 6 — `300_000_000n` caps at 0.0000000003 USDC and the agent
   silently does nothing.
3. **Your Venus worked example conflates the two enforcement layers in one card.** "Venus" →
   `calls` ✅ enforced. "max 300 USDC" → `spend` ✅ enforced. **"HF 1.35" → nothing.** It's agent
   config; the session permits a repay at 1.10 exactly as readily. All three are then shown under
   *"Review the session permissions below."* Same for "allowable drawdown" in the clarification
   prompt. This is the clearest concrete instance of the Layer A / Layer B split the E11 doc
   argues for — enforced and unenforced fields must be **visually distinct** in the hire card.
   Minor: *"(recommended: ≥1.30)"* carries the same Venus threshold attribution error already
   flagged against `architecture/04` — don't propagate it into buyer-facing copy.

Your own reconciliation note already catches the other two (`chain-adapters/altana` should be
`custody/`; Basic/Verified/Proven/Institutional → Low/Medium/High). Nothing to add there.

### Four decisions sitting with KC — do not build the hire card against a guess

1. **Buyer auth = passkey wallet.** Reads as forced rather than chosen (only non-custodial browser
   path the SDK supports), but it means accepting a fund-a-new-wallet step inside hiring.
2. **Topology T1 vs T2** (E11 doc §4.2) — one buyer wallet with a session per agent, vs. a
   dedicated wallet per hire. Passkey shifts this: you're creating a wallet in the flow either
   way, so **T2 got much cheaper to justify**, and it makes "this agent cannot touch your
   principal" unconditional rather than cap-conditional.
3. **The `period` question** — shorten expiry to bound totals, or accept per-period caps and say
   so plainly. Needs the enum check first.
4. **Layer A / Layer B rendering rule** in the hire card.

### Recorded as agreed, from your reply

E9 takes the **weight-vector bridge** — deterministic formula unchanged, PEAGASIS sets weights per
conversation (bounded, clamped, re-normalised), buyer sees the *literal* weights used, machine
buyers pass explicit weights or take category defaults through the same function. Also agreed and
not re-opened: the custody rule (**belongs in `00` §6.4 as a named forbidden edge** — not yet
written, nobody has done it), narration-engine reframe + TermiX report generator,
structured-fields-only narration, mandatory deterministic fallback, designed out-of-category
scoping response, E14→E15 into the PEAGASIS widget, voice input cut, cross-session personalisation
deferred. Name deferred, not decided.

Two gaps you named on the bridge that KC's proposal did not, carried forward as real work:
**weight clamping/re-normalisation** (a conversation must not be able to zero the trust weight),
and **weight-extraction eval** as a second test surface beside the pure ranking unit test.

**One error to fix either way:** `2026-08-25-marketplace-engine-decomposition-kc.md` §5.3 writes
the rank as a **product** (`capability_match × risk_fit × …`); your `discovery-engine-ryuk.md` §5
writes a weighted **sum**. Not the same function — under the product form any single zero factor
zeroes the whole rank, which collides with your own zero-evidence floor (§5.2). **Yours is right,
KC's is wrong.** Unstamped as of this entry.

### Safe to start now vs. blocked

- **Safe now** — retrieval (pgvector over `LISTINGS`, re-embedded off E16, top-N + hard filters).
  It survives every open question above untouched, and with a pinned embedding model and fixed
  index snapshot it stays reproducible, so it doesn't strain Section 0's `discovery/`
  "Deterministic" contract. Also safe: the narration engine over numeric/enum evidence fields.
- **Blocked** — the hire card / session-scope surface, on decisions 1–4 above.

**Not done, deliberately:** nothing committed or pushed. The E11 doc is untracked on
`planning/docs`; this entry is the only edit to a tracked file. `PRODUCT-STATE.md` not touched —
the E11 doc is Tier-1 non-binding and changes nothing canonical yet. **No supersession banners
stamped** on `architecture/01` §1.3/§1.4 (§2.3 and §2.5 of the E11 doc show both lines are wrong:
sub-delegation does not exist, and session scope is immutable at grant) — deliberately deferred,
because `CLAUDE.md` wants the stamp in the same turn as the *decision*, and decisions 1–4 aren't
made yet. Flagged here so it isn't lost.

**Update, same session (2026-08-26):** the product-vs-sum error above is now **fixed, not just
flagged.** `2026-08-25-marketplace-engine-decomposition-kc.md` E9 carries your weighted sum from
`2026-08-25-discovery-engine-ryuk.md` §5 verbatim, with a `⚠ Changed 2026-08-26` note recording
what it replaced and why (no weights expressible in a product; one zero factor annihilates the
rank, against your §5.2 floor; product terms aren't additively decomposable, so the
explanation-derives-from-weights rule can't hold). Added alongside it: the weight-vector bridge as
agreed, and the rule **filters are conjunctive, ranking is compensatory** — conjunctive logic
lives in E8's category/availability filters and E12's tier gate, never in the rank. E9's "genuinely
open" list narrowed to the clamp ranges, the weight-extraction eval, and where the function lives;
default per-category weight values now point at your §5.3 rather than reading as undecided.

---

## 2026-08-26 — Proof pipeline stress-tested against the decomposition; E4 is out

From KC's session, for Ryuk. Checked `2026-08-25-proof-engine-ryuk.md` against the decomposition,
`architecture/01` §1.5, `architecture/03`, `final-review-docs/01`, and raw EIP-8004 spec text.
Nothing committed. No stamps applied yet.

### The one thing that moves everything

**E4 is out.** KC is proposing that ruled third-party attestation not required. Only E3 and E5 produce evidence now,
and we own both — so no tier can honestly mean "independently verified."

This came from your own §4: AACP is a panel vote on a submitted deliverable, and §4 says runtime-
financial agents have no "after" to gate and no deliverable but their own log. **Your §4 killed
your §5.4.** You wrote the argument; it just never got run against E4.

### Rulings

| # | Finding | Ruling |
|---|---|---|
| ① | `realGroth16` L3-cap (yours) vs auto-upgrade (3 other docs) | Platform gates all upgrades. No vendor live-read |
| ② | Sandbox "primary" but called "a weak badge" | Primary = sequence, not strength. Level below |
| ③ | Sandbox compat is both "zero code changes" and "a build requirement" | **Open** — KC's hold |
| ④ | AACP needs the log-submission §4 rules out | Third-party execution not required. E4 out |
| ⑤ | E5 has no subject | Binding valid; attribution model **open** |
| ⑥ | Own-agent showcase breaks invariant #8 | Not required. #8 stands |
| ⑦ | Tier ranks cooperation, publishes it as trust | **Open** — whole model |

### Three places your doc is now wrong

1. **§5.3 "data plumbing."** It isn't — plumbing implies the data exists. E2 verifies the ERC-721
   *owner*, not the address holding the position. It's an attribution model, and calling it
   plumbing is why it stayed unassigned. Spec check helps you though: `agentWallet` is reserved,
   needs EIP-712/ERC-1271 proof — a real binding. Holes: it's a *payments* field, `unsetAgentWallet`
   is owner-callable, and it clears on transfer.
2. **§6 differentiator dies with E4.** "Protocol-assigned evaluator beats ERC-8004's owner-picked
   one" was right (spec confirms `validationRequest(address validatorAddress,…)` is caller-chosen)
   — but we no longer use AACP's evaluator, so **we have no answer to the critique we levelled at
   ERC-8004.** Biggest hole opened this session.
3. **§5.2 "primary" named a sequence, not a level.** Meanwhile `arch/01:288` prices sandbox at L2
   and AACP at L3 — our primary path priced below our supplementary one.

### Proposals (KC's, not adopted — want your review)

- **②** Evidence level = *how hard to fake*. Stage 0 → L1. Stage 1 → **L2 now, L3 once the rubric
  hits a bar** (≥3 scenarios, mild/severe/edge, graded on outcome). Capped at L3 because it's
  fork-detectable — not because we ran it. Level is a property of the **row**, not the engine.
- **③** Split E3 into `HARNESS RESULT` (accepted the injected RPC? PASS/NOT_COMPATIBLE) and
  `BEHAVIOR RESULT` (only on a pass). Conformance failure can't be reported as incapability. The
  harness result then *is* the third-party contract — your §8 item 5 for free.
- **⑤b** Attribution in three tiers: **T1 session-attributed** (we issue it, unforgeable, covers
  every hire) → **this replaces the §6 differentiator**; **T2 `agentWallet`** — index `MetadataSet`
  events, don't poll, so `unset` ends a window visibly instead of erasing one, and emit
  `binding_revoked` as an E7 signal; **T3 observed** — display only.
- **⑦** Drop the tier scalar for three orthogonal facts: `IDENTITY` / `BEHAVIOR` / `TRACK RECORD`.
  Always all three, including empty. No aggregate, no "2 of 3" — a count is a ladder. Each row
  carries its own limit. Your §2 KYA principle, finally decided instead of restated.

### Weaknesses KC already found in KC's proposals

- "NOT_COMPATIBLE never lowers rank" is arithmetically impossible. Real claim: it costs the *same*
  as never attempting, no more.
- ⑦ only works because of your weight-vector bridge — buyer sees the literal weights, so the
  ordering is attached to the query, not asserted as a property of the agent. Cut the bridge and ⑦
  collapses.
- T1 measures the agent *under our session caps* — not free-running performance. Needs a label.

### Owed stamps (① ④ ⑥ are decided, so these are overdue)

1. `architecture/03` Audit Note 5 + `architecture/01:290` still encode the live-flag auto-upgrade.
2. `architecture/03` §3.3 — whole AACP pipeline orphaned by ④. Delete or defer, not silently.
3. Your §5.4 + §6 need ④'s consequence recorded.
4. Carried over: `architecture/03` §3.4, superseded by `final-review-docs/03` §7.1.

### From you

- **Try to break your own §4.** All of ④ rests on it. If it's wrong, E4 comes back.
- **Argue against T1 as the §6 replacement** — is it actually stronger, or just the one we have left?
- **Demo cold-start:** on 2026-09-09 all four of our agents render identical cards (IDENTITY ●,
  BEHAVIOR ●, TRACK RECORD ○). Seed from testnet, or make the honesty the pitch? Undecided, and
  it's the item with a date on it.
- ③ and ⑦ are held by KC. Nothing goes into `docs/architecture/` until they land.

---

## 2026-08-26 — E9 split into v1/v2; three-way ranking conflict stamped

From KC's session, for Ryuk. Three files edited, nothing committed.

**The problem:** three docs described three different E9s — your discovery doc §3 ("never
embedding similarity"), your PEAGASIS v2 §0 ("that constraint is reversed"), and the
decomposition ("explicitly decided — deterministic weighted sum"). Same folder. Nobody stamped.
Same shape as the 2026-08-24 trust-tier three-way.

**Decision (KC): E9 ships in two versions.**
- **v1 (hackathon)** — your discovery doc §5 weighted sum, fixed per-category weights from §5.3.
- **v2 (designed, not shipped)** — PEAGASIS semantic retrieval + LLM ranking + per-conversation
  weight vector.

Your v2's reversal is **deferred, not reversed**. Nothing in it is thrown away.

**The weight-vector bridge we agreed 08-26 moves to v2** — PEAGASIS is what sets the weights, so
it can't run before PEAGASIS exists. But `rank(candidates, weights, methodology_version)` ships in
v1 with defaults passed through it, so v2 is a new caller, not a rewrite. Flagging because we both
agreed the bridge that morning.

**Stamped (same turn):**
1. `discovery-engine-ryuk.md` — new **§5.5** is the authoritative split; §3 banner, decisions-log
   item 7, §11 rows.
2. `peagasis-discovery-engine-v2-ryuk.md` — top banner, §5 item 5 resolved, §6's "mark v1
   superseded" struck (original kept).
3. `marketplace-engine-decomposition-kc.md` E9 — bridge re-scoped to v2.

**Two things worth knowing:**
- **Prompt injection (your v2 §4) is now v2-only.** v1's LLM never sees a listing row, only the
  buyer's free text. One less thing to harden before 09-09.
- **Your v2 §2.2 retrieval-grounding rule is marked permanent**, not deferred — the LLM may never
  generate an agent or a trust claim, whenever v2 ships.

**One gap named in §11, not solved.** At launch `trust_evidence_strength` is floored at 0.5 (§5.2)
and `outcome_quality` sits at its neutral default (§7) — 0.45 of weight constant across every
agent. Of the 0.55 that varies, 0.50 is owner-declared (`capability_match`, `risk_fit`,
`price_value`). **v1 ranks ~91% on self-declared config.** Meanwhile `MARKET-RESEARCH.md` §2b calls
session-survival / early-revocation "the single most valuable idea in this document" — un-fakeable,
uniquely ours — and it is not one of E9's six factors.

**Open for you:** is a zero-evidence agent *unknown* (your §5.2 neutral floor) or *weak negative*
(`MARKET-RESEARCH.md` §2b)? Both are in the repo. That one answer sets the floor, closes the
re-register-to-reset-your-score hole, and settles half of the trust-tier question still on hold.

---

## 2026-08-27 — KC's queue is UI now, then agents. Do not read agent work as waiting on KC this week

From KC, for Ryuk.

**Decision [`0003`](docs/architecture/decisions/0003-kc-ui-first-then-agents.md).** KC is
scaffolding the UI in this repo now (`apps/web`, `apps/console` — page shells, layout,
design-system wiring), then moving to the agents and growing them progressively.

This supersedes, as a *work order*:

- `HANDOFF_KC.md` 2026-08-24 "Do not start Builder Console yet"
- `PRODUCT-STATE.md`'s old next-step 4 (console deferred)
- reading `04b` §4b.10 / `03` §12 "goes first" as KC's calendar
- treating proof-engine §9 (E5 grading, sandbox-compat) as work KC must finish before UI

Those agent items are still KC's, and still required **when the agents are built**. They are
not this week's first move. `04b` §4b.10 remains the risk ranking *inside the agents repo*.

**Still true, not reopened:**

- Agents live in a separate repo (Decision 0001). Part 9 item 6 (where it lives) still has to
  be answered before anyone scaffolds agent code — that is a later gate, not a reason to
  treat KC as halted.
- E11's four hire-card decisions still block *wiring* `grantSession`. They do not block
  scaffolding the pages around it.

Stamped in the same turn: `04b` §4b.10, `final-review-docs/03` §12, Decision 0001 "Still
open", `PRODUCT-STATE.md`, `SCAFFOLD.md`, decomposition §5 / console row,
`final-review-docs/README.md`.


---

## 2026-09-02 — E11's caller side written up (`final-review-docs/04`); one Altana assumption checked and resolved against us

From KC's session (with Claude), for Ryuk.

**New canonical doc: [`final-review-docs/04-agent-side-onboarding-and-credentials.md`](docs/final-review-docs/04-agent-side-onboarding-and-credentials.md)**,
indexed in `final-review-docs/README.md`. `final-review 01` covers how a *seller* (an agent)
onboards. Nothing covered the other direction — how a *caller* (a Cursor/Claude Code session, a
Hermes/OpenClaw runtime, one of our own four category agents) reaches the marketplace, proves
who it is, and is revoked. That's what this doc is. In scope, it's the concrete build for E11's
buyer-facing half and part of E12's machine-facing surface — decomposition §4's E11 entry and
`01` §12's gap listing should point here, not stay open; I haven't stamped either myself since
§6's own framing is "a call for a human," but they're stale as of this entry.

**Shape, short version:**
- Wallet = identity, permanently. We never generate, hold, or see a caller's private key —
  including the `dlg` case (a coding agent acting for a human): it gets its **own** Altana
  wallet, the human grants it a session, the human's key never leaves the human.
- The off-chain token is a **receipt, not an authority** — a disposable, device-bound artifact
  so a caller isn't re-signing EIP-712 on every `search` call. It carries no scopes and no caps.
- **Authorization is two tiers, mirrored from the chain, not duplicated off it**: Standing
  (enrolled, not `SUSPENDED` — read, feedback, cancel, dispute, revoke) and Fresh (a live
  on-chain session bound to the account covers this exact call). Ring 3 is the only place a
  value-moving call is ever decided — an earlier draft had a second off-chain scope/cap check
  "independently re-verifying" the same chain state, which is a duplicate that can only ever
  agree or be wrong, never an actual second control. Cut.
- History is wallet-keyed, never credential-keyed (§6.1, §11.5, §11.6) — a lapsed or lost
  credential never loses job history or touches a job in flight; a new credential under the
  same wallet sees everything the old one did. §11.6 also specifies the buyer-facing "what has
  my agent done" query, which neither `11.3`'s credential-revoke row nor `05` §5.2's seller-trust
  UI covers — that screen didn't exist in any doc before this session.
- 17-row attacker-first threat model, and an honest limit stated plainly (host compromise = the
  attacker is the agent; nothing fixes that, the design only bounds and makes it visible).

**Checked live against `docs.altana.network` 2026-09-02, not assumed — one came back wrong.**
Doc 04 §12 originally leaned on "the session's spend cap never refills" to make a durable
session key safe for an agent to hold indefinitely. Checked directly (`/sdk/grant-session`,
`/concepts/sessions`, `/concepts/keystore`):

- **`grantSession`'s spend permission is `{ limit, period, token }`** — the docs state it plainly:
  "spend permissions cap how much the session can move per token, **per rolling period**"
  (day/hour examples shown). **It's a rate, not a lifetime pot.** A "50 USDT/day" session held
  by a compromised key drains up to `50 × days-until-revoked`, not 50 total.
- **The Keystore has no spend or remaining-budget field** — only key validity (exists / revoked
  / expired). Any "remaining budget" display has to be built by indexing `execute` events
  ourselves; nothing on the vendor side hands it to us.
- Still genuinely unconfirmed either way (contract-level, not doc-level): whether the per-period
  cap is enforced atomically against concurrent `execute` calls, and whether a session key can
  rotate without a fresh human signature.

**Nothing about the design breaks** — expiry, the call allowlist, and one-tx `revokeSession` are
unaffected and separately confirmed. What changes is the actual safety story: session **duration**
is now a real lever (a rate held for 90 days has 30× the blast radius of the same rate for 3
days), and it's on us to show `rate × duration` as the effective max exposure in the grant-session
UI before the human signs — Altana's primitive won't compute that total for us. Full correction
trail (with the specific sentences that were wrong) is in doc 04 §12.1/§12.1.1/§12.2/§12.5/§9.3
and threat-row 16.

**Bears on `01` §12's gap #1 (`commercial_config` / capital ceiling, since the old
`COMMERCIAL_VERIFIED → RISK_REVIEW → APPROVED` states were dropped with nothing decided in their
place)** — decomposition §6 lists the leaning proposal as "owner-editable field, capped by an
automatic `category baseline × trust tier` ceiling enforced at session-grant time." Doc 04 §9.2
finds there's no off-chain field left to enforce anything against — the *only* enforced ceiling
is whatever `grantSession`'s signed rate + expiry says, full stop. The two aren't in conflict:
`category baseline × trust tier` survives as the **suggested default** rate/expiry pre-filled in
the grant UI (a product default at the point of signing), never a backend-enforced field. Worth
an explicit line in `01` §12 saying so rather than leaving both readings live.

**Open, doc 04 §17** — mostly tuning values (live-credential ceiling, `jti` cache sharing under
horizontal scale, `valid_until`'s absolute ceiling) plus the two Altana facts above that need the
contract, not the docs.

**Not started, flagged in the same session, worth knowing before anyone assumes it exists**:
`search`/`get`/`quote`/`hire` — the actual MCP tool contracts an agent calls — are still just
names in decomposition's E8/E12 rows and doc 04 §5's table. No input/output schemas, no error
shape, no `/llms.txt` text, no A2A Agent Card JSON. This is the highest-leverage thing left
unwritten: none of today's credential work matters to a Cursor/Hermes caller until this exists.
