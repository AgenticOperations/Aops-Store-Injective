---
created: 2026-08-25
project: BUILD-BNB — BNB "Build the Era" marketplace
status: canonical for the **Rebalancing** category, end to end — the agent's strategy model,
  the marketplace's independent measurement of it, its Evidence/scoring wiring, its buyer
  surface, and its authorization scope. Every contract-level fact in §3 was verified by live
  call against BSC mainnet (56) and BSC testnet (97) during this session, with commands and
  results recorded, not asserted from memory. Supersedes `architecture/04` §4.3's rebalancer
  row and is the canonical expansion of `architecture/04b` §4b.4. The other three categories
  (grid, yield, health factor) get their own documents; nothing here is written to be
  copy-pasted into them.
section: final-review 3 of N — Category Agent 1: LP Range Rebalancer
depends_on: docs/final-review-docs/01-ingestion-and-registration-of-agents.md,
  docs/final-review-docs/02-fraud-sybil-detection.md,
  docs/architecture/00-repo-architecture-and-agent-conventions.md,
  docs/architecture/04-category-agent-execution-architecture.md (§4.0-4.2, §4.4-4.6),
  docs/architecture/04b-category-agent-strategy-models.md (§4b.2-4b.4, §4b.8),
  docs/architecture/decisions/0001-agents-repo-separation.md
---

# Rebalancing — the LP Range Rebalancer, end to end

> Package names are Section 0's ring names (`domain`, `scoring`, `metrics`, `market-data`,
> `evidence`, `listings`, `discovery`, `custody`, `settlement`, `apps/{web,console,api,jobs,watch}`).
> Where `04b` says `chain-adapters/defi`, read: the **agents repository's** own adapter layer
> (Decision 0001) for the acting half, and this repository's `market-data` for the observing
> half. They are different code in different repos and this document keeps them apart on
> purpose — see §7.1.

## 1. What this document answers

Everything the Rebalancing category needs to be *finished*, in both halves of the two-repository
split (Decision 0001):

- **The agent half** (agents repo): what the LP Range Rebalancer actually does, why, and the
  exact contract surface it touches — §5, §6.
- **The marketplace half** (this repo): how we measure it *without trusting it*, what Evidence
  rows that produces, and what the buyer sees — §7, §8, §9.
- **The authorization half**: the exact Altana session scope this category needs — §10.
- **The one decision this document cannot make on its own**: where real rebalancing evidence
  comes from, given that BSC testnet has no order flow — §11, verified in §3.6.

It does not restate `04` §4.2's `READ → DECIDE → ACT → RECORD` loop, `04` §4.0's "why we build
agents at all", or `LEARN-ONE-DAY.md` Block A2's derivations. Those are correct, current, and
referenced rather than copied.

## 2. What the rubric actually asks for in this category

This gets its own section because the question *"does 'all four categories' mean one agent per
category?"* determines what "done" means, and the rubric answers it in a word most readings skip.

Verbatim, from the main-track brief:

> *"A front end that **surfaces agent data**, lets users **discover and activate** agents by
> category…"*
> *"Agent Diversity — All four categories (rebalancing, grid trading, yield, health factor)
> **surfaced** with equal depth. A submission that treats one category as the main event and the
> rest as an afterthought won't score well here."*
> *"Agents surfaced on your marketplace must be **live on BSC**."*

Three things follow, and they are not the same thing:

| Question | Answer | Where it binds |
|---|---|---|
| Is "one agent per category" a scored requirement? | **No.** The scored unit is the *category surface*, not an agent count. The verb in every rubric line is *surface*, *discover*, *activate* — all marketplace verbs. | Criterion 3 |
| Is at least one **live** BSC agent per category required anyway? | **Yes** — but as an *eligibility* rule ("must be live on BSC"), and as a practical one: an empty category surfaces nothing, so it cannot be judged deep. | Eligibility + Criterion 1 |
| What is actually being scored as "depth"? | Per-category **data model, measured metrics, comparison logic, config surface, and activation flow that only make sense for that category**. Four identical cards with a swapped label is the failure mode named in the rubric text itself. | Criterion 2 + 3 |

So the build target for this category is **not** "ship a rebalancer." It is: *this category is
deep enough that a stranger can compare two rebalancing agents on numbers that exist nowhere
else on BSC, understand the trade-off between them, and hire one — and the same is separately
true of the other three.* We build a first-party rebalancer because supply doesn't exist yet
(`04` §4.0: ~3–4% of BSC-registered ERC-8004 agents expose a live endpoint), not because the
rubric asks for one.

**Consequence for sequencing, stated plainly:** the agent is the *input* to this category, not
the deliverable. If the agent slipped and we surfaced someone else's live rebalancer with our
measurement layer on top, Criterion 3 would still score. If the measurement layer slipped and we
shipped only our own agent, it would not. §7 is therefore the part of this document that cannot
be cut.

**Cross-track note.** Rebalancing is also the category that carries the **PancakeSwap partner
challenge** ("smarter liquidity management" is its first named example) and is the natural
trading-adjacent task for the **TermiX Agent Advantage Report**'s required trading entry — see
§9.4. One category, three tracks, no extra build.

## 3. Verification log — checked live this session, 2026-08-25

Marker convention as in `04b` §4b.1: **[V]** verified at source this session · **[R]** credible
secondary source · **[A]** inference.

All calls below were made with `cast` against public RPCs — `https://bsc-dataseed.bnbchain.org`
(chain 56, block 117,930,771) and `https://bsc-testnet-dataseed.bnbchain.org` (chain 97, block
127,074,010). Reproduce any line before trusting it.

### 3.1 The contract surface is real and is what Section 3's addendum said it was **[V]**

```
testnet(97)  NonfungiblePositionManager 0x427bF5b37357632377eCbEC9de3626C71A5396c1
             name()   = "Pancake V3 Positions NFT-V1"   symbol() = "PCS-V3-POS"
             factory()= 0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865
             WETH9()  = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd   (testnet WBNB)
mainnet(56)  NonfungiblePositionManager 0x46A15B0b27311cedF172AB29E4f4766fbE7F4364
             name()   = "Pancake V3 Positions NFT-V1"
             factory()= 0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865   (same address both chains)
```

### 3.2 Fee tier → tick spacing, read off the factory, not a docs page **[V]**

`PancakeV3Factory.feeAmountTickSpacing(uint24)` returns:

| Fee tier | `fee` | `tickSpacing` | One spacing step = |
|---|---:|---:|---:|
| 0.01% | 100 | 1 | 0.0100% |
| 0.05% | 500 | 10 | 0.1000% |
| 0.25% | 2500 | 50 | 0.5012% |
| 1.00% | 10000 | 200 | **2.0200%** |

This is a **strategy constraint, not trivia** — see §6.2.

### 3.3 Live mainnet pool state, WBNB/USDT, all four tiers **[V]**

```
token0 = USDT 0x55d398326f99059fF775485246999027B3197955 (18 dec)
token1 = WBNB 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c (18 dec)   ← USDT sorts first

fee=100    pool 0x172fcD41E0913e95784454622d1c3724f546f849  L=2.472e24  tick=-65731  card=2400
fee=500    pool 0x36696169C63e42cd08ce11f5deeBbCeBae652050  L=3.009e24  tick=-65727  card=900
fee=2500   pool 0x1401ff943D08a7E098328C1d3a9d388923B115D2  L=1.133e22  tick=-65739  card=150
fee=10000  pool 0x6805E0E5333c5c3acCF2930Be4734E2b98f4Ce06  L=5.118e20  tick=-65689  card=150
```

Decoding the 0.05% pool's `sqrtPriceX96 = 2962883964387659324874893034`:

```
price(token1/token0) = (sqrtPriceX96 / 2^96)^2 = 0.0013985246
1.0001^(-65727)                               = 0.0013984771     ← tick and sqrtPrice agree
=> 1 WBNB = 715.04 USDT at block 117,930,771
```

The decimals trap in `LEARN-ONE-DAY.md` A2.3 does not bite on this pair (both 18 dec) and *will*
bite on any pair involving USDC-style tokens. The startup assertion it prescribes is mandatory,
not optional — §12 Tier 1.

### 3.4 Liquidity is concentrated in the cheap tiers **[V]**

`L` at the 0.01% and 0.05% tiers is ~200× the 0.25% tier and ~5,000× the 1% tier on the same
pair. **[A]** For a rebalancer this means the realistic venue is a tier whose spacing is 1 or 10
ticks — which is also where narrow bands are actually constructible (§6.2). The 1% tier is
simultaneously the thinnest and the least steerable.

### 3.5 Any third party's position is readable by us, with no permission **[V]**

```
NonfungiblePositionManager.totalSupply()  = 4,910,207  positions minted (mainnet)
positions(tokenId) -> (nonce, operator, token0, token1, fee, tickLower, tickUpper,
                       liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128,
                       tokensOwed0, tokensOwed1)
```

Sampled three live tokenIds (7250688, 7250687, 7250686) and got full range/liquidity/fee-growth
data for each. **This is the technical basis of §7.4** — the marketplace can measure any
rebalancing agent's positions on BSC without that agent's cooperation, which is exactly what
Decision 0001 requires and what "we never trust a self-report" needs in order to be a fact
rather than a promise.

### 3.6 BSC testnet has liquidity but effectively no order flow **[V]** — the finding that changes the plan

Pools exist on testnet and hold liquidity:

```
WBNB/CAKE  0.05%  0xeaf78e3AA2C19dF9495318Cd9EA2aD83Be7D5015   L=1.212e25
WBNB/CAKE  0.01%  0x3AD3f791d0e04bA135f28Ee385d1e0e6BB01FCfa   L=2.911e24
WBNB/BUSD  1.00%  0x0E2c8FC122e86B571A508185f00881E2d1D81Ac2   L=3.606e24
WBNB/BUSD  0.25%  0xCbb1A7c864e5eBEF28E8570357dD316002666992   L=3.438e22
WBNB/USDT  0.01%  0x670D7005a0a8f2b3783865b2Ab53d15bEaeEF74D   L=1.000e15
```

But they do not trade. A V3 pool writes an oracle observation on the first swap of each block, so
`observations(slot0.observationIndex).blockTimestamp` **is** the pool's last-trade time. Measured
at 2026-08-25 03:55 UTC:

| Pool | Last trade | Age |
|---|---|---:|
| testnet WBNB/CAKE 0.05% | 1787499605 | **1.5 days** |
| testnet WBNB/CAKE 0.01% | 1786177046 | **16.8 days** |
| testnet WBNB/BUSD 1% | 1785511848 | **24.5 days** |
| testnet WBNB/USDT 0.01% | 1785089214 | **29.4 days** |
| testnet WBNB/BUSD 0.25% | 1776513182 | **128.7 days** |
| *mainnet WBNB/USDT 0.05% (control)* | 1787630123 | **~0** (seconds) |
| *mainnet WBNB/USDT 0.01% (control)* | 1787630148 | **~0** (seconds) |

The mainnet control matters: it proves the measurement method detects trading when trading
exists. An earlier attempt to measure this with `eth_getLogs` returned "zero swaps" on *mainnet
too* — because the public RPC rejects the call with `-32005: limit exceeded` and the error was
being swallowed. That false negative is recorded here deliberately: it is exactly the failure
mode `LEARN-ONE-DAY.md` Block E is about, and it nearly went into this document as a fact.

Testnet prices are also stale to the point of meaninglessness — the WBNB/CAKE 0.05% pool sits at
tick 313431 (~4×10¹³ CAKE per WBNB) with `observationCardinality = 1`.

**Consequence, stated bluntly:** on testnet, price never moves, so the range never breaks, so the
trigger never fires, so no fees accrue and **the category's headline KPI cannot be produced by
organic activity**. This is not a tuning problem. See §11.

### 3.7 A large share of managed V3 liquidity is staked, and the position owner is a contract **[V]**

```
MasterChefV3  0x556B9306565093C855AEA9AE92A594704c2Cd59e   (mainnet)
  nonfungiblePositionManager() = 0x46A15B0b27311cedF172AB29E4f4766fbE7F4364   (the same NPM)
  poolLength()                 = 592
  CAKE()                       = 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82
  NPM.balanceOf(MasterChefV3)  = 81,608 position NFTs held
  userPositionInfos(tokenId) -> (liquidity, boostLiquidity, tickLower, tickUpper,
                                 rewardGrowthInside, reward, user, pid, boostMultiplier)
```

Sampled three staked tokenIds; `pendingCake(tokenId)` returned non-zero for two and zero for one
whose `liquidity` is 0 (a stale, emptied, still-staked position). **This is absent from `04b` and
it changes the transaction sequence, the cost model, and the session scope** — §6.6.

### 3.8 Category size **[V]**

DefiLlama, live call to `api.llama.fi/protocol/pancakeswap-amm-v3`, 2026-08-25:
**PancakeSwap AMM V3 TVL on BSC = $237,687,749.** (`04b` §4b.9 carries "~$273M" — a live-varying
figure, corrected in §4.)

### 3.9 Carried forward, not re-verified this session

- The retirement of PancakeSwap's own **Position Manager** ALM product (deposits disabled May
  2025, removed from UI June 2025) — **[R]**, from `04b` §4b.9, *not* verified at contract level
  here. It is a load-bearing claim for the PancakeSwap-track pitch, so it is listed as an open
  verification item in §13 rather than repeated as fact.
- PancakeSwap **Infinity** CLAMM deployment and the `CLLimitOrder` hook — **[V]** in `04b` §4b.9
  and unchanged by this document. Build target remains **V3** for the reasons given there;
  §12 keeps the one-position Infinity hedge as a stretch item.
- The `github.com/pancakeswap/*` and `github.com/VenusProtocol/*` repository trees were
  **unreachable from this environment this session** (HTTP 404 authenticated *and* unauthenticated,
  while unrelated repos resolved normally). Every PancakeSwap fact in §3.1–3.8 was therefore taken
  from live chain calls instead, which is a stronger source. Anything in `04b` that rests only on
  a repo read stays marked as `04b` verified it, not as re-verified here.

## 4. Corrections this document makes to earlier docs

Per `CLAUDE.md`'s supersession rule, each of these is stamped at its source in the same turn as
this document landing.

| Doc | Claim | Correction |
|---|---|---|
| `architecture/04` §4.3, Rebalancer row | "Wallet's token split vs. target split → swap the excess side back" via `SwapRouter` | Already superseded by `04b`; this document is the replacement it points to. It is a portfolio rebalancer, not an LP range rebalancer, and performs no part of the mandated category. |
| `architecture/04b` §4b.9 | "~$273M of V3 liquidity" | Measured **$237,687,749** on 2026-08-25 (§3.8). Use a live read in any judged surface, never a hardcoded figure. |
| `architecture/04b` §4b.4 | Contract surface listed as `NonfungiblePositionManager` + `QuoterV2` + `TickLens` | Incomplete for any staked position. **`MasterChefV3` must be in the surface and in the session allowlist** (§3.7, §6.6, §10). |
| `architecture/04b` §4b.4 | Trigger + gate model, with the EV gate deferred to Tier 2 | Unchanged, but **preceded** by a pool-viability precondition that is cheaper than the EV gate and strictly more important (§6.1). Promoted from `LEARN-ONE-DAY.md` A2.5, which `04b` referenced without lifting. |
| `RESEARCH.md` §5.1 | Metric list for this category | Superset adopted in §7.2, with exact formulas and data sources attached. `RESEARCH.md` remains the research record, not a spec. |

## 5. The job, and the money model

Plain version (`LEARN-ONE-DAY.md` A1, not repeated): a concentrated-liquidity position is a
vending machine that only operates between two prices. Inside the band it earns a share of every
swap. Outside the band it earns **nothing** — not less — and holds 100% of the token that just
became the wrong one to hold.

The agent's job is to keep it earning **without spending more on rebalancing than the position
earns.** Both halves of that sentence are scored: the first by "% time in range", the second by
"net-of-cost APR", and an agent optimising only the first is a *worse* agent that looks busier.

Three numbers govern everything, and they are the same number three times
(`LEARN-ONE-DAY.md` A2.4–A2.6, reproduced and re-checked numerically this session):

```
E  =  1 / (1 − (p_a/p_b)^(1/4))   ≈  2/w        for a symmetric ±w band

  fee income      scales with  E
  LVR bleed       scales with  E        ℓ/V = (σ²/8)·E
  divergence loss scales with  E        DL(v3)/DL(full-range) = E

±1%  → E = 200.5 (2/w = 200)      ±10% → E = 20.4 (20)
±5%  → E =  40.5 (40)             ±25% → E =  8.3 (8)
```

> **Concentration multiplies an edge. It does not create one.**

## 6. The canonical strategy model

Everything in §6 is a change inside `DECIDE` — a pure function in the agents repo — except §6.5
and §6.6, which are `ACT`.

### 6.1 Precondition: is this pool worth providing liquidity to *at all*? (new — promoted to a gate)

Before any band, any trigger, any rebalance:

```
LP is +EV only if     pool fee APR on TVL   >   σ² / 8

σ = 2%/day  →  threshold  1.8%/yr
σ = 4%/day  →  threshold  7.3%/yr        (=  2.00 bp/day)
σ = 6%/day  →  threshold 16.4%/yr
```

A pool paying 5% APR on TVL at σ = 4%/day is a losing position **at every band width**, and no
rebalancing schedule fixes it. This check costs one volatility estimate and one fee-APR read; the
EV gate that `04b` defers to Tier 2 costs a full cost model. Cheap and decisive goes first.

**And it is a product feature, not just a guard.** Rendering *"this pool is below its LVR
break-even — we are declining to deploy"* on the category surface is the single most credible
thing a liquidity agent can display, because every yield dashboard on BSC shows the gross APR
that this check contradicts. It is the rebalancing equivalent of the yield agent's
`moves_declined_with_reason` (`04b` §4b.8) and it belongs in Evidence as such (§8).

### 6.2 Band geometry, and the constraint the fee tier imposes

Band bounds must be multiples of the pool's `tickSpacing` (§3.2 **[V]**). Verified arithmetic:

```
±5%  = ±487.9 ticks        ±1%  =  ±99.5 ticks        ±10% = ±953.1 ticks
```

| Tier | spacing | Finest expressible band | What that means |
|---|---:|---:|---|
| 0.01% | 1 | ±0.01% | anything |
| 0.05% | 10 | ±0.10% | anything a rebalancer would want |
| 0.25% | 50 | ±0.50% | ±5% lands on 500 ticks = ±5.13%, a 2.5% width error |
| 1.00% | 200 | **±2.02%** | narrow bands are **not constructible**; width granularity is ~2% |

Three rules follow, all of them the kind of bug that ships silently:

1. **Pick the rounding rule once and assert it.** Rounding both bounds outward widens the band and
   quietly changes `E` — and therefore changes every published number.
2. **Assert `tickLower % tickSpacing == 0` before submitting**, and assert the *post-snap* width
   is the width that was requested, within a declared tolerance.
3. **Report the realised band, never the requested one.** If the config says ±5% on a 0.25% pool,
   the position is ±5.13% and the surface must say ±5.13%.

### 6.3 Base + limit dual position — maker, not taker

Adopted from `04b` §4b.2/§4b.4 unchanged, restated for completeness:

```
BASE  band  [P·(1−w), P·(1+w)]   symmetric; holds the correctly-ratioed pair; earns fees
LIMIT band  one-sided, just off P, holding the entire surplus token
            → the market fills it, and PAYS us the swap fee to do so
```

```
                    swap (the taker path)      one-sided range order (this design)
  ─────────────────────────────────────────────────────────────────────────────
  swap fee          PAYS 0.01–1%               RECEIVES it
  price impact      yes                        none
  sandwich risk     exposed in the mempool     nothing to front-run
  fill              immediate, certain         when price arrives
  can it un-fill?   no                         YES — if price crosses back
```

That last row is a real cost and is **published**, not hidden: `limit_band_fill_rate` (§7.2).
Sizing has no free parameter — fill the base band to its exact ratio (`LEARN-ONE-DAY.md` A2.9's
`R`), put the entire remainder in the limit band.

### 6.4 Triggers

```
FIRE on   drift of X% of band width from centre        (primary)
     OR   full range exit                              (safety net)
     OR   elapsed-time backstop                        (mandatory — a frozen agent must be
                                                        VISIBLE, not silent)
GATE  §6.1 pool viability          — Tier 1, always
      EV gate: expected fee gain over horizon > gas + swap + realised divergence
                                   — Tier 2
```

Why threshold and not schedule, with the arithmetic (`LEARN-ONE-DAY.md` A4/A2.7, $5,000 position,
~$4/rebalance): daily ≈ 29%/yr in cost, every-3-days ≈ 9.6%/yr, weekly ≈ 4.1%/yr. Expected range
life is `b²/σ²`, so band life scales with `w²` and rebalance frequency scales with `σ²` — a
doubling of volatility quadruples the cost with no change in configuration. **A daily rebalancer
can burn more than the pool pays.** "How often does it act" is therefore a first-class *published*
number (§7.2), and more automation is not automatically better.

### 6.5 The transaction sequence, unstaked

```
1. decreaseLiquidity     NPM
2. collect               NPM      ← tokens + accrued fees out
3. (no swap)             — surplus goes to the limit band instead        §6.3
4. mint × 2              NPM      ← base band + limit band
```

`SwapRouter` stays in the agents repo's adapter as the fallback for when a range order cannot be
used, and every use of it is a *reported* event, not a silent one.

### 6.6 The staked-position complication — new, and it is not optional

81,608 V3 positions on mainnet are owned by `MasterChefV3`, not by the person who created them
(§3.7 **[V]**). For any such position:

- **`NPM.decreaseLiquidity` reverts.** The agent is not authorized for a token it does not own;
  the owner is the MasterChef contract. An agent written only against `NPM` fails on every farmed
  position — which is the population most likely to hire a manager.
- The sequence becomes **six steps**: `MasterChefV3.withdraw` (unstake + harvest CAKE) → `NPM`
  decrease/collect → `NPM` mint × 2 → `MasterChefV3` re-stake (`safeTransferFrom` of the new
  tokenId). More gas, more failure points, and a re-stake that can fail *after* the position has
  been rebuilt.
- **CAKE emissions are a second income stream** and must appear in net-of-cost APR (§7.2). Ignoring
  them understates a farmed position's return; ignoring the harvest's own gas overstates it.
- `userPositionInfos` tracks **`rewardGrowthInside`** — the same "inside the range" accounting V3
  uses for fees **[V]**. So time out of range costs the user *both* fee income and CAKE emissions,
  which strengthens rather than weakens the "% time in range" argument.
- **Session scope must include MasterChefV3** or the agent is authorized to take a position apart
  and not to put it back (§10).

**[A]** Handling staked positions is what separates this agent from a tutorial. It is also the
concrete answer to the PancakeSwap partner challenge — the largest population of unmanaged
concentrated liquidity on BSC is farmed liquidity, and it is exactly the population a naive
implementation cannot touch.

## 7. What the marketplace measures, and how

This is the half that is scored under Criterion 2, and it lives in **this** repository.

### 7.1 The independence rule

`metrics/` (Ring 0, pure) computes every KPI from observations supplied by `market-data/` (Ring 1,
read-only) and `apps/watch` (detect-and-enqueue only). **No KPI is ever computed from an agent's
self-report**, for ours or anyone's. Decision 0001 makes this checkable rather than assertable:
there is no import path from an agent to `scoring/`, `evidence/`, or `metrics/`, because the code
is not in the same tree.

Practically, the whole measurement set derives from five reads: `NPM.positions(tokenId)`, pool
`slot0`, pool `feeGrowthGlobal{0,1}X128` / `ticks()`, `MasterChefV3.userPositionInfos(tokenId)` /
`pendingCake(tokenId)`, and transaction receipts for gas. All five work on any tokenId (§3.5).

### 7.2 KPI definitions — the `metric_ontology_key` values for this category

Filling `01` §1.9's undefined "or a category-specific KPI" clause, and expanding `04b` §4b.8's
Rebalancing row with formulas and sources.

| `metric_ontology_key` | Definition | Computed from | Why a buyer needs it |
|---|---|---|---|
| `time_in_range_pct` | Σ(seconds with `tickLower ≤ tick < tickUpper`) ÷ elapsed seconds, over the reporting window | `apps/watch` tick stream + `positions()` bounds | **The** number for this category. 60% vs 90% time in range on the same pool and capital is ~18% vs ~27% gross. Nobody on BSC publishes it. |
| `net_of_cost_apr` | (fees earned + CAKE harvested − gas − swap fees − slippage − realised divergence loss) ÷ position value, annualised | `feeGrowthInside` deltas, `pendingCake`/harvest events, receipts | The honest version of the number every dashboard shows gross. |
| `divergence_loss_vs_hodl` | `V(P′)/V_hodl(P′) − 1`, computed exactly per `LEARN-ONE-DAY.md` A2.6 | position value at range-relative price + entry composition | The number every ALM hides. Rendered **at equal weight** to return. |
| `rebalances_per_period` · `cost_per_rebalance` | count; USD median and p90, itemised gas / swap fee / slippage | receipts + pool state at execution | Proves more automation is not better (§6.4). |
| `limit_band_fill_rate` | filled ÷ (filled + un-filled + partially-filled) limit bands | mint/burn/collect on the limit tokenId | The disclosed cost of choosing maker over taker (§6.3). |
| `realised_sigma` | realised volatility of the pool over the same window | tick stream | Separates a good month from a good agent. |
| `fee_share_achieved` | position fees ÷ pool fees generated inside the position's range | `feeGrowthInside` vs `feeGrowthGlobal` | Detects `E` saturation — the ceiling `LEARN-ONE-DAY.md` A2.8 says the toy optimum ignores. |
| `pool_viability_margin` | pool fee APR − σ²/8, at decision time | `market-data` | Makes §6.1's decline **auditable**, not a claim. |
| `time_to_recovery` | median seconds from range exit to back in range | tick stream + position events | Responsiveness, and the one number a slow agent cannot fake. |

Two display rules, non-negotiable, from `01` §1.9 and `LEARN-ONE-DAY.md` D3/D5:

- **No return is ever rendered without its risk beside it, at equal visual weight.**
- **Every number carries its sample size**, and `confidence` scales with it. 94/100 from 12
  observations must not outrank 88/100 from 12,000 — which is what `01` §1.9's `score`/`confidence`
  split already exists to enforce.

And **Rule 4** of `04b` §4b.3: every one of these is segmented by market regime. Rebalancing helps
in trending markets and hurts in choppy ones, so a blended lifetime number is a lie of omission.

### 7.3 The ~98-minute horizon — why `apps/watch` is load-bearing here **[V]**

A V3 pool's oracle keeps `observationCardinality` entries, overwritten in a ring. Sampled at a
fixed block on the busiest BSC pool (WBNB/USDT 0.01%, cardinality 2400), the buffer spans
timestamps 1787624341 → 1787630226: **≈ 98 minutes of tick history.** The 0.25% and 1% pools carry
cardinality **150**.

Consequences, and they are hard requirements:

1. **`time_in_range_pct` cannot be reconstructed retroactively from chain state.** It must be
   accumulated continuously from the day we start watching, by `apps/watch` (Section 0 §5.1 — the
   always-on process whose existence is justified by exactly this kind of published metric), or
   sourced from an indexer of historical `Swap` events.
2. **`eth_getLogs` on a public BSC RPC is not a data source.** It returned `-32005: limit exceeded`
   for a 200-block window (§3.6). Historical backfill needs a paid/archive endpoint or a subgraph,
   and that is a **dependency with a cost**, not a detail — §13.
3. Every KPI must publish its **observation-window start**, and the surface must show it. "94% time
   in range (since 2026-09-01, 8 days)" is honest; "94% time in range" is not.

### 7.4 Shadow measurement — the capability that makes this category deep without waiting for supply

Because `positions(tokenId)` is public for all 4.9M positions (§3.5), `metrics/` can compute the
full §7.2 set for **any** rebalancing agent or vault operating on BSC, with no cooperation, no
integration, and no capital of ours at risk.

**[A]** This is the single highest-leverage thing in this document for Criterion 2 and 3 together.
It converts the category from *"here is our agent"* into *"here is every rebalancing strategy
operating on BSC, measured the same way, ranked on numbers none of them publish"* — a comparison
surface that cannot be built by a directory, and the thing that keeps this category deep even if
the first-party agent is late.

It also has a limit, which the surface must state: a shadow-measured operator has **not** been
hired through us, so it carries no EXECUTION Evidence and no trust tier above Low (`01` §5). The
provenance label (`"Verified by us"` vs `"Discovered"`, per the discovery findings doc §4) is what
keeps that distinction visible.

## 8. Evidence and scoring wiring

No new pipeline. This category writes through `03` §3.4's domain-KPI path, exactly as `04` §4.1
already specifies.

- **Evidence rows**: `OUTCOME` type, one per completed measurement window per position, with
  `metric_ontology_key` from §7.2, `groundedness` set from the presence of a real `tx_hash` /
  position tokenId, and `outcome_status` (SUCCESS / FAILURE / TIMEOUT / PARTIAL / POLICY_REJECTED)
  from the findings doc §4.
- **A declined rebalance is Evidence too.** §6.1's viability decline and the Tier-2 EV gate's
  refusals write rows with an explicit reason. An agent that correctly did nothing has produced
  proof of quality, and the scoring formula must not read inactivity as absence of evidence.
- **Independence**: `independence_confidence` is recomputed at rollup time against current
  `IdentityLink` state (`02` §4). Nothing category-specific — but note that shadow-measured
  positions (§7.4) have *no counterparty at all*, so the diversity term in the scoring formula
  should treat them as neutral rather than as maximally independent. Flagged in §13.
- **Rollups** run on `03` §3.5's cron and carry the regime label from `04b` Rule 4 plus the
  observation-window start from §7.3.

## 9. The buyer surface — where "equal depth" is actually scored

§2 established that this is the deliverable. Concretely, the Rebalancing category surface must
carry all of the following, and none of it is shared boilerplate with the other three categories.

### 9.1 Category browse
Ranked list of rebalancing agents with, on the card: `time_in_range_pct` (with window), realised
net APR, `divergence_loss_vs_hodl` beside it at equal weight, `rebalances_per_period`, sample size,
provenance label, trust tier. Sorting on any of them, defaulting to none of them silently.

### 9.2 Compare
Two or three agents side by side on the §7.2 set, **regime-segmented**, with an explicit
"different pools / different windows — not directly comparable" warning when the windows or venues
differ. The comparison that only makes sense here: same pool, same window, different band width
and trigger — which is the axis on which two rebalancers actually differ.

### 9.3 Agent detail
The strategy in one paragraph a stranger can read (band width, trigger, maker-vs-taker), the
realised band (§6.2 rule 3), the fill-rate and its meaning, the cost breakdown per rebalance, the
decline log from §6.1, and the evidence vector shown as components rather than one blended score.

### 9.4 Preview / Simulate, before any wallet connection
Run the agent's `DECIDE` against current pool state and render the would-be action, with no `ACT`
and no `RECORD`. This is nearly free — `DECIDE` is pure precisely so this is possible (`04` §4.2)
— and it is the direct answer to Criterion 1's *"someone with zero Agent Studio knowledge… without
hitting a dead end"*: value is visible before a wallet is asked for. It is also the **TermiX
Agent Advantage Report**'s natural artifact for this category: the same position, managed and
unmanaged, over the same window, with the measured difference and the actual outputs attached.

### 9.5 Activate
Category-specific config, not a generic form: pool + fee tier (with §6.2's constructible-width
warning), band width, trigger threshold, time backstop, slippage cap, gas ceiling, max position
size, and whether the position is staked (§6.6). Each field shows its consequence — turning band
width down shows the resulting `E`, expected range life `b²/σ²`, and expected rebalance frequency,
live.

### 9.6 Active-agent console
Current band vs current price, time-in-range accruing live, next trigger distance, cost to date,
and a **visible revoke** that works in one transaction (§10).

## 10. Authorization scope — what this category's Altana session must allow, and nothing more

The session the buyer signs is the blast radius (Section 0, Ring 3). For this category:

```
ALLOW   NonfungiblePositionManager   decreaseLiquidity · collect · mint · increaseLiquidity
        MasterChefV3                 withdraw · harvest · onERC721Received re-stake path
        ERC20 approve                ONLY to NPM and MasterChefV3, only for the position's
                                     two tokens
        SwapRouter                   exactInputSingle — fallback path only, and every use is
                                     surfaced as a taker event (§6.3)

DENY    any transfer of the position NFT to an address other than MasterChefV3
        any token transfer to an address outside the position's own accounting
        any pool or token pair outside the hired configuration

CAP     spend cap covering gas + the fallback swap path
EXPIRY  explicit, short, visible, renewable
REVOKE  one transaction, immediate, exposed in the UI (§9.6)
```

Two things this list is designed to make true: the agent **cannot** withdraw principal to any
address, and the "cannot" is enforced by the session, not by the agent's own code. That is the
Altana partner-track requirement (*"a user can see what their agent may do, and revoke it, inside
the product"*) satisfied by the same work that makes the main-track category safe.

**Open**: whether the un-stake step needs a distinct scope entry from the re-stake step given
MasterChefV3's `safeTransferFrom` re-stake path — §13.

## 11. The evidence problem, and the decision it forces

§3.6 is verified: **BSC testnet has liquidity and no order flow.** Price does not move, ranges do
not break, fees do not accrue. Every KPI in §7.2 is either zero or undefined on testnet, and the
agent's own trigger will never fire without help. No amount of strategy work changes this.

Three ways out. They are not mutually exclusive, and the recommendation is a combination.

| Option | What it gives | What it costs | Risk |
|---|---|---|---|
| **A. Shadow-measure mainnet third parties** (§7.4) | Real `time_in_range_pct`, real divergence loss, real cost data, across many strategies, from day one | Build the observation pipeline (which §7.2 needs anyway) + a historical data source (§7.3) | **None to capital.** Produces no EXECUTION evidence for *our* agent. |
| **B. Run our agent on mainnet with small real capital** | Genuine first-party evidence, mainnet-strength for the Altana track | Real funds at risk; Ring 3 promotion; human review | Real, bounded by position size and session cap |
| **C. Generate synthetic testnet flow** (scripted counterparty swaps through our own pool) | An end-to-end demo that visibly fires the trigger | A flow generator, plus honest labelling | **Labelling.** Synthetic flow presented as performance is the exact dishonesty this project's whole thesis is against. |

**Recommendation [A]:** **A + C, with B as a scoped decision.** A carries Criterion 2 and needs no
permission. C makes the *mechanism* demonstrable end to end and must be labelled `SYNTHETIC` in
Evidence, excluded from every published performance number, and visibly marked in the UI. B is the
only path to first-party mainnet execution evidence and is a capital decision, not an architectural
one — so it is escalated in §13 rather than assumed here.

**What must not happen:** synthetic testnet fills flowing into `net_of_cost_apr` or
`time_in_range_pct` on the buyer surface. If C is built, the `SYNTHETIC` flag is a Tier 1 schema
item, not a Tier 2 nicety.

## 12. Build tiering for this category

> **⚠ SUPERSEDED 2026-08-27 as KC's work order, not as the category's risk ranking.** The
> agents-row note "goes first" is the order **inside the agents repo when that work starts.**
> Decision [`0003`](../architecture/decisions/0003-kc-ui-first-then-agents.md): KC scaffolds
> the UI (`apps/web`, `apps/console`) now, then moves to the agents. Marketplace rows in this
> table are unblocked either way. This table is otherwise unchanged.

Consistent with `04b` §4b.10, restricted to Rebalancing.

**Tier 1 — must ship**

| Item | Repo | Note |
|---|---|---|
| Real V3 position management via `NPM` (decrease/collect/mint), single band | agents | The top build risk in the project; still unspiked; goes first |
| Tick-spacing snapping + rounding rule + post-snap width assertion (§6.2) | agents | Silent-drift bug class |
| Decimals assertion against a known pool at startup (§3.3) | both | One line, catches a 10^n error |
| `market-data` reads: `positions`, `slot0`, `feeGrowth*`, `userPositionInfos`, `pendingCake` | marketplace | Five reads, everything else derives |
| `metrics`: `time_in_range_pct`, `net_of_cost_apr`, `divergence_loss_vs_hodl`, `rebalances_per_period` / `cost_per_rebalance` | marketplace | Pure functions, exhaustively unit-testable |
| `apps/watch` tick accumulation + observation-window start on every number (§7.3) | marketplace | Without this the headline KPI does not exist |
| Pool-viability precondition + decline written as Evidence (§6.1) | both | Cheapest credibility in the document |
| MasterChefV3 unstake/re-stake path (§6.6) | agents | Otherwise the agent fails on farmed positions |
| Session scope per §10, with visible revoke | marketplace | Altana track, same work |
| Category surface §9.1–9.5 | marketplace | This is the scored deliverable |

**Tier 2 — in this order**
1. Base + limit dual position (§6.3) and `limit_band_fill_rate`.
2. Shadow measurement across third-party mainnet positions (§7.4) — *promote to Tier 1 if the
   first-party agent slips.*
3. EV gate (`04b` §4b.4).
4. Regime segmentation on rollups (`04b` Rule 4).
5. `fee_share_achieved`, `time_to_recovery`.

**Tier 3 — stretch**
- Volatility-scaled band width.
- One Infinity CLAMM position minted on testnet and surfaced (`04b` §4b.9's hedge).

**Explicitly post-hackathon**
- EV-gated rebalancing with the full stochastic cost model (`04b` ladder level 5).
- Multi-position portfolio-level range allocation.

## 13. Open items

**Tuning values — not architectural gaps** (consistent with `04` §4.7, `04b` §4b.11):
band width `w`, drift threshold `X`, time backstop, slippage cap, gas ceiling, volatility
estimator window and price source, limit-band un-fill policy, regime classifier boundary.
Deliberately not pinned; tuned against real behaviour.

**Open decisions — need an explicit call, flagged not assumed:**

1. **Mainnet with real capital (Option B, §11).** A capital-and-risk decision for KC/Ryuk, not a
   technical one. Blocks first-party mainnet EXECUTION evidence and the strongest form of the
   Altana track claim. *Needed before the agent's Ring 3 promotion.*
2. **Historical data source for backfill (§7.3).** Public RPC cannot serve `eth_getLogs`; an
   archive endpoint or subgraph is a real dependency with a real cost. Without it, every KPI's
   window starts the day we deploy the watcher — which is honest but thin at judging time.
3. **Scoring treatment of shadow-measured agents (§7.4/§8).** They have no counterparty, so the
   diversity term has nothing to discount. Neutral is proposed; it needs confirming, and it
   interacts with `02`'s independence maths.
4. **Session scope granularity for the MasterChefV3 re-stake path (§10).**
5. **Verify the PancakeSwap Position Manager retirement claim (§3.9)** at a primary source before
   it is used in the PancakeSwap-track pitch. Currently **[R]**, carried from `04b`, and the
   `pancakeswap` GitHub org was unreachable from this environment this session.

None of these block Tier 1. Items 1 and 2 block the *strongest* version of the evidence story and
should be answered within the week, not at submission.

## 14. Supersession record

Stamped in the same turn as this document, per `CLAUDE.md`:

- `docs/final-review-docs/README.md` — status table row added for this topic.
- `docs/architecture/04-category-agent-execution-architecture.md` — §4.3's Rebalancer row now
  points here as the canonical replacement (it already pointed at `04b`).
- `docs/architecture/04b-category-agent-strategy-models.md` — §4b.4 banner-stamped as expanded and
  superseded-in-part by this document; §4b.9's TVL figure corrected with a pointer to §3.8.

Unchanged and still canonical elsewhere: `04` §4.0–4.2, §4.4–4.6 (the loop, the pure-DECIDE
isolation, the capital rails, what a testnet run proves); `04b` §4b.2–4b.3 (maker-not-taker, the
four cross-cutting rules) and §4b.5–4b.7 (the other three agents, each awaiting its own document).

## 15. Sources

**Primary, verified live this session (chain 56 / chain 97, 2026-08-25):**
`PancakeV3Factory` `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` · `NonfungiblePositionManager`
`0x46A15B0b27311cedF172AB29E4f4766fbE7F4364` (56) / `0x427bF5b37357632377eCbEC9de3626C71A5396c1`
(97) · `MasterChefV3` `0x556B9306565093C855AEA9AE92A594704c2Cd59e` · WBNB/USDT pools at all four
tiers · five BSC-testnet pools · `api.llama.fi/protocol/pancakeswap-amm-v3`.

**Project-internal:** `LEARN-ONE-DAY.md` Blocks A, A2 (A2.2 equations, A2.3 traps, A2.4–A2.6 the
`E` identity, A2.7 range life, A2.8 `Net(w)`, A2.9 swap sizing, A2.10 base+limit, A2.12 metrics,
A2.13 the six correctness checks) and Block E (pipeline failure modes) · `RESEARCH.md` §5.1, §10 ·
`HACKATHON-FIRST-PRINCIPLES.md` §2.2–2.3 (the rubric reading in §2) ·
`docs/architecture/findings/2026-08-23-discovery-proof-engine-review.md` §4.

**Secondary, carried from `04b` §4b.12 and not re-verified here:** Charm Alpha Vaults whitepaper ·
Gauntlet *Uniswap ALM Analysis* · Milionis–Moallemi–Roughgarden–Zhang, *AMMs and
Loss-Versus-Rebalancing* (arXiv 2208.06046) · arXiv 2504.16542 · Atis Elsts, *Liquidity Math in
Uniswap v3*.
