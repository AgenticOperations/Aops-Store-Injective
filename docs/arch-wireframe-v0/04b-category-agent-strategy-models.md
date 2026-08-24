---
created: 2026-08-24
project: BUILD-BNB — BNB "Build the Era" marketplace
status: verified against primary sources (contract repos read directly via `gh api`, not docs
  sites) — see 4b.1 Provenance. Supersedes 4.3's decision-rule table; the rest of Section 4
  (the READ→DECIDE→ACT→RECORD loop, the pipeline dependency map, the pure-DECIDE isolation)
  is unchanged and still correct.
section: 4b of N — Category Agent Strategy Models (deep version)
depends_on: 04-category-agent-execution-architecture.md,
  03-evidence-trust-engine-pipeline.md, 01-data-model-state-machines.md
---

# Section 4b — Category Agent Strategy Models

## 4b.0 What this document changes, and what it does not

Section 4 got the **shape** of the four agents right and the **content** of them wrong.

What stays, unchanged and still correct:

- The shared `READ → DECIDE → ACT → RECORD` loop (4.2).
- `DECIDE` as a pure function with no I/O — this is what makes everything below testable
  without a testnet RPC, and it is what makes a "Preview / Simulate" button nearly free.
- The dependency map onto Sections 1–3 (4.1). No new Evidence path, no new pipeline, no new
  capital rail is introduced anywhere in this document.
- The Hexagonal / Modular-Monolith boundary (4.2) — `chain-adapters` is still the only place
  an external SDK is imported.

What this document replaces: **4.3's decision-rule table.** Every one of those four rules is a
threshold check, and 4.5 defended that as "a deliberate scoping choice, not corner-cutting."
That defence holds for *pipeline isolation* and fails for *economics*. Three of the four rules
are not neutral placeholders — they are strategies with a **known negative expected value**
under conditions that occur routinely:

| 4.3's rule | What it actually does |
|---|---|
| Rebalancer: "swap the excess side back to target" | Rebalances **token balances**, not an LP range. It never touches `NonfungiblePositionManager`, so it does not perform the mandated category at all. |
| Grid: "place the buy/sell order for that level" via `SwapRouter` | A `SwapRouter` call is a **market swap**, not an order. The agent pays the fee and the price impact on every fill, on a strategy whose entire edge is a few basis points per cycle. |
| Yield: "if another market beats the current one by more than a margin, withdraw and redeposit" | Ignores the cost of moving. On $10,000 chasing a +1% rate, break-even is ~110 days. The spread rarely lasts that long — so the rule loses money while displaying an optimisation. |
| Health factor: "repay debt or add collateral" | Assumes the user is holding spare stablecoins. A user whose collateral is crashing usually is not. The agent works only for the user who did not need it. |

This document defines what each agent should actually do, why, what it can be measured on, and
what fits in the time remaining.

**One framing point that matters for the whole document.** The scoring rubric's third axis is
*Agent Diversity — all four categories at equal depth*. "Depth" is not four agents existing.
It is four agents each producing a category-specific quality number that no one else on BSC
publishes. Section 1.9 left a placeholder for this (`metric_ontology_key`, "or a
category-specific KPI", undefined). 4b.4–4b.7 fill that placeholder, and 4b.8 collects the
result into one table.

---

## 4b.1 Provenance

Marker convention, matching the project's research documents:

- **[V]** — verified at source this session (contract repo read directly, live API call)
- **[R]** — reported by a credible secondary source, not verified at contract level
- **[A]** — inference or judgement; if wrong, something downstream changes

| Claim | Marker | Source |
|---|---|---|
| PancakeSwap Infinity CLAMM deployed on BSC mainnet **and** BSC testnet (chain 97), with `CLPositionManager`, `CLQuoter`, `CLTickLens` | **[V]** | `pancakeswap/infinity-core` and `pancakeswap/infinity-periphery`, `script/config/bsc-mainnet.json` + `bsc-testnet.json`, read via `gh api` |
| Official Infinity CL hooks exist: `limit-order` (`CLLimitOrder.sol` — `place()`/`kill()`/`withdraw()`), `dynamic-fee`, `full-range`, `geomean-oracle`, `vecake-exclusive` | **[V]** | `pancakeswap/infinity-hooks`, `src/pool-cl/` |
| `CLLimitOrder` is **not** in Infinity's official deploy scripts (only veCake-exclusive and dynamic-fee samples are) — using it means deploying it ourselves | **[V]** | `pancakeswap/infinity-hooks/script/` |
| Venus has native flash loans on the BNB Chain Core Pool, all vTokens except vBNB, via a Diamond `FlashLoanFacet`; ~0.09% fee; self-liquidation and deleveraging are named intended use cases | **[V]** | `VenusProtocol/venus-protocol` (`contracts/Comptroller/Diamond/facets/FlashLoanFacet.sol`, `contracts/FlashLoan/interfaces/IFlashLoanReceiver.sol`) + `docs-v4.venus.io` FlashLoan reference |
| Venus's own agent skill carries risk heuristics beyond the HF formula: concentration >70%, borrow liquidity <2× requested, utilisation >85%, +0.10 buffer on event risk; and it is **simulate-by-default** with an explicit `--confirm YES` broadcast guard | **[V]** | `VenusProtocol/venus-agent-skills`, `references/risk-rules.md` and `references/skill-summary.md` |
| Venus's official skill **monitors and simulates but does not intervene** on health factor | **[V]** | same — capability list is market scan, exposure, what-if borrow, deposit, withdraw. No repay-to-target automation. |
| Aave V3 is live on BNB Chain with BNB/WBTC/BETH/WETH/USDC/USDT | **[R]** | Aave docs + app market listing |
| Altana ships ten production skills; **none** is a V3 range-management skill — the PancakeSwap Liquidity skill is **V2**, and V2 pools have no ranges | **[R]** for the skill list, **[V]** for the V2 gap (already recorded in `RESEARCH.md` §3.5 and §10) | `skills.altana.network` |
| Charm Alpha Vaults' "passive rebalancing" = wide base order + one-sided limit order, no swaps, so the vault **receives** rather than pays the swap fee and has no price impact or MEV exposure | **[R]** | Charm whitepaper + Charm engineering write-ups |
| Threshold-based rebalancing captures most of the benefit of periodic rebalancing with far fewer trades; concentration **worsens** LVR; ETH/BTC-stable LPs lost ~5–7% of capital to LVR in 2023 | **[R]** | LVR literature survey; arXiv 2504.16542, arXiv 2508.02971 |
| Gamma's ~15% median APY was approximately **half external incentives**, not strategy return | **[R]** | Gauntlet, *Uniswap ALM Analysis* |
| Avellaneda–Stoikov as implemented in Hummingbot: reservation price skews against inventory, spread set by volatility (γ) and book liquidity (κ), order sizes asymmetric (η) toward an inventory target | **[R]** | Hummingbot strategy docs |
| Grid risk practice: hard stop outside the lower boundary, ≤10–20% of capital per level, 15–20% max-drawdown full-grid close | **[R]** | practitioner risk-management literature |
| Yearn v3 allocator model: curator **splits** across venues on a rate-comparison signal rather than switching wholesale; Beefy sits a few hundred bps lower because compounding is passive rather than actively reallocated | **[R]** | yield-aggregator comparisons, 2026 |

The domain arithmetic used throughout (time-in-range economics, rebalance cost tables, the
break-even formula, the HF worked example, inventory skew) is the project's own
`LEARN-ONE-DAY.md`, Blocks A–D. It is referenced, not re-derived.

---

## 4b.2 The single change that upgrades three of the four agents

### The problem, in one line

4.3 routes the rebalancer, the grid trader, and (implicitly) the yield optimiser through
`SwapRouter`. That makes every agent a **taker**.

A taker, on every single action:

1. **pays** the pool's swap fee (0.01% / 0.05% / 0.25% / 1% depending on tier),
2. **pays** price impact against pool depth,
3. **broadcasts its intention** into a public mempool, where a searcher can buy in front of
   it, let the trade move the price, and sell back — the cost coming straight out of the
   user's execution.

### The alternative: a range order

PancakeSwap V3 (like Uniswap v3, which it forks) supports minting liquidity **entirely on one
side of the current price**, in a narrow band. As price crosses that band, the position
converts completely into the other token.

That is a limit order, with two differences — one good, one that must be disclosed:

```
                          Market swap (4.3)        Range order (this document)
  ────────────────────────────────────────────────────────────────────────────
  swap fee                PAYS 0.05–0.25%          RECEIVES it
  price impact            yes                      none
  MEV / sandwich          exposed                  nothing to front-run
  fill                    immediate, guaranteed    when price arrives
  can it un-fill?         no                       YES — if price crosses back
```

The last row is a real trade-off, not a footnote. A range order that is 80% filled and then
sees price reverse ends up partially filled at a worse effective position than a swap would
have been. That is the honest cost of choosing maker over taker.

**And that cost is itself a marketplace feature.** "We chose passive fills; here is the
measured fill rate and the measured fee income that paid for it" is exactly the kind of number
Criterion 2 ("beyond basic counts… a genuinely informed call") is asking for, and no other
agent on BSC publishes it.

### Why this matters structurally

This is the design at the heart of **Charm's Alpha Vaults**, the most-forked strategy in the
automated-liquidity-management category. It is not exotic and it needs no hooks and no
Infinity — it works on PancakeSwap V3 today, through `NonfungiblePositionManager`, which
Section 4.3 never mentions.

It also **unifies two of the four agents**: the rebalancer's limit band and the grid trader's
ladder rungs are the same primitive. One adapter surface, two agents.

---

## 4b.3 Four rules that apply to every agent

These are cross-cutting. Each is cheap, each is defensible to a judge, and each maps to a
scored criterion.

### Rule 1 — Be a maker, not a taker

Per 4b.2. Where an agent needs to change its token composition, prefer a range order over a
swap. Fall back to a swap only when the fill must be immediate (health-factor interventions —
see 4b.7 — are the clear exception, because latency *is* the product there).

### Rule 2 — Simulate by default; broadcast only on explicit confirmation

Venus's own official agent skill defaults every execution path to simulation and requires an
explicit `--confirm YES` guard to broadcast **[V]**. That is the sponsor telling us, in a file,
what they consider a well-behaved agent.

Our design already makes this nearly free: 4.2's `DECIDE` is a pure function, so running it
against current state and rendering the would-be action **without** calling `ACT` or `RECORD`
requires no new component. This is the "Preview / Simulate" surface already identified as
high-value in the discovery/proof-engine findings doc — 4b just makes it the *default* mode
rather than an extra button.

### Rule 3 — Prices come from the protocol's own oracle, never a DEX quote

An agent that computes a health factor from a spot DEX price gets a **different number than
the lending protocol does**, and therefore acts at the wrong moment, or fails to act at the
right one (`LEARN-ONE-DAY.md` B6). The same applies to any decision gated on a protocol's
internal accounting: read the protocol's oracle.

Practical consequence for `chain-adapters/defi`: the Venus adapter must expose oracle-sourced
prices as a first-class read, distinct from any DEX price it also reads for execution routing.
Two different price concepts, never interchanged.

### Rule 4 — Segment every performance number by market regime

Rebalancing helps in **trending** markets and hurts in **choppy** ones, because in chop the
agent keeps crystallising losses that would have reverted on their own. The same agent, with
no change in quality, looks brilliant one month and terrible the next.

Reporting one blended lifetime number is therefore a lie of omission. Every `Performance`
rollup (1.6 / 3.5) for a trading-adjacent category should carry a regime label, so the buyer
can see *"+8% in trend, −2% in chop"* rather than *"+3%"*.

This costs one extra dimension on the rollup key. It is the single most honest thing in the
product and it is nearly free.

---

## 4b.4 Agent 1 — LP Range Rebalancer

### The job, in plain English

A user has money in a PancakeSwap V3 concentrated-liquidity position: *"I'll provide trading
liquidity, but only between $550 and $650."* While price sits inside the band, every trade
that passes through pays them a fee. **The moment price leaves the band, they earn nothing at
all** — not less, nothing — and they are left holding 100% of whichever token is now the wrong
one.

The agent's job is to keep the position earning, without spending more on rebalancing than the
position earns.

### Why 4.3's version does not do this job

4.3's rebalancer reads *"wallet's token split (e.g. BNB/USDC balances) vs. configured target
split"* and swaps to restore the ratio. That is a **portfolio rebalancer** — a useful thing,
and a completely different thing. It never reads a position, never computes a tick range,
never calls `NonfungiblePositionManager`. As specified, the hardest mandated category is not
covered.

### The strategy ladder the market actually built

| Level | Design | Shipped by | Weakness |
|---|---|---|---|
| 0 | Fixed band, never moved | correct only for stable pairs | dead the moment price trends |
| 1 | Symmetric band re-centred on price, swap to 50/50 | most hackathon builds | pays fee + impact + MEV every time |
| 2 | Threshold-triggered re-centring (drift %, not a timer) | Gamma "Dynamic Range" | still a taker |
| 3 | **Base + limit dual position** — wide base band around price earning fees, plus a one-sided limit band holding the surplus token, so **the market rebalances the position and pays for the privilege** | **Charm Alpha Vaults** | two positions to track |
| 4 | Volatility-scaled width — band expands and contracts with realised σ | Mellow "Pulse", Arrakis Pro | needs a volatility estimator |
| 5 | EV-gated — act only when expected fee gain over the horizon exceeds gas + swap + realised divergence loss | academic frontier (arXiv 2504.16542) | needs the full cost model |

### The arithmetic that decides the trigger

From `LEARN-ONE-DAY.md` A3–A4. A rebalance is four transactions —
`decreaseLiquidity → collect → swap → mint` — and it **crystallises** a loss that was
previously only on paper. On a $5,000 position at roughly $4 per rebalance:

| Frequency | Monthly cost | Annualised, as % of position |
|---|---:|---:|
| Daily | ~$120 | **~29%/yr** |
| Every 3 days | ~$40 | ~9.6%/yr |
| Weekly | ~$17 | ~4.1%/yr |
| Only on range exit | varies | usually lowest |

**A daily rebalancer can burn more than the pool pays.** This is why "how often does it act"
is a first-class thing to display, and why an agent that acts constantly is not automatically
a good agent.

The research agrees from the other direction: threshold-based rebalancing captures most of the
benefit of periodic rebalancing with far fewer trades **[R]**.

### The model to build

```
POSITION   base band   [P·(1−w), P·(1+w)]        w scaled to realised volatility
         + limit band  one-sided, on the surplus token
                       ← the market fills this, and pays the fee to us

TRIGGER    drift of X% of band width from centre
        OR full range exit
        OR elapsed-time backstop (so a frozen agent is visible, not silent)

GATE       act only if  expected_fee_gain(horizon) > gas + swap + realised_divergence
           (Tier 2 — see 4b.10. Tier 1 ships the trigger without the gate.)

REPORT     segmented by regime (Rule 4)
```

**Contract surface:** `NonfungiblePositionManager` (`mint`, `increaseLiquidity`,
`decreaseLiquidity`, `collect`), `QuoterV2` for pre-trade pricing, `TickLens` for pool state.
Testnet addresses already confirmed in Section 3's Verification Addendum. `SwapRouter` remains
in the adapter as the fallback path when a range order cannot be used.

**Tick handling** (`LEARN-ONE-DAY.md` A5): ticks must be multiples of the pool's `tickSpacing`,
which is tied to the fee tier — ranges snap to a grid, they are not arbitrary. 1 tick ≈ 0.01%,
so a ±5% band is roughly ±500 ticks.

### Category KPIs this agent produces

| KPI | Definition | Why it wins |
|---|---|---|
| **% time in range** | fraction of elapsed time the position was earning | Two agents in the same pool at 60% vs 90% earn ~18% vs ~27% on identical capital. **Nobody on BSC publishes this.** |
| **Net-of-cost APR** | gross fees − gas − swap − slippage − realised divergence | the honest version of the number every dashboard shows gross |
| **Divergence loss vs HODL** | what holding would have produced, minus what the position produced | the number every ALM hides |
| **Rebalances/month, cost per rebalance** | count and USD | proves "more automation" is not automatically better |
| **Limit-band fill rate** | share of limit bands that filled vs. un-filled | the honest cost of choosing maker over taker |

---

## 4b.5 Agent 2 — Grid Trader

### The job, in plain English

A user wants to profit from a price bouncing up and down without watching a screen. The agent
places a ladder of buys below the current price and sells above it. Price falls, a buy fills;
price rises, a sell fills; repeat, maintaining the ladder.

### Why 4.3's version is the version that blows up

Two separate problems.

**First, it is a taker.** "Place the buy/sell order for that level" via `SwapRouter` is a
market swap. For a strategy whose entire edge is a few basis points per cycle, paying the fee
and the impact on every fill is not a rounding error — it is the whole margin.

**Second, and worse: there is no inventory model at all.** The known failure mode
(`LEARN-ONE-DAY.md` D4) is that a grid in a falling market dutifully buys all the way down and
ends up holding a growing pile of a falling asset. It can display a **positive profit per
completed trade while the account bleeds.** 4.3's rule has no term that sees this happening
and no term that stops it.

Practitioner risk management treats this as the defining risk of the category: a hard stop
outside the lower boundary, no more than 10–20% of capital committed per level, and a 15–20%
max-drawdown rule that closes the entire grid and accepts a defined loss rather than hoping
for a recovery **[R]**.

### The professional version: inventory-aware quoting

The reference model is **Avellaneda–Stoikov**, which is what real market makers use and what
Hummingbot implements **[R]**. In plain language:

- Quotes are not centred on mid price. They are centred on a **reservation price** that shifts
  *against* current inventory — holding too much BNB pushes quotes down, so the agent sells
  more eagerly and buys less eagerly.
- **Spread widens with volatility** and narrows with available liquidity.
- **Order sizes go asymmetric** to pull inventory back toward its target faster.

A fixed grid is Avellaneda–Stoikov with all of the intelligence removed. Adding back the
inventory-skew term alone — one term — is the difference between a bag-holder bot and a market
maker.

### The model to build

```
LADDER   range orders, not swaps          ← maker: the fee becomes income, not expense
SKEW     level spacing and per-level size shift against inventory,
         pulling toward an inventory_target_pct
WIDTH    grid spacing scaled to realised volatility, not fixed ticks
GUARD 1  trend filter — a decisive break of the outer band SUSPENDS the grid
         (a grid is a bet on mean reversion; stop making that bet in a trend)
GUARD 2  max-drawdown kill — close the grid at a defined loss
CAP      ≤20% of capital committed per level
```

Guards 1 and 2 are not optional hardening. They are the strategy — a grid without them is a
leveraged long that has not noticed yet.

**Contract surface:** same as 4b.4 — `NonfungiblePositionManager` for the ladder rungs, with
`SwapRouter` as the fallback. This is the payoff from 4b.2: the grid and the rebalancer share
one adapter.

### Category KPIs this agent produces

| KPI | Definition | Why it wins |
|---|---|---|
| **Inventory skew over time** | base-asset share vs. target, as a series | The single most honest grid chart there is. Nobody displays it. |
| **Realised PnL vs mark-to-market PnL** | closed-trade profit vs. total account value | Exposes the "profitable trades, bleeding account" illusion directly |
| **Max drawdown** | worst peak-to-trough | TermiX explicitly asks trading agents for the risk taken, not just the win rate. Render at **equal visual weight** to return. |
| **Maker fill share** | fills as maker vs. taker | proves the fee is income, not expense |
| **Grid suspensions** | count of trend-filter and drawdown halts | an agent that stops itself is more trustworthy than one that never does |

---

## 4b.6 Agent 3 — Yield Optimiser

### The job, in plain English

A user has idle stablecoins. The agent compares returns across venues and puts the money where
it earns most — **and moves it only when moving is actually worth it.**

### Why 4.3's version loses money

4.3: *"If another market beats the current one by more than a configured margin, withdraw and
redeposit there."* The rule has no cost term. `LEARN-ONE-DAY.md` C2 already disproved it:

```
Capital           $10,000
Rate advantage    +1% APR
Extra earnings    $100/year  =  $0.274/day
Migration cost    ~$30 (swap + gas + slippage, both directions)

days_to_break_even = 30 / 0.274  ≈  110 days
```

**Nearly four months just to recover the cost of moving.** Lending-rate advantages rarely
persist that long. A "configured margin" threshold with no notion of cost, persistence, or
capital size will chase spreads and lose money while displaying an optimisation.

Three more traps the rule cannot see (`LEARN-ONE-DAY.md` C3):

- **APR vs APY** — comparing one venue's APY to another's APR overstates the gap.
- **Reward-token risk** — "40% APR" paid in a token that falls 60% is not 40%.
- **Utilisation drift** — rates move with supply and demand, and **our own deposit moves the
  rate we just chased.** Venus's own skill flags utilisation >85% as a rate-shock warning
  **[V]**.

### What best-in-market does: allocate, do not switch

**Yearn v3's allocator model** is the reference shape: a base vault holds the asset, and a
curator allocates *across* venues on a rate-comparison signal — splitting, not switching
**[R]**. Beefy sits a few hundred basis points lower on equivalent strategies precisely
because its compounding is passive rather than actively reallocated **[R]**.

The difference matters directly: **allocation is marginal, switching is total.** Moving 20% of
capital to capture a spread costs 20% of the migration cost. A binary switch pays 100% of it,
every time.

### The model to build

```
COMPARE   net APY, never gross:
            gross − protocol fee − swap in − gas in − gas out − slippage − agent fee

DECIDE    move only if ALL of:
            days_to_break_even = migration_cost / (capital × Δapr / 365)
            AND the spread has already persisted longer than break_even
            AND post-move utilisation will not collapse the edge
            AND destination liquidity / borrow-cap risk is not worse
            AND reward-token yield is discounted to realised, not quoted, value

ALLOCATE  split across Venus / Aave V3 / Lista / PancakeSwap — marginal, not total

VENUES    Venus (primary, testnet-confirmed), Aave V3 on BNB Chain [R], Lista, PancakeSwap
```

Risk heuristics come from Venus's own published skill **[V]**, not invented: concentration
>70% in one volatile asset bumps risk a level; available liquidity <2× the requested amount is
an execution-risk warning; utilisation >85% is a rate-shock warning.

### The product feature that wins this category

Put the break-even arithmetic in the UI **at decision time**, including when the answer is
"do nothing":

> **Proposed move:** $10,000, Venus → Aave V3
> **Rate advantage:** +0.9% APR
> **Cost to move:** $31 (swap $18 · gas $4 · slippage $9)
> **Pays for itself in:** 126 days
> **This spread has held for:** 11 days
> **Recommendation: do not move.**

An agent that publicly recommends *not acting*, with the arithmetic shown, is the most
credible object on the marketplace. It is also a direct, literal answer to Criterion 2.

### Category KPIs this agent produces

| KPI | Definition |
|---|---|
| **Realised net APY vs projected net APY** | what the user actually received vs. what was forecast |
| **Days-to-break-even per proposed move** | computed and displayed for every proposal, taken or not |
| **Moves declined, with reason** | the honesty metric — an agent that declines is demonstrating judgement |
| **Migration cost per move** | USD, itemised |
| **Capital utilisation %** | share of capital actually earning |

---

## 4b.7 Agent 4 — Health Factor Guardian

### The job, in plain English

A user deposited $20,000 of collateral and borrowed $10,000 against it. If the collateral's
price falls far enough, the protocol force-sells it at a penalty — liquidation. The health
factor is how close they are.

```
HF = weightedCollateralUSD / debtUSD          (Venus's own published formula)

Deposit $20,000 BNB, collateral factor 0.8 · borrow $10,000 USDT
  HF = (20,000 × 0.8) / 10,000 = 1.60      comfortable
BNB −25% →
  HF = (15,000 × 0.8) / 10,000 = 1.20      danger
BNB −37.5% →
  HF = (12,500 × 0.8) / 10,000 = 1.00      liquidatable
```

The intervention, solved rather than guessed — restore HF 1.20 to 1.50:

```
(15,000 × 0.8) / debt = 1.50   →   debt = $8,000   →   repay $2,000
```

**That number — computed live, shown before it happens — is the product.**

### Why 4.3's version fails in the exact scenario it exists for

*"Repay debt or add collateral until it's back above target."* **Repay with what?** A user
whose collateral is crashing is, almost by definition, not sitting on spare USDT. "Add
collateral" has the same problem. As specified, the agent works only for the user who did not
need it.

### The verified fix: Venus has native flash loans

Venus enabled flash loans across the BNB Chain Core Pool — all vTokens except vBNB — through a
Diamond-architecture `FlashLoanFacet`, and names **self-liquidation and deleveraging as
intended use cases** **[V]**:

```solidity
// FlashLoanFacet.sol
function executeFlashLoan(
    address payable onBehalf,
    address payable receiver,
    VToken[] memory vTokens,
    uint256[] memory underlyingAmounts,
    bytes memory param
) external nonReentrant;

// our contract implements IFlashLoanReceiver
function executeOperation(
    VToken[] calldata vTokens,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    address onBehalf,
    bytes calldata param
) external returns (bool success, uint256[] memory repayAmounts);
```

Fee ≈ 0.09% **[V]**. That enables **collateral-funded deleveraging**, atomic, requiring zero
idle capital:

```
flash-borrow USDT  →  repay debt  →  withdraw the freed collateral
                   →  swap to USDT  →  repay the flash loan
                                        ── all in one transaction
```

HF goes 1.18 → 1.45 and the user never needed a dollar in their wallet. This is the largest
single capability gap between 4.3 and the professional product in this category.

**This introduces no new capital-custody rail.** The flash loan opens and closes inside one
transaction; the Altana session (1.3) remains the sole custody rail, exactly as Section 4.4
already specifies. What changes is only which contract the session is allowed to call.

### Three drivers, not one

4.3 watches the ratio. `LEARN-ONE-DAY.md` B3 lists what moves it:

1. **Collateral price falls** — the obvious one.
2. **Borrowed asset price rises** — bites without the collateral moving at all.
3. **Interest accrues** — debt grows silently. A position untouched for months drifts toward
   danger in a **totally flat market.**

A threshold check catches all three eventually. Only a **projected** HF catches them early
enough to act cheaply.

### Gas during a crash

The moment this agent is most needed is the moment blocks are full and gas spikes. An agent
with a fixed gas policy fails precisely when it matters. This is not a hypothetical edge case —
it is the modal failure. The agent needs an escalating fee policy, and **intervention latency**
is the metric that exposes whether it works.

### The permission story — the best screen in the product

Safe interventions raise HF. Unsafe ones lower it (`LEARN-ONE-DAY.md` B4):

| Allowed | Never allowed |
|---|---|
| Repay debt | Borrow more |
| Add collateral | Withdraw collateral |
| | Swap collateral into something volatile |

This maps directly onto the Altana allowlist (1.3). The authorization screen reads:

> *"This agent can pay down your loan and add collateral. It cannot borrow, it cannot
> withdraw, and it cannot move your money anywhere. It stops on 16 September. Here is the off
> switch."*

Nobody is afraid of that agent. That sentence is simultaneously the Altana track's scored
requirement and PancakeSwap's *"without ever putting user funds at risk."*

### The model to build

```
READ       Venus oracle prices — never a DEX quote (Rule 3)
PROJECT    HF now, plus time-to-HF-1.0 given realised volatility
           → act on the projection, not only the current number
DECIDE     repay = debt − (weightedCollateral / target_HF)
           thresholds from Venus's own published rules: danger <1.15,
           target ≥1.30, ≥1.40 for volatile collateral, +0.10 on event risk
ACT        flash-loan deleverage (collateral-funded, zero idle capital)
           fall back to direct repay when the user does hold the asset
GAS        escalating fee policy — this fires during crashes by definition
PERMISSION Altana allowlist = repay + supply ONLY
```

Note this is the **one agent where Rule 1 does not apply**: latency is the product, so the
swap leg inside the flash-loan route must be a taker. That is a deliberate exception, not an
oversight.

### Category KPIs this agent produces

| KPI | Definition | Why it wins |
|---|---|---|
| **Intervention latency** | threshold crossed → transaction confirmed | This *is* the product. Nobody measures it. |
| **Minimum HF ever reached** | the low-water mark | did it ever actually get close? |
| **Interventions needed vs executed** | detected vs acted | exposes silent failure |
| **False-positive rate** | acted when it did not need to | acting unnecessarily costs real money |
| **Liquidations avoided / suffered** | count | binary and emotionally obvious to any judge |
| **Cost per intervention** | gas + flash-loan premium + swap | honest total |

---

## 4b.8 The category KPI table — filling Section 1.9's placeholder

Section 1.9 defines a generic metric ontology (QUALITY / RELIABILITY / LATENCY /
SUCCESS_RATE / COST_EFFICIENCY / PERFORMANCE / RISK / ACCURACY / USER_SATISFACTION) and then
says "or a category-specific KPI" without defining any. That undefined clause is where the
rubric's *Agent Diversity — equal depth* axis lives.

These are the category-specific `metric_ontology_key` values, written into `Evidence` by 3.4's
domain-KPI pipeline and rolled up by 3.5:

| Category | Primary KPI | Risk KPI (rendered at equal weight) | Cost KPI | Honesty KPI |
|---|---|---|---|---|
| **Rebalancing** | `% time in range` | `divergence_loss_vs_hodl` | `cost_per_rebalance`, `rebalances_per_month` | `limit_band_fill_rate` |
| **Grid** | `realised_pnl` | `max_drawdown`, `inventory_skew_series` | `maker_fill_share` | `grid_suspensions` |
| **Yield** | `realised_net_apy` | `destination_liquidity_risk` | `migration_cost_per_move` | `moves_declined_with_reason` |
| **Health factor** | `intervention_latency` | `min_hf_reached` | `cost_per_intervention` | `false_positive_rate` |

Two display rules apply to all four, from `LEARN-ONE-DAY.md` D3/D5 and Section 1.9:

- **Never render a return without its risk next to it, at equal visual weight.**
- **Every number ships with its sample size**, and `confidence` scales with it. An agent at
  94/100 from 12 observations must not outrank one at 88/100 from 12,000 — which is exactly
  what Section 1.9's `score`/`confidence` split already exists to prevent.

---

## 4b.9 Verified BSC contract surface

### PancakeSwap — V3 vs Infinity

**Finding [V]:** PancakeSwap **Infinity** CLAMM is deployed on BSC mainnet *and* BSC testnet
(chain 97), and ships official CL hooks including a native limit-order hook.

```
BSC testnet (97)   clPoolManager       0x36A12c70c9Cf64f24E89ee132BF93Df2DCD199d4
                   clPositionManager   0x77DedB52EC6260daC4011313DBEE09616d30d122
                   clQuoter            0x5d544D0ad627a72d7Fb53c22D8888663FC5d5B0d
                   clTickLens          0x05a732bb9A23256F57f9FdF255212979368Ece39
                   vault               0x2CdB3EC82EE13d341Dc6E73637BE0Eab79cb79dD

BSC mainnet (56)   clPoolManager       0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b
                   vault               0x238a358808379702088667322f80aC48bAd5e6c4

Official CL hooks  limit-order (CLLimitOrder.sol — place/kill/withdraw),
                   dynamic-fee, full-range, geomean-oracle, vecake-exclusive
```

Section 3's Verification Addendum confirmed **V3** addresses only. Infinity is the version
PancakeSwap is actively promoting, and it carries the primitives these strategy models want as
first-class hooks.

**Decision: build on V3. [A]** Reasoning, stated so it can be attacked:

1. Everything in 4b.4 and 4b.5 works on V3 **today**, with no hooks — Charm proved the
   base+limit pattern on Uniswap v3 years before hooks existed.
2. V3 holds the deep existing liquidity, and its addresses are already verified in Section 3.
3. The PancakeSwap-track pitch is a **V3** story: the retired Position Manager (deposits
   disabled May 2025, removed from the UI June 2025) means the largest DEX on BSC has ~$273M
   of V3 liquidity and no working automated management for it. *"You tried vaults; agents fix
   the reasons vaults did not stick."*
4. `CLLimitOrder` is **not** in Infinity's official deploy scripts **[V]** — using it means
   deploying and maintaining a hook ourselves. That is a real cost and a poor bet with the
   time remaining.

**Recommended hedge:** mint **one** Infinity CLAMM position on testnet and surface it in the
UI. That converts "we did not know about Infinity" into "we are already on it" for roughly an
afternoon's work. Scoped in 4b.10 as Tier 3.

### Venus

Already confirmed in Section 3 (`Unitroller` testnet `0x94d1820b2D1c7c7452A163983Dc888CEC546b77D`,
mainnet `0xfD36E2c2a6789Db23113685031d7F16329158384`). New this session:

- **Flash loans** via the Diamond `FlashLoanFacet` — `executeFlashLoan(...)` /
  `IFlashLoanReceiver.executeOperation(...)`, ~0.09% fee, all vTokens except vBNB,
  self-liquidation and deleveraging named as intended uses **[V]**.
- **`venus-agent-skills`** carries risk heuristics beyond the HF formula (concentration,
  borrow-cap thinness, utilisation, event buffer), is **simulate-by-default**, and prescribes
  user-facing language: use *"estimated"*, *"based on current data"*; never *"safe for
  sure"* **[V]**.

### The gap the sponsors left open

Venus's official skill **monitors, simulates, and executes deposits/withdraws — it does not
intervene on health factor [V]**. Altana ships ten production skills and **none is a V3
range-management skill**; its PancakeSwap Liquidity skill is **V2**, and V2 pools have no
ranges at all.

So the two hardest mandated categories have **no off-the-shelf path from any sponsor**. That
is simultaneously the top build risk (already recorded in `RESEARCH.md` §10) and the reason
these two agents are the most defensible things in the submission if they work.

---

## 4b.10 Build tiering

Everything below is a change **inside `DECIDE`** unless marked otherwise — which is the
payoff from 4.2's pure-function isolation. None of it touches the Section 1–3 pipeline.

### Tier 1 — must ship

| Item | Agent | Touches |
|---|---|---|
| Real V3 LP-range management via `NonfungiblePositionManager` | Rebalancer | `chain-adapters/defi` (new surface) + `DECIDE` |
| Oracle-sourced prices; solved repay-to-target; repay+supply-only allowlist | Health factor | `DECIDE` + Altana scope config |
| Net-of-cost comparison, break-even gate, "do not move" recommendation | Yield | `DECIDE` only |
| Inventory-skew term + max-drawdown kill + trend suspension | Grid | `DECIDE` only |
| Simulate-by-default (Rule 2) | all four | UI + existing pure `DECIDE` |
| Category KPIs written as Evidence (4b.8) | all four | 3.4's existing pipeline |

The rebalancer is the only Tier 1 item that is real engineering rather than decision logic. It
is also the top risk in the project and is still unspiked — **it goes first, before anything
else.**

### Tier 2 — should ship, in this order

1. Range orders instead of swaps for the **grid** (smaller change than for the rebalancer).
2. Base + limit dual position for the **rebalancer**, if the V3 spike lands early.
3. Venus flash-loan deleveraging for **health factor** — one contract implementing
   `IFlashLoanReceiver`. This is the largest genuine differentiator in the whole set.
4. Regime segmentation on `Performance` rollups (Rule 4).

### Tier 3 — stretch

- Volatility-scaled band widths (rebalancer, grid).
- One Infinity CLAMM position minted on testnet, surfaced in the UI (4b.9).

### Explicitly post-hackathon

- EV-gated rebalancing with the full stochastic cost model (ladder level 5).
- Full Avellaneda–Stoikov quoting — take the inventory-skew term only.
- Multi-venue yield allocation as a continuously-optimised split rather than a
  threshold-gated marginal move.

---

## 4b.11 Open items carried into implementation

Consistent with 4.7 and 5.8: these are tuning and sequencing decisions, not architectural gaps.

- **Band width `w`, drift threshold `X`, grid spacing, inventory target, APR-delta floor, HF
  target buffer** — config per agent, tuned against real testnet behaviour. Deliberately not
  pinned here.
- **Volatility estimator** — realised σ over what window, and on what price source. Needs one
  decision at implementation time; the strategy shape does not change with it.
- **Range-order un-fill policy** — how long a partially-filled limit band is left before it is
  converted or cancelled. Affects the fill-rate KPI; does not change the model.
- **Flash-loan route** — Venus flash loan vs. a plain withdraw→swap→repay sequence, decided per
  market by which is cheaper at the time. Both terminate in the same `RECORD` step.
- **Regime classifier** — what counts as "trending" vs "choppy" for Rule 4's segmentation.
  Start with a simple realised-volatility band; refine with data.
- **Infinity hedge** — whether the one testnet CLAMM position gets minted at all depends
  entirely on Tier 1 landing on schedule.

---

## 4b.12 Sources

Primary (read at source this session):

- `pancakeswap/infinity-core` · `script/config/{bsc-mainnet,bsc-testnet}.json`
- `pancakeswap/infinity-periphery` · `script/config/bsc-testnet.json`, `src/pool-cl/CLPositionManager.sol`
- `pancakeswap/infinity-hooks` · `src/pool-cl/{limit-order,dynamic-fee,full-range,geomean-oracle}`
- `VenusProtocol/venus-protocol` · `contracts/Comptroller/Diamond/facets/FlashLoanFacet.sol`, `contracts/FlashLoan/interfaces/IFlashLoanReceiver.sol`
- `VenusProtocol/venus-agent-skills` · `references/risk-rules.md`, `references/skill-summary.md`
- `docs-v4.venus.io` · FlashLoan (Core Pool) technical reference

Secondary:

- Gauntlet, *Uniswap ALM Analysis*
- Charm Finance, *Alpha Vaults* whitepaper and engineering write-ups
- Arrakis Pro documentation
- Hummingbot, *Avellaneda & Stoikov* strategy guide and reference
- arXiv 2504.16542 — *AMMs: A Stochastic Optimization Approach for Profitable Liquidity Concentration*
- arXiv 2508.02971 — *Modeling Loss-Versus-Rebalancing via Continuous-Installment Options*
- LVR survey literature; grid-trading risk-management practice
- Yield-aggregator comparisons (Yearn v3 allocator model, Beefy), 2026

Project-internal:

- `LEARN-ONE-DAY.md` Blocks A–D — all domain arithmetic used above
- `RESEARCH.md` §3.5, §5, §10 — the Altana V2 gap, category decomposition, risk register
- `MARKET-RESEARCH.md` §4a, §5 — GIPS-style reporting, agentic-commerce security
- Section 3 Verification Addendum — V3 and Venus testnet addresses
