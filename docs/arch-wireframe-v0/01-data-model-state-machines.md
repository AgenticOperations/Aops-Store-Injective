---
created: 2026-08-16
project: BUILD-BNB — BNB "Build the Era" marketplace
status: verified against primary sources (see Provenance)
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

A significant finding from the primary pass: AACP's `CEX_CAPITAL` job type (a vault-based
delegated-capital pattern that would have matched our four mandatory categories closely) has
its core contracts (`IAACPStaking.sol`, and everything vault/guard-related) listed as
**"Planned"**, not shipped, in AACP's own public repo. No deployed `StrategyVault`/
`TransactionGuard` contract was found. The generic `PROGRAM`-type job flow (Provider/
Evaluator/Groth16 proof), by contrast, matches the real experience described in a
third-party developer's integration questions (referenced earlier in this project's
research) — it appears to be the actually-working, testnet-live path.

**Decision made on this basis**: buyer capital custody stays entirely on Altana's Keystore/
session rail. AACP is integrated as a verification service only, via `PROGRAM`-type jobs,
never as a custody rail. `CEX_CAPITAL` is schema-accommodated for a future revisit if its
contracts ship, but nothing in this build depends on it.

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
`(agent_id, version_hash, category)` — never globally: a health-factor listing does not
inherit trust from the same agent's rebalancing track record, since the domain KPIs and
evidence sets are disjoint.

---

## 1.1 Agent

Identity anchor, 1:1 with an ERC-8004 Identity Registry entry (or pending-registration for
Agent-Studio-native agents).

- Fields: `agent_id`, `erc8004_ref` (chainId+tokenId, nullable), `owner_wallet`,
  `declared_services[]`, `category`, `version_hash`, `sync_status`
  (SYNCED/STALE/UNREACHABLE), `last_synced_at`.
- `version_hash` = hash of (`agentURI` content + declared strategy config for
  persistent-service agents). The worker re-syncs on interval; when `version_hash` changes,
  that's a version boundary — prior `Evidence`/`Performance` stay attached to the old hash,
  and the new version **restarts at Basic trust tier**. A redeploy cannot inherit a prior
  version's track record.
- `declared_capability[]` and `observed_capability[]` are separate arrays, never merged — a
  capability only enters `observed_capability[]` once a `CAPABILITY`-proof Evidence record
  exists for it. Claimed-but-unobserved stays visibly `UNCONFIRMED` on the Agent Card.

---

## 1.2 Listing — verification gates, proof requirements by type, history retention

State machine: `DISCOVERED → CLAIMED → OWNERSHIP_VERIFIED → ENDPOINT_VERIFIED →
CAPABILITY_VERIFIED → EXECUTION_VERIFIED → COMMERCIAL_VERIFIED → RISK_REVIEW → APPROVED →
LIVE → DEGRADED → SUSPENDED → REVOKED`, with guards:

| Transition | Guard |
|---|---|
| `CLAIMED → OWNERSHIP_VERIFIED` | Wallet signature over challenge nonce matches ERC-8004 token owner, or domain-verification TXT record |
| `OWNERSHIP_VERIFIED → ENDPOINT_VERIFIED` | Declared endpoint returns 200 on 3 consecutive worker ticks (kills transient-flake false negatives) |
| `ENDPOINT_VERIFIED → CAPABILITY_VERIFIED` | Marketplace onboarding execution test succeeds — safe, non-capital test invocation per category |
| `CAPABILITY_VERIFIED → EXECUTION_VERIFIED` | **Listing-type dependent — see below** |
| `EXECUTION_VERIFIED → COMMERCIAL_VERIFIED` | `commercial_config` well-formed + capital circuit-breaker config present (persistent-service/task only) |
| `COMMERCIAL_VERIFIED → RISK_REVIEW → APPROVED → LIVE` | Automated risk-tier assignment, then publish |
| `LIVE → DEGRADED` | Worker detects endpoint/evaluator/RPC failure on an active Job |
| `* → SUSPENDED / REVOKED` | Marketplace-initiated (policy violation) or owner-initiated withdrawal |

**Proof requirement is not uniform across listing_type:**

- **persistent-service, task** (capital-touching): the `EXECUTION_VERIFIED` gate requires
  either an AACP `PROGRAM`-type verified job (Groth16 proof, preferred, evidence_level L4 —
  see 1.7) **or** a marketplace-native execution-verification fallback (our own re-run of
  the sandboxed test invocation, logged at L3). AACP is not a hard dependency for going
  live — its backend host is confirmed (`aacp-backend.termix.live`) but a third-party
  service is still a single point of failure we don't need to accept for the whole pipeline.
  What AACP gates instead is the trust-tier ceiling (1.8).
- **paid-capability** (x402, stateless, no capital exposure): skips the execution-verification
  gate entirely — `CAPABILITY_VERIFIED → COMMERCIAL_VERIFIED` directly.
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
| AACP `PROGRAM`-type job + Groth16 proof | EXECUTION | **L4** | Corrected from earlier L5 — one independent Evaluator's proof, real but not self-corroborated |
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
`CEX_CAPITAL` (the vault-based delegated-capital type) is explicitly **not** used — its
contracts are unshipped (Provenance, above). Buyer capital never leaves Altana's Keystore.

**Fee split (corrected from earlier "90/2" figure)**: `platformFee` 2% fixed +
`evaluatorFee` 3% (L0/L1) or 4% (L2/L3) + Provider keeps the remainder (94% at L2). Speed
bonuses: +2% before 50% of deadline, +5% before 25% — funded from treasury, not from the
Provider/Evaluator split. Real per-action cost; belongs in the capital-safety/
circuit-breaker budget (production requirements, referenced from
`docs/bnb-hackathon/research-findings.md` §7.6).

**Staking**: our agent registers as AACP Provider via its ERC-8004 NFT, deposits ≥100 USDC
into AACP's staking pool (two-balance Available/Locked model). Each `setProvider` event
locks `budget × 10% ÷ reputationCoefficient` from Available until the job reaches terminal
state, where `reputationCoefficient = min(1.0, reputationScore/100)` — new agents
(reputationScore 50) lock 2× more than established ones (100). This is separate operating
capital from the buyer's delegated funds, needing its own funding/planning line, and
capital efficiency improves over time as our agent's own AACP track record builds.

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

| Tier | Unlock condition |
|---|---|
| Basic | Listing reached `LIVE`. No execution/outcome evidence required. |
| Verified | ≥1 `EXECUTION` proof (L3+, AACP `PROGRAM` preferred) in trailing window |
| Proven | ≥3 `OUTCOME` evidence records (L3+), confidence above threshold — this is TermiX's Agent Advantage Report qualifying set (≥3 tasks, ≥1 trading/security-adjacent); hitting Proven and passing the TermiX bounty requirement are the same event |
| Institutional | Proven + ≥1 L6 marketplace-run benchmark **+ multiple AACP-verified (L4) executions** (a single third-party Evaluator's proof, however cryptographically real, is still one dependency — not fully within our control the way a marketplace-run benchmark is) + minimum time-in-market (e.g. 30 days continuous RUNNING with no unexplained DEGRADED/ATTENTION_REQUIRED gaps) |

---

## 1.9 Score/confidence computation

For `(agent_id, version_hash, category, metric_ontology_key)`:

```
weight(e) = source_rank(e.source)          // 0.1 self-attest → 1.0 marketplace-benchmark
          × independence_confidence(e)     // 1 − sybil-suspicion, see 1.10
          × recency_decay(e.created_at)    // per-category half-life
          × economic_relationship_tier(e)  // NO_INTERACTION..VALIDATOR ladder

score      = Σ(e.normalized_value × weight(e)) / Σ(weight(e))
confidence = f(sample_size, evidence_level_diversity, Σweight(e))  // saturating; 3×L6 outweighs 400×L0
```

`normalized_value` requires prior classification into the canonical metric ontology
(QUALITY/RELIABILITY/LATENCY/SUCCESS_RATE/COST_EFFICIENCY/PERFORMANCE/RISK/ACCURACY/
USER_SATISFACTION, or a category-specific KPI); unclassifiable feedback is excluded, never
coerced.

---

## 1.10 Sybil / independence confidence

`independence_confidence(e) = 1 − suspicion_score`, where suspicion is built from:
wallet-cluster proximity to the agent's own funding source, review-timing burst detection
(z-score vs. trailing baseline), and reciprocal-pair detection (A reviews B, B reviews A,
tight window). Continuous 0–1, never a binary flag — a suspicious review is discounted
toward irrelevance in the weighted average, not deleted.
