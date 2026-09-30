---
created: 2026-08-16
project: BUILD-BNB — BNB "Build the Era" marketplace
status: verified against primary sources (see Provenance); re-audited 2026-08-16 against live
  AACP testnet API (`aacp-backend.termix.live`) and raw whitepaper text — see Provenance
  Addendum
section: 1 of N — Data Model, State Machines, Proof & Rating Mechanics
---

# Section 1 — Data Model, State Machines, Proof & Rating Mechanics

## Provenance

Two verification passes back this document:

1. **Secondary-source synthesis** — three ChatGPT-exported deep-research threads
   (`gpt-marketplace.md`, `gpt-marketplace-2.md`, and the earlier hackathon-scan pass),
   consolidated into `docs/bnb-hackathon/research-findings.md` in the BUILD-PMOA repo.
2. **Primary-source verification** (2026-08-16) — live fetches against:
   - `docs.altana.network` (sessions, ERC-8183 SDK, x402 server SDK) — **confirmed accurate**,
     matches secondary-source synthesis closely. New detail: Studio-buyer x402 payments
     require `maxTimeoutSeconds ≤ 480` and the EIP-3009 rail.
   - `8004scan.io/developers` — **confirmed accurate** (endpoints, Pro-tier 500/min·100k/day).
   - `github.com/TermiX-official/aacp-whitepaper` (full whitepaper) and
     `github.com/TermiX-official/termix-agent-skills` — **material corrections required**,
     detailed inline below. This is the first time AACP's actual protocol spec was read
     directly; everything prior was secondhand paraphrase.

A significant finding from the primary pass: AACP's `CEX_CAPITAL` job type has its reference
contracts listed as "Planned" in AACP's public *interfaces* repo (`aacp-whitepaper`'s
`contracts/README.md`) — but that repo turned out to be a stale/aspirational reference doc,
not a description of what's actually deployed (see Provenance Addendum below for the
correction). The generic `PROGRAM`-type job flow (Provider/Evaluator/Groth16 proof) matches
the real, testnet-live path confirmed via the live backend.

**Decision made on this basis**: buyer capital custody stays entirely on Altana's Keystore/
session rail. AACP is integrated as a verification service only, via `PROGRAM`-type jobs,
never as a custody rail. `CEX_CAPITAL` is out of scope for this build — see the Addendum for
the corrected reason (it's a real, shipped feature, just the wrong domain).

## Provenance Addendum (2026-08-16 deep audit — direct raw-source and live-API verification)

A second, deeper audit re-verified every load-bearing AACP claim above directly against the
raw whitepaper markdown (downloaded and grepped, not summarized), `gh api` reads of
`termix-agent-skills`, and live `curl` calls to `aacp-backend.termix.live`
(`GET /api/v1/config`, `/api/v1/stats`). Four corrections came out of this pass:

1. **`CEX_CAPITAL` is real and shipped — the original "unshipped" reasoning was wrong.**
   Live stats show 90,329 `CEX_CAPITAL` jobs ever created (second-most-used strategy type on
   the network, after `RUBRIC`). It's not a vault-based on-chain DeFi pattern at all — it's
   CEX futures trading via a TEE holding encrypted exchange API keys
   (`StrategyVaultFactory.deployVault()` is called with `capital=0` since funds stay on the
   exchange; registration is `POST /api/v1/tee/jobs` with an encrypted API key and an allowed-
   symbol list). **Corrected reasoning for excluding it**: not "contracts aren't shipped," but
   "wrong domain" — it's centralized-exchange derivatives trading, not on-chain DeFi vault
   management, so it doesn't match any of our four categories regardless of maturity. The
   architectural decision (keep buyer capital on Altana, never route it through
   `CEX_CAPITAL`) is unchanged; only the stated reason was wrong. All `CEX_CAPITAL`
   references below are corrected accordingly.
2. **AACP `PROGRAM`-proof evidence level downgraded L4 → L3.** Live `/api/v1/config` returns
   `"features": {"zkVmEnabled": false, "teeEnabled": true, "realGroth16": false}` — the current
   testnet deployment does not cryptographically enforce Groth16 proof verification for
   PROGRAM-type jobs (`RiscZeroGroth16Verifier`, `RiscZeroVerifierAdapter`, and
   `Groth16VerifierRouter` are all `null` in the deployed config). An AACP PROGRAM
   "verification" today is a real, independently-run evaluation but not yet a trustlessly
   *proven* one — it should sit at L3 (comparable to marketplace-computed domain KPIs), not
   L4, until `realGroth16` flips true on whichever deployment we integrate against. This is
   designed as an automatic upgrade: the evidence pipeline should read the live feature-flag
   state at ingestion time and stamp L4 the moment real Groth16 enforcement is confirmed live,
   with no code change required. See 1.5, 1.2, and 1.8 for the corrected level throughout.
3. **Reputation default corrected 50 → 90 (with the discrepancy flagged, not silently
   resolved).** The whitepaper narrative states new agents start at `reputationScore` 50;
   the live `client-create-job.md` implementation doc states the staking-lock calculation
   defaults new agents to 90. No direct API call confirmed one specific new agent's actual
   starting score, so this isn't fully closed — but the live-implementation doc is treated as
   authoritative over whitepaper narrative, since it's describing the deployed calculation
   rather than a design intent. This roughly halves the lock our agent's own AACP staking
   pool needs to carry as a new Provider (see 1.7).
4. **Institutional tier's AACP-dependency language softened** given (2) — see 1.8.

None of these four corrections change the two-rail design itself (AACP optional/
supplementary, marketplace-native fallback always available and always the thing that gates
`LIVE`) — the design already tolerated AACP immaturity gracefully. They change specific
numbers and stated reasoning that were previously either wrong or overstated.

---

## 1.0 Object relationships

```
Agent (1) ──< Listing (N) ──< Authorization (N) ──< Job/Service (N) ──< Evidence (N)
  │                                                                         │
  └── version_hash boundary                              Performance ──────┘
                                                        (batch-aggregated, worker cron)
```

One `Agent` may carry multiple `Listing`s (different categories, or different
`listing_type`s off the same underlying agent). Trust tier and `Performance` are scoped to
`(agent_id, category)` — never globally: a health-factor listing does not inherit trust from
the same agent's rebalancing track record, since the domain KPIs and evidence sets are
disjoint. **Not scoped to `version_hash`** — see 1.1 and Decision 0002; `version_hash` is still
recorded per Evidence row, but a version change discounts trust temporarily rather than
partitioning it.

---

## 1.1 Agent

Identity anchor, 1:1 with an ERC-8004 Identity Registry entry (or pending-registration for
Agent-Studio-native agents).

- Fields: `agent_id`, `erc8004_ref` (chainId+tokenId, nullable), `owner_wallet`,
  `declared_services[]`, `category`, `version_hash`, `sync_status`
  (SYNCED/STALE/UNREACHABLE), `last_synced_at`.
- `version_hash` = hash of (`agentURI` content + declared strategy config for
  persistent-service agents) — the only thing we can observe, since we never have access to an
  agent's actual code, only its public manifest. The worker re-syncs on interval; when
  `version_hash` changes, that's a detected version boundary, recorded on every new Evidence
  row from that point on.
- **Version changes do not reset trust (Decision 0002, corrects this doc's original design).**
  Trust and Performance are scoped to `(agent_id, category)`, not to `version_hash` — a
  redeploy keeps its accumulated history. What a detected version change *does* trigger: a
  temporary, fading discount on trust weight (1.9) while the new version is unproven; a
  transparent note on the Agent Card ("manifest updated on [date], trust confidence
  temporarily reduced"); and one input signal into sybil/fraud scoring (1.10) if version
  churn clusters suspiciously around negative Evidence. None of these erase prior history —
  the original "restarts at Basic" design allowed a bad agent to launder its record via a
  cosmetic redeploy, which is exactly what this replaces.
- `declared_capability[]` and `observed_capability[]` are separate arrays, never merged — a
  capability only enters `observed_capability[]` once a `CAPABILITY`-proof Evidence record
  exists for it. Claimed-but-unobserved stays visibly `UNCONFIRMED` on the Agent Card.

---

## 1.2 Listing — verification gates, proof requirements by type, history retention

**Current state machine** (reconciled 2026-08-24 against
`docs/final-review-docs/01-ingestion-and-registration-of-agents.md`, the canonical source —
read that file for the full walkthrough of each transition):

`DISCOVERED → CLAIMED → OWNERSHIP_VERIFIED → ENDPOINT_VERIFIED → LIVE (Low trust,
compulsory) → [Medium trust, optional] → [High trust, optional, requires Medium] → DEGRADED →
SUSPENDED → REVOKED`

| Transition | Guard |
|---|---|
| `CLAIMED → OWNERSHIP_VERIFIED` | EIP-712 typed-data signature matches ERC-8004 token owner, or domain-verification TXT record |
| `OWNERSHIP_VERIFIED → ENDPOINT_VERIFIED` | Declared endpoint returns 200 on 3 consecutive ticks (kills transient-flake false negatives) |
| `ENDPOINT_VERIFIED → LIVE` (Low trust) | Nothing further required — ownership + live endpoint + registry data is sufficient. Compulsory, not optional; this is the state that kills the original bootstrap deadlock (final-review-docs/01 §4.4). |
| `LIVE → Medium trust` | Owner opts in; passes the two-stage sandbox test (mainnet-fork, zero real funds) — final-review-docs/01 §6 |
| `Medium → High trust` | Real, independently-evaluated AACP execution — genuine buyer hire, or owner-self-funded (marketplace funds nothing) — final-review-docs/01 §7 |
| `LIVE → DEGRADED` | Worker detects endpoint/evaluator/RPC failure on an active Job |
| `* → SUSPENDED / REVOKED` | Marketplace-initiated (policy violation) or owner-initiated withdrawal |

**Trust tier is a ranking/discovery signal, never a hiring-eligibility gate** — a Low-trust
agent is fully hireable for real money the moment it reaches `LIVE`. The two real hiring
gates are tier-independent: the buyer's own stated minimum-trust preference (1.3), and Ring
3's simulate/broadcast default on custody/settlement actions
(`00-repo-architecture-and-agent-conventions.md` §6.1).

> **⚠ OPEN, not silently resolved.** The old ladder (superseded above) had
> `EXECUTION_VERIFIED → COMMERCIAL_VERIFIED → RISK_REVIEW → APPROVED` as blocking states
> where `commercial_config` (max position size, max daily tx count, max slippage,
> auto-pause threshold) and a risk-tier capital ceiling were set/reviewed. When the ladder
> was redesigned into Low/Medium/High, these three states were dropped without an explicit
> decision being made about where their function goes — caught after the fact, not designed
> out on purpose. Leaning proposal (unconfirmed): `commercial_config` becomes a plain
> owner-editable field with safe platform defaults, capped by an automatic formula-driven
> ceiling (category baseline × trust tier) enforced by `custody` at session-grant time — no
> blocking gate, no manual review step. **This needs an explicit user decision before it's
> written into final-review-docs** — see that folder's README "not yet reconciled" list.

**Proof requirement is not uniform across listing_type** (still accurate, unaffected by the
tier redesign):

- **persistent-service, task** (capital-touching): real execution proof is via an AACP
  `PROGRAM`-type verified job (evidence_level L3 while `realGroth16: false` on the deployment
  we integrate against, auto-upgrading to L4 once real Groth16 enforcement goes live — see
  1.7) **or** the marketplace-run sandbox test (final-review-docs/01 §6). AACP is not a hard
  dependency for going live — its backend host is confirmed
  (`aacp-backend.termix.live`) but a third-party service is still a single point of failure
  we don't need to accept for the whole pipeline.
- **paid-capability** (x402, stateless, no capital exposure): reaches `LIVE` the same way as
  any other listing type — Low trust needs no execution proof at all.
- **agent-hires-agent**: inherits whichever underlying flow it wraps.

**History retention on revocation**: `Evidence`/`Performance` are keyed to
`(agent_id, version_hash)`, not to the `Listing` row — a `SUSPENDED`/`REVOKED` listing's
evidence trail stays queryable (marked historical, not deleted), for transparency and so a
re-listing of the same agent version doesn't restart from zero.

`commercial_config` shape per type: persistent-service = fee model (flat or %-of-AUM,
enforced via the Altana spend cap, not a separate billing system) + required
circuit-breaker set; task = ERC-8183 bid terms; paid-capability = x402 price-per-call;
agent-hires-agent = machine-readable schema for the Agent-to-Agent API.

---

## 1.3 Authorization — binding, hiring gate, renewal/replacement

- **ALTANA_SESSION** (persistent-service, agent-hires-agent): the blast-radius screen is the
  UI in front of one `grantSession` call; its output (`contract allowlist`, `spend_cap` with
  explicit token-decimals handling, `expiry`) is stored verbatim as `Authorization.scope`.
  `revokeSession` is the only path to `REVOKED` — no soft-revoke. This is the **sole capital
  custody rail** for persistent-service agents (see 1.7 — AACP never touches buyer capital).
- **ERC8183_ESCROW** (task): wraps the funding tx (`escrow_contract`, `funded_amount`,
  `dispute_window`). Carries a sub-field `escrow_variant: PLAIN | AACP_PROGRAM`:
  - `PLAIN` — generic Altana `hireErc8183Agent` flow, its own lifecycle
    (`Open → Funded → Submitted → Completed`, buyer-side dispute/refund).
  - `AACP_PROGRAM` — the same underlying ERC-8183 core, but the marketplace/buyer acts as
    AACP **Client**, defines a `PROGRAM`-type verification strategy, and an independent
    staked AACP **Evaluator** (not us) settles it. Additional fields populate:
    `verification_strategy = PROGRAM`, `evaluator_ref`, `aacp_job_id`.
- **X402_PAYMENT** (paid-capability): no persistent state — settled-or-not, logged for audit
  only.
- **Hiring gate**: a buyer sets a minimum required trust tier at hire time;
  `Authorization` cannot reach `GRANTED` if `Listing.trust_tier` is below it. Enforced, not
  a UI filter.
- **Renewal**: on `Authorization.expiry`, the buyer can grant a fresh session (new
  `authorization_id`, same `grantSession` mechanics). The linked `Job/Service` transitions
  `EXPIRED → RUNNING` under the new authorization, and `Evidence`/`Performance` continuity
  is preserved since it's the same `(agent_id, version_hash)`.
- **Replacement/failover**: a different concept from renewal — old `Authorization` goes
  `REVOKED`, a new one is granted against a *different* `Listing`. The buyer's operational
  "slot" continues, but trust-tier/`Performance` history does **not** transfer — the
  replacement agent starts at its own tier.

---

## 1.4 Job/Service — per-type lifecycle and execution loop cadence

- **persistent-service** (priority flow): `CONFIGURED → AUTHORIZED → ACTIVE → RUNNING →
  PAUSED → DEGRADED → ATTENTION_REQUIRED → EXPIRED → REVOKED → ARCHIVED`. `RUNNING` is the
  worker's execution loop, cadence per category:
  - Health-factor: event-driven — subscribe to position state, react within seconds of a
    threshold crossing.
  - Rebalancing: threshold-triggered — act when price exits configured range/buffer.
  - Grid: continuous fill-watching against configured levels.
  - Yield: periodic re-evaluation (daily or on-APY-change) — lowest frequency, since
    reallocation gas/slippage cost must be justified.

  Every tick produces either a no-action heartbeat (lightweight Evidence, L2, no AACP job)
  or a real action. Real actions executed under the Altana session are, **individually**,
  optionally wrapped as their own AACP `PROGRAM`-type job for independent Execution proof
  (see 1.7) — the engagement itself is never represented as one long-lived AACP job; its
  duration/renewal is governed entirely by the Altana session (1.3). This sidesteps AACP's
  own job lifecycle being one-shot-shaped (`Open→Funded→Submitted→Completed`), since we
  never adopt it as the container for an indefinite engagement.

  Transition triggers: `PAUSED` = user-initiated only; `DEGRADED` = worker-detected infra
  failure (endpoint/evaluator/RPC); `ATTENTION_REQUIRED` = agent hit a boundary outside its
  authority (spend cap near-exhausted, health-factor breach beyond its auto-react
  threshold); `EXPIRED` = `Authorization.expiry`; `REVOKED` = explicit `revokeSession`,
  cascading to force `Authorization.REVOKED` in the same operation.

- **task**: adopts ERC-8183's own lifecycle directly (create→fund→execute→submit→
  evaluate→settle/dispute). The "execute" step routes through a real AACP `PROGRAM` job
  when `escrow_variant = AACP_PROGRAM` (marketplace/buyer as Client, our agent as Provider,
  independent Evaluator settles); falls back to generic Altana ERC-8183 + our own fallback
  verification path (1.2) when AACP is unavailable or not requested.
- **paid-capability**: stateless — request→402→pay→result, logged not stateful.
- **agent-hires-agent**: same shape as whichever of the above is being bought; `buyer_wallet`
  is another Agent's session-controlled wallet.

---

## 1.5 Evidence

Append-only, immutable. One record per discrete agent action (or heartbeat), binding
action+wallet+agent+authorization+policy+tx.

- Fields: `evidence_id`, `job_id`, `agent_id`, `version_hash`, `authorization_id`,
  `action_type`, `tx_hash` (nullable), `proof_type`
  (IDENTITY/CAPABILITY/EXECUTION/OUTCOME/AUTHORITY/SETTLEMENT/RELIABILITY),
  `evidence_level` (L0–L6), `source`, `verification_ref` (discriminated union —
  `{aacp_job_id, evaluator_address, proof_hash}` for AACP rows, `{kpi_computation_id,
  block_range}` for marketplace-KPI rows, null for self-declared), `payload`
  (decision/inputs/permissions-used/result), `created_at`.
- Never mutated. Time-decay is applied at read time by the scoring engine (1.9), not by
  editing rows.

**Evidence source table (verified):**

| Source | proof_type | evidence_level | Notes |
|---|---|---|---|
| Self-declared `agentURI` capability | CAPABILITY | L0 | Display-only, never scored |
| Raw ERC-8004 feedback event | OUTCOME (weak) | L1 | Sybil-discount applies before use (1.10) |
| Marketplace onboarding execution test | CAPABILITY | L2 | Gates Listing → CAPABILITY_VERIFIED |
| Marketplace-initiated AACP `PROGRAM` test job (marketplace as Client, agent as Provider, independent Evaluator) | EXECUTION | L3 | New source (Decision 0002) — bootstraps Verified tier for a new agent with no paying buyer yet, using the same Client/Provider pattern 4.4 already specifies for our own agents |
| AACP `PROGRAM`-type job + Groth16 proof | EXECUTION | **L3** (auto-upgrades to L4 once `realGroth16: true` on the integrated deployment) | Currently not cryptographically enforced on testnet (`GET /api/v1/config` → `realGroth16: false`) — real, independent evaluation today, but not yet a trustless proof |
| AACP aggregate `reputationScore` (five-factor, ingested periodically) | RELIABILITY | L3 | New source — cross-check against our own computed score |
| Marketplace-computed domain KPI from on-chain state | OUTCOME | L3–L4 | Computed by worker reading chain state directly |
| Marketplace-run controlled benchmark ("Prove It" page = TermiX Agent Advantage Report format) | EXECUTION + OUTCOME | L6 | ≥3 paired runs, ≥1 trading/security-adjacent, per TermiX's own bounty rubric |

---

## 1.6 Performance

Derived rollups from Evidence, computed on a worker schedule, per `(agent_id, version_hash,
category, metric_ontology_key)`. Rows are appended over time (never overwritten), so
recent-vs-lifetime stays visible. `methodology_version` pins the exact formula/weights so
every score is re-derivable from raw Evidence.

---

## 1.7 AACP's exact role (verified against the whitepaper)

**Four roles, not two**: Client (posts job, defines verification strategy, funds escrow) /
Provider / Evaluator / Arbitrator. For any AACP-verified action, our marketplace (on behalf
of the buyer) acts as **Client**, our category-agent is **Provider**, and an independent
third-party agent already staked on AACP's network is **Evaluator** — we never self-evaluate.
AACP's own anti-collusion design (evaluator rotation limits — max 3 evaluations of the same
Provider per 30 days, blind evaluation hiding Provider identity, statistical-anomaly
detection on approval-rate/borderline-rate/counterparty-concentration) makes self-evaluation
both against the spirit of independent proof and likely to trip their own fraud detection.

**Job type: `PROGRAM` only.** `programCID`/`programHash` (IPFS-distributed, SHA-256-hashed
RISC-V ELF binary) defines a deterministic input→output check; deliverable read from stdin,
exit 0 = pass. Evaluator runs it in a zkVM (SP1 or RISC Zero backend), submits a Groth16
proof on-chain (~200k gas). `evaluate(jobId, passed, reasonCID)` → `complete()` settles.
`CEX_CAPITAL` is explicitly **not** used — it's a real, shipped strategy type (90,329 jobs
network-wide, second-most-used after `RUBRIC`), but it's CEX futures trading via a TEE
holding encrypted exchange API keys, not on-chain DeFi vault management — wrong domain for
all four of our categories regardless of maturity (Provenance Addendum, above). Buyer capital
never leaves Altana's Keystore.

**Fee split (corrected from earlier "90/2" figure)**: `platformFee` 2% fixed +
`evaluatorFee` 3% (L0/L1) or 4% (L2/L3) + Provider keeps the remainder (94% at L2). Speed
bonuses: +2% before 50% of deadline, +5% before 25% — funded from treasury, not from the
Provider/Evaluator split. Real per-action cost; belongs in the capital-safety/
circuit-breaker budget (production requirements, referenced from
`docs/bnb-hackathon/research-findings.md` §7.6).

**Staking**: our agent registers as AACP Provider via its ERC-8004 NFT, deposits ≥100 USDC
into AACP's staking pool (two-balance Available/Locked model). Each `setProvider` event
locks `budget × 10% ÷ reputationCoefficient` from Available until the job reaches terminal
state, where `reputationCoefficient = min(1.0, reputationScore/100)`. New agents start at
reputationScore 90 per the live implementation doc (whitepaper narrative states 50 — the
live figure is treated as authoritative since it describes the deployed calculation; flagged
as an open discrepancy, not fully closed — see Provenance Addendum), so a new agent's lock is
close to the mature-agent floor from day one, not the 2× penalty a score-50 default would
imply. This is separate operating capital from the buyer's delegated funds, needing its own
funding/planning line.

**Client-side staking is also required, not just Provider-side.** The Client role (our
marketplace, acting on the buyer's behalf) must itself hold a staking pool with ≥100 USDC
before `createJob` will succeed — confirmed via the live `client-create-job.md` doc, which
documents `createJob` reverting with selector `0x4e236e9a` when the Client has no staking
pool. Lock formula is the same shape, at a lighter 5% coefficient: `budget × 5% ÷
reputationCoefficient`. This means the marketplace needs its own staked AACP identity (not
just the category-agent Provider identity) funded and maintained as a prerequisite for
routing any action through an `AACP_PROGRAM` job — a second operating-capital line, not one.

**Real `createJob` ABI** (confirmed live, corrected from an earlier assumed `fund()` step):
`createJob(clientId, budget, deadline, strategyType, programHash, rubricHash) → jobId`;
funding is a separate `setBudget(jobId, amount)` call, not a distinctly-named `fund()`
function — see 1.4/1.7 job-lifecycle references and Section 3's orchestration pipeline for
where this ABI is consumed.

**Minimum verification strategy by job budget** (AACP's own rule, relevant to how large a
single wrapped action can be before a stronger strategy than PROGRAM alone is required):
&lt;100 USDC = any strategy; 100–1,000 = rubric(3+ dims) or program; 1,000–5,000 =
hybrid(≥30% program); &gt;5,000 = hybrid(≥50% program), human consensus strongly encouraged.
Since we've scoped to PROGRAM-only, individual wrapped actions above ~1,000 USDC in AACP job
budget would fall outside AACP's own recommended strategy — worth keeping wrapped-action
sizing under this threshold, or accepting the marketplace-native fallback path for larger
actions instead of forcing AACP.

---

## 1.8 Trust-tier gating

**Current system** (reconciled 2026-08-24; full detail in
`docs/final-review-docs/01-ingestion-and-registration-of-agents.md` §5-7 — canonical):

| Tier | What it requires | Compulsory? | What it affects |
|---|---|---|---|
| **Low** | Ownership + live endpoint + registry data (1.2) | Yes — this is what `LIVE` means | Base listing, always hireable |
| **Medium** | Passes the marketplace's own sandbox test — two-stage funnel on a local mainnet fork, zero real funds | No — owner opts in | Badge on Agent Card, `discovery` ranking boost |
| **High** | Medium, plus independently-evaluated real execution evidence (genuine buyer hire, or owner-self-funded — marketplace funds nothing) | No — requires Medium first | Strongest badge, `discovery` ranking boost |

Tier is a ranking/discovery signal only, never a hiring-eligibility gate — see 1.2's note
above for the two actual (tier-independent) hiring safety mechanisms.

The old Basic/Verified/Proven/Institutional ladder (including the TermiX Agent Advantage
Report tie-in at "Proven" and the L6-benchmark/AACP-multi-execution "Institutional" gate) is
retired. **Not yet re-homed, flagged not dropped**: whether/how the TermiX bounty-qualifying
benchmark (≥3 tasks, ≥1 trading/security-adjacent, L6) fits as a High-trust evidence source —
`final-review-docs/01` §7 doesn't currently name it as one of the accepted High-trust paths.
Needs an explicit decision, not a silent merge, before it's written into the canonical doc.

---

## 1.9 Score/confidence computation

For `(agent_id, version_hash, category, metric_ontology_key)`:

```
weight(e) = source_rank(e.source)          // 0.1 self-attest → 1.0 marketplace-benchmark
          × independence_confidence(e)     // 1 − sybil-suspicion, see 1.10
          × recency_decay(e.created_at)    // per-category half-life
          × economic_relationship_tier(e)  // NO_INTERACTION..VALIDATOR ladder
          × version_continuity(e)          // 1.0 normally; fades up from a lower floor for
                                            // pre-change evidence in the window right after a
                                            // detected version_hash change (Decision 0002) —
                                            // never drops to 0, since history isn't erased

score      = Σ(e.normalized_value × weight(e)) / Σ(weight(e))
confidence = f(sample_size, evidence_level_diversity, Σweight(e))  // saturating; 3×L6 outweighs 400×L0
```

`normalized_value` requires prior classification into the canonical metric ontology
(QUALITY/RELIABILITY/LATENCY/SUCCESS_RATE/COST_EFFICIENCY/PERFORMANCE/RISK/ACCURACY/
USER_SATISFACTION, or a category-specific KPI); unclassifiable feedback is excluded, never
coerced.

---

## 1.10 Sybil / independence confidence

⚠ SUPERSEDED (mechanics only — the formula/intent below is unchanged, just now fully
specified): see `docs/final-review-docs/02-fraud-sybil-detection.md` §3 for the exact
signal computations (wallet-cluster hop-walk, timing z-score, reciprocal-cycle detection),
the combination formula, and the deferred-threshold list.

`independence_confidence(e) = 1 − suspicion_score`, where suspicion is built from:
wallet-cluster proximity to the agent's own funding source, review-timing burst detection
(z-score vs. trailing baseline), and reciprocal-pair detection (A reviews B, B reviews A,
tight window). Continuous 0–1, never a binary flag — a suspicious review is discounted
toward irrelevance in the weighted average, not deleted.
