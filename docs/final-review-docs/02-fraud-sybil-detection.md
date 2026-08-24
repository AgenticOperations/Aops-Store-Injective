---
created: 2026-08-24
project: BUILD-BNB — BNB "Build the Era" marketplace
status: canonical mechanism design, hackathon-scoped. Per this repo's CLAUDE.md, this is the
  source of truth for how independence_confidence/sybil-suspicion is computed and how the
  self-dealing guard is extended. Exact thresholds (hop limits, windows, z-score cutoffs,
  rate-limit N) are explicitly deferred, not silently omitted — see §6. This system is
  additive: it discounts evidence and rate-limits sandbox attempts, but does not gate
  DISCOVERED→LIVE, hiring, or any of the three trust tiers. Core ingestion (01) and Builder
  Console (03, once written) work fully without it; it can be built after the hackathon
  deadline without blocking anything the mandated categories need.
section: final-review 2 of N — Fraud / Sybil Detection
depends_on: docs/final-review-docs/01-ingestion-and-registration-of-agents.md,
  docs/architecture/01-data-model-state-machines.md (§1.9, §1.10),
  docs/architecture/03-evidence-trust-engine-pipeline.md (§3.3 step 6, §3.6)
---

# Fraud / Sybil Detection

## 1. What this document answers

The trust-tier system in `01-ingestion-and-registration-of-agents.md` only means something if
the evidence backing it is actually independent of whoever benefits from it. This document
defines: what independence means concretely, how it's measured, where fake independence gets
caught, and — explicitly, per this project's hackathon scope — what's built now versus what's
designed but deferred.

**Scope call (2026-08-24):** this is additive infrastructure. It never blocks the
DISCOVERED→LIVE ladder, never blocks hiring, and never blocks any trust tier from being
earned. It only ever *discounts* evidence weight or *rate-limits* a sandbox action. That means
it can be built as a second pass without hampering core functionality — the mechanisms below
are specified completely enough to build later without re-deriving them, but nothing here is a
prerequisite for `01` or the Builder Console to work.

## 2. Threat model

| Attacker | Attack | Caught by |
|---|---|---|
| Agent owner | Fund reviewer wallets to leave fake OUTCOME feedback on their own agent | §3 wallet-cluster proximity |
| Agent owner | Get assigned as (or control) the Evaluator role in their own AACP job, faking EXECUTION evidence for the owner-funded High-trust path (`01` §7.2) | §5 self-dealing guard extension |
| Two colluding owners | Reciprocal reviews (A boosts B, B boosts A) | §3 reciprocal-pair detection |
| Agent owner | Spam the free Medium-trust sandbox test (`01` §6) to farm a lucky pass or fingerprint the fork's exact state | §6 rate-limit guard |

The marketplace-side half of the self-dealing attack (marketplace as Evaluator on its own job)
is **already guarded** — `docs/architecture/03-evidence-trust-engine-pipeline.md` §3.3 step 6,
built and tested on testnet already. This document only extends that guard to the owner-side
case, which was flagged as an open gap in `01` §12.

## 3. Suspicion signals

`docs/architecture/01-data-model-state-machines.md` §1.10 names three signal categories but
never specifies their mechanics. This section is the actual specification.

### 3.1 Wallet-cluster proximity

Detects a reviewer or evaluator wallet financially linked to the agent owner's own funding
wallet (already captured at ownership verification, `01` §4).

- **Direct edge**: has the reviewer/evaluator wallet ever sent or received funds directly
  to/from the owner's registered funding wallet?
- **N-hop proximity**: graph walk outward from the owner wallet through the BSC transaction
  graph, up to a hop limit (value TBD, see §6).
- **Shared funding parent**: did both wallets receive their initial funding from the same
  source (e.g. same CEX withdrawal address) within a lookback window (value TBD, see §6)?

Uses the RPC access already confirmed and in place for `chain-adapters/{aacp,defi}`
(`03`:235-242) — no new chain integration required, only a graph-walk job against existing
access.

Persisted in a new table, `IdentityLink(address_a, address_b, link_type, confidence,
first_observed_at)`, maintained by its own scheduled job (cadence independent of the score
rollup cron in `03` §3.5).

### 3.2 Review-timing burst detection

Detects coordinated review floods.

- **Per-agent**: z-score of review arrival rate in a rolling 24h window against that agent's
  own trailing 30-day baseline. High z-score flags a burst.
- **Cross-agent**: if the same set of reviewer wallets post reviews for multiple different
  agents within a tight mutual window, that's a review-ring signature independent of any
  single agent's own burst — flagged separately.

### 3.3 Reciprocal-pair / short-cycle detection

Detects circular trust: A reviews B, B reviews A (or short cycles A→B→C→A) within a tight
window.

- Build a directed review graph (reviewer → reviewed-agent-owner).
- For each edge, check for a reverse edge within a configurable window — a 2-cycle.
- Extend to 3-cycles for ring detection. Shorter cycle and tighter window increase severity.

### 3.4 Combining signals

`01` §1.10 doesn't specify a combination function. This document defines one: **noisy-OR**, so
one strong signal dominates but weak signals still stack, and independence never floors to
exactly zero — evidence stays "discounted toward irrelevance," per `01`:424, never erased.

```
suspicion_score = 1 − (1 − wallet_proximity) × (1 − timing_burst) × (1 − reciprocal_pair)
independence_confidence = 1 − suspicion_score
```

## 4. When this runs

Per `03` §3.6 (already established, unchanged by this document): `independence_confidence` is
recomputed at rollup time, against the *current* `IdentityLink`/timing/reciprocal state — not
baked into an Evidence row at write time. A review that looked independent at one rollup can
become more suspicious at the next as new cluster evidence accumulates, even though the
underlying Evidence row never changes. This is intentional, not a bug (already called out at
`03`:221-225) — this document's signals plug into that existing rollup-time recomputation
without changing its behavior.

## 5. Self-dealing guard extension

**Current state** (`03`:166-173, already built and tested on testnet): before writing an
EXECUTION Evidence row, the guard checks `evaluator_address` against identities the
**marketplace** controls. Built for the case where the marketplace is both Client and Provider
(`03` §3.3 step 3) — it does not check against the **agent owner's** identities, which is the
live risk in the owner-funded High-trust path (`01` §7.2), where the owner is Client instead.

**Extension** — same check point, second identity set, reusing the `IdentityLink` table from
§3.1:

```
if evaluator_address ∈ IdentityLink-cluster(marketplace_identities):
    → existing behavior: don't write as valid independent proof, log anomaly,
      fall back to marketplace-native verification (01 §1.2 path)
if evaluator_address ∈ IdentityLink-cluster(agent_owner_identities):
    → same fallback, for the same reason
```

AACP's Evaluator assignment is protocol-controlled, not chosen by either side (`03`:160-161,
Audit Note 4), so this guard can only **detect** an owner-clustered Evaluator after assignment,
immediately before the write — it cannot prevent the assignment itself. That's the same
posture as the existing marketplace-side guard; this only widens the identity set it checks.

## 6. Rate-limit guard on Medium-trust sandbox attempts

Medium trust's Stage-1 sandbox test (`01` §6 — Anvil fork of BSC mainnet, zero real funds) is
free to attempt. Without a limit, an owner can retry indefinitely to farm a lucky pass, or
probe the fork's exact state to game the rubric.

Rate limit keyed to the **owner's wallet cluster** (via `IdentityLink`), not just `agent_id` —
keying to `agent_id` alone lets an owner register throwaway agents for more free attempts.
Gate applied at sandbox-trigger time (Builder Console → `apps/jobs` fork provisioning); this is
an access guard, not a suspicion discount — it blocks the attempt outright rather than
discounting evidence afterward.

## 7. Deferred — not silently, explicitly

Per the scope call in this document's frontmatter, the following are real open items, not
oversights, and need explicit values before this is more than a design:

- Hop limit for wallet-cluster graph walk (§3.1).
- Lookback window for shared-funding-parent detection (§3.1).
- Rolling window and z-score cutoff for timing-burst detection (§3.2).
- Reciprocal-pair window and cycle-length severity curve (§3.3).
- Sandbox attempt rate-limit N and backoff curve, and whether a global new-agent cooldown is
  needed in addition to the per-cluster limit, to slow Sybil-agent farming itself rather than
  just sandbox retries (§6).

None of these block `01`'s ladder or hiring gates. They only need values before the discount
signals and the sandbox rate-limit actually go live — the self-dealing guard extension (§5)
has no missing threshold and could be built standalone ahead of the rest.

## 8. Where each mechanism runs — summary

| Mechanism | Trigger point | Effect |
|---|---|---|
| `IdentityLink` graph maintenance (§3.1) | Scheduled cron, own cadence | Background |
| Wallet-cluster / timing / reciprocal signals (§3.1–3.3) | Rollup cron (`03` §3.5/§3.6) | Discounts evidence weight |
| Self-dealing guard, marketplace + owner (§5) | Evidence write time (`03` §3.3 step 6) | Blocks write |
| Sandbox rate-limit (§6) | Sandbox-trigger time (Builder Console) | Blocks action |
