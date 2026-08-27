# Market Research — How Marketplaces Actually Solve The Problems BNB Has

**Companion to `HACKATHON-FIRST-PRINCIPLES.md` and `RESEARCH.md`**
Written 2026-08-17

---

## 0. Why this document exists

The other two documents answer *what BNB wants* and *what's technically available*. This one answers a different and more useful question:

> **These problems are not new. Who has solved them before, how, and what actually worked?**

The mistake most hackathon teams make is treating "AI agent marketplace" as a brand-new category with no prior art. It isn't. Every single pain point in the BNB brief has been fought over for 25 years — in used cars, on eBay, on Upwork, in fund management, on copy-trading platforms. The solutions are documented, tested at scale, and mostly ignored by crypto.

There's also a second surprise in here: **somebody is already building the exact "evidence layer" thesis** we landed on. Section 4.1. That's good news and bad news, and I'll be straight about both.

---

## 1. First, name the disease properly

BNB's problem has a formal name in economics, and naming it correctly tells you which solutions are even *possible*.

### 1.1 It's a lemons market

In 1970 George Akerlof described used cars. Sellers know if a car is good ("peach") or bad ("lemon"). Buyers can't tell. So buyers only offer the price of an *average* car. Good-car sellers refuse to sell at that price and leave. Average quality drops. Buyers offer even less. Repeat until **the market collapses into nothing but lemons** — or dies entirely.

Now substitute:

| Used cars | BSC agents |
|---|---|
| Seller knows if the car works | Developer knows if the agent works |
| Buyer can't tell before buying | User can't tell — 96% have dead endpoints |
| Buyers offer average price | Users assume any agent is probably junk |
| Good sellers exit | Good agent devs don't bother listing |
| Market fills with lemons | **← BSC is here** |

That last row is not a metaphor. It's measured: ~4% of BSC agents expose a live endpoint, ~59% of reviewers are coordinated fakes, and after removing fakes, 77.9% of rated agents have no real feedback left (arXiv 2606.26028).

**This is why BNB's number is stuck.** Not because agents are bad. Because *nobody can tell which ones aren't*, so nobody buys, so good builders don't come.

### 1.2 What economics says actually fixes it

Akerlof and Spence identified the counter-institutions that rescue lemons markets. There are only about five, and every real marketplace uses some combination:

| Fix | How it works | Real example |
|---|---|---|
| **Certification / inspection** | A trusted third party checks quality before listing | CarMax inspection, App Store review |
| **Warranty / guarantee** | Seller bears the cost if it's bad — costly for lemon-sellers, cheap for peach-sellers, so it's a *credible* signal | eBay Money Back Guarantee, "30-day returns" |
| **Reputation** | Repeat interaction makes cheating expensive | eBay feedback, Upwork JSS |
| **Signaling** | Seller does something only a good seller can afford | Posting a bond, staking collateral |
| **Intermediary liability** | The platform itself takes responsibility | Amazon "Fulfilled by Amazon", managed marketplaces |

**The key insight from the theory:** a signal only works if it is **more expensive for a bad seller than a good one**. A star rating anyone can fake costs a lemon-seller nothing, which is precisely why ERC-8004 reputation doesn't work. A staked bond that gets slashed, or a benchmark run you can't fake, does work — because it's asymmetrically costly.

**Applied to your build:** every trust feature you ship should pass this test — *"is this cheaper for a good agent than a bad one?"* Liveness probing passes (a dead agent literally cannot fake being reachable). Displaying self-reported success rates fails.

---

## 2. The six pain points, and how the market solved each

Here's each problem BNB has, matched to how other marketplaces beat it.

---

### PAIN 1 — "You can't tell which agents are real"

**Who else had this:** every services marketplace ever. Craigslist had it. Upwork had it. Airbnb had it.

**How they solved it — three tiers, in increasing strength:**

**Tier 1 — Verification (cheap, weak, essential).** Check the thing exists and responds. Email verified, phone verified, ID verified, endpoint responds. Weak signal but it kills the bottom 90% of noise instantly. *For you: liveness probing. It's Tier 1, and it alone removes 96% of the garbage.*

**Tier 2 — Platform-run testing (medium cost, strong signal).** Upwork ran skills tests. The App Store manually reviews apps. The platform itself checks capability rather than trusting the claim. *For you: your onboarding execution test — a safe, non-capital invocation per category.*

**Tier 3 — Observed outcomes (expensive, strongest).** Don't ask if it can; watch whether it did. *For you: on-chain evidence from real executions.*

**The design pattern to steal — separate CLAIMED from VERIFIED, visibly.** Airbnb doesn't merge "host says there's WiFi" with "Airbnb verified this listing." They're different badges. Merging them destroys the value of both.

> **Steal:** three explicit states — `CLAIMED` / `OBSERVED` / `VERIFIED` — never collapsed into one number. You already have this in `01-data-model`. Keep it visible in the UI, not just the schema.

---

### PAIN 2 — "The ratings are fake and meaningless"

This is the deepest, best-documented problem in the entire field. Three separate bodies of work matter.

#### 2a. The Sybil problem (computer science)

A "Sybil attack" is one person creating many fake identities to manipulate a system. Named in 2002; the literature is mature.

**What works, roughly in order of practicality for you:**

| Approach | Idea | Practicality |
|---|---|---|
| **EigenTrust** | Trust flows through a graph. Compute global trust as the principal eigenvector of who-trusts-whom, seeded from known-good "pre-trusted" peers | Real but needs a seed set |
| **SybilRank / trust propagation** | PageRank-style: trust flows poorly into fake clusters because fakes can't get edges from real accounts | Practical, graph-based |
| **MeritRank** | **Don't try to prevent Sybils — bound how much they can gain.** Accept some manipulation, cap its payoff | ⭐ Most realistic |
| **Economic grounding** | Only count feedback from parties who *demonstrably paid* | ⭐⭐ Strongest and simplest |

**The critical mental shift, from the MeritRank line of work:** trying to make a system *Sybil-proof* is basically impossible without centralised identity. Trying to make it *Sybil-tolerant* — where faking costs more than it earns — is achievable. Stop asking "is this reviewer real?" and start asking "how much can a determined faker move the number, and can we make that cost more than the gain?"

> **Steal:** your `independence_confidence` as a continuous 0–1 discount rather than a binary fake/real flag is exactly the MeritRank posture. That's the right call and it's backed by literature.

#### 2b. The silent-majority problem (economics — this one is subtle and important)

Nosko & Tadelis (NBER w20830) studied eBay and found something that breaks most reputation systems:

**Buyers who have a bad experience mostly leave without saying anything.** Leaving negative feedback takes effort and risks retaliation. So bad sellers' scores *stay high* — the damage shows up as silent churn, not as bad reviews.

Result: on eBay, nearly everyone had ~99% positive ratings, and the score became useless for discriminating between sellers.

**Their fix:** instead of the raw positive rate, compute **"effective percentage positive"** — count *silence as a weak negative signal* rather than as neutral. Then rank search results by that instead. In a controlled experiment, promoting sellers with better *effective* scores measurably improved outcomes for the platform.

**Why this matters enormously for you:** an agent that fails is unlikely to receive a bad on-chain review. The user will just revoke the session and walk away. **Your revocation data is your most honest quality signal, and it's data nobody else can see.**

> **Steal — and this may be the single most valuable idea in this document:**
> **Track early revocations as a negative quality signal.**
> A user who revokes 3 days into a 30-day session is telling you something they will never write in a review. An agent whose median session survives 28 of 30 days is genuinely different from one whose sessions die on day 2, and *no on-chain reputation system can see this*. You can, because you issue the sessions.
>
> Call it something like **"retention"** or **"survival rate."** It's honest, it's un-fakeable (faking it requires actually keeping users happy), and it's uniquely yours.

#### 2c. What Upwork does (the production system)

Upwork's **Job Success Score** is the closest working analogue to what you're building. Its inputs:

- Public star rating at contract close
- **Private feedback** the freelancer never sees (defeats retaliation-avoidance)
- **Long-term repeat clients — very high weight, compounding every 90 days**
- Contract value — bigger contracts weigh more
- Disputes, refunds, early endings — strong negatives
- Freelancer cancelling on a client — strongest negative

**What to take:** repeat business is weighted highest. That's the most honest signal in any marketplace, because *nobody hires a bad worker twice*. It cannot be faked without actually being good.

**What to avoid:** JSS's biggest, most-cited criticism is **opacity**. Freelancers can't tell why their score dropped, private feedback is invisible, and outcomes outside their control (a client vanishing) hurt them. It creates constant anxiety and mistrust.

> **Steal:** weight repeat hires and long-lived sessions above everything else.
> **Avoid:** an unexplainable score. Publish your methodology. Your creator console should show *why* a score is what it is, or you'll import Upwork's most-hated feature.

---

### PAIN 3 — "There's nothing good to list yet" (the cold start)

**The data:** a16z's marketplace research finds **roughly two-thirds of failed marketplaces die on the supply side, not demand.** Founders spend everything acquiring buyers and assume sellers appear.

**The three proven playbooks:**

**a) Constrain the choice set.** Dating apps show you a handful of matches a day, not the whole database. Counter-intuitively, *fewer, better options* converts better than infinite selection. Search cost is a real cost.
> *For you: never show a list of 200,000. Intent → a handful of verified candidates. Your intent-first design is this pattern.*

**b) Seed the supply yourself.** Almost every marketplace faked or manufactured early supply. Reddit's founders posted as fake users. OpenTable installed the software in restaurants themselves. This is standard, not cheating — **as long as you're honest about it.**
> *For you: your four first-party reference agents. Correct playbook, and the honesty requirement is why labelling them matters.*

**c) The managed marketplace.** When the service is complex, expensive, or trust-heavy, the platform stops being a passive listing board and takes operational responsibility — vetting, guaranteeing, sometimes delivering. This is why Uber beat "a directory of taxi drivers," and why Opendoor exists.
> *For you: "hiring software to trade my money" is maximally trust-heavy. **A passive directory is structurally the wrong shape.** The winning marketplace here is a managed one: it verifies, it monitors, it can pause a bad actor, it stands behind what it lists.*

**The liquidity threshold to know:** network effects don't switch on gradually — they flip when the marketplace's match quality reliably beats the user's next-best alternative. Below that line you're competing on liquidity and losing; above it, you become the default. For your purposes the practical version is: **be excellent in four narrow categories rather than mediocre across everything.** Depth creates the flip; breadth doesn't.

---

### PAIN 4 — "How do you prove a financial track record honestly?"

**This is the section nobody else in the hackathon will have read**, because it's not in crypto — it's in asset management, which has been fighting performance-claim fraud since the 1960s and has actual standards for it.

#### 4a. GIPS — the professional standard for presenting performance

The **Global Investment Performance Standards** exist because fund managers used to lie in three specific, predictable ways. GIPS bans each:

| The trick | What it looks like | GIPS rule |
|---|---|---|
| **Cherry-picking** | Show your best account, hide the rest | Must report a **composite** — *every* portfolio run in that strategy |
| **Survivorship bias** | Quietly drop the accounts that blew up | Closed/failed portfolios must stay in the record |
| **Period shopping** | "Returns since March 2023" (i.e. since the bottom) | Standardised, consistent time periods |

Plus: performance must be shown **net of fees**, and firms may hire an **independent verifier** — a voluntary third party who confirms the process, not just the numbers.

**Now apply this to agent marketplaces and watch it hurt:**

- An agent shows "+14% return" — **from which deployments?** All of them, or its best one? *(cherry-picking)*
- An agent version gets redeployed after losing money and starts fresh — *(survivorship bias!)* Your `version_hash` reset is honest about redeploys, but it **structurally allows a bad agent to erase history by redeploying.** Worth thinking hard about: GIPS would say the old composite must remain visible.
- "+14% over 30 days" — which 30 days? *(period shopping)*
- Is that before or after the agent's fee, gas, and slippage? *(net of fees)*

> **Steal — this is a genuinely differentiating feature:**
> **A "GIPS-style" agent track record.** Show *all* deployments of a strategy, not the best one. Keep failed runs visible. Use standardised windows (7/30/90-day, same for everyone). Report net of every cost. Label it clearly — "we report every deployment, including the ones that lost money."
>
> No agent marketplace does this. Every serious finance professional will immediately recognise what it is, and it is *exactly* the answer to "Data Quality: enough to make a genuinely informed call."

#### 4b. Morningstar — the cautionary tale about scores

Morningstar's star rating is the most famous quality score in finance. The academic verdict after decades:

- Ratings **accurately describe past** risk-adjusted performance
- They have **weak power to predict future** performance
- But **low ratings do predict future underperformance** reasonably well

**The lesson is sharp:** a backward-looking score is far better at identifying *bad* than at identifying *best*. And publishing a "best" score drives performance-chasing — users pile into whatever recently did well, which is usually right before it mean-reverts.

> **Steal:** be confident when you flag *risk and unreliability*; be humble when you rank *the winner*. Language matters — "this agent has the strongest verified record" is defensible; "this agent will earn you the most" is not. Separate "historical performance" from "expected outcome" in the UI, permanently.

#### 4c. Copy-trading — the closest real-world product to what you're building

eToro's CopyTrader is *literally* "browse strangers, look at their record, delegate your money to them, watch it happen." That is your product with humans instead of agents.

What they show, and what you should:

- A **Risk Score 1–10** derived from volatility, displayed prominently *next to* returns — never returns alone
- **Maximum drawdown** — the worst peak-to-trough fall
- Number of copiers, and how long people stay
- The trader's *current open positions* — live transparency, not just history

**The failure mode of copy-trading, which you must design against:** users chase whoever is up the most this month, copy them at the peak, and get destroyed. Platforms that only display returns manufacture this behaviour.

> **Steal:** never show a return without its risk next to it. Max drawdown deserves equal visual weight to profit. And show what the agent is doing *right now*, not just what it did.

---

### PAIN 5 — "How do you let software touch money safely?"

**Prior art in crypto:** dHEDGE and Enzyme both solved a version of this. A manager runs a strategy; investors deposit into a vault; **the manager can trade but can never withdraw** investor funds. The permission boundary is enforced by the contract, not by trust.

That's the same insight as Altana sessions, reached from a different direction: **separate the right to *act* from the right to *take*.**

**Where the agent version is harder — and the academic work says so.** The SoK on Agentic Commerce security (arXiv 2604.15367) catalogues what breaks when an *LLM* is the one acting:

- **Prompt injection** — hostile data (a token name, an API response, a webpage) redirects the agent's behaviour. **A DeFi agent reading on-chain data is reading attacker-controllable input.** This is not theoretical.
- **Escrow manipulation** and **collusion** between agents
- **Evaluator capture** — and note this critique applies directly to Virtuals ACP and to TermiX/AACP: *"a compromised evaluator can systematically approve fraudulent deliverables or reject legitimate ones."* Adding an evaluator doesn't remove the trust assumption; it **moves** it.
- **The auditability gap** — agent reasoning is opaque, so decisions can't be forensically reconstructed after the fact

Their recommended defences for marketplace builders: sandboxing and simulation before execution, rate limits, cryptographic commitment to decisions, distributed/multi-party evaluation, runtime anomaly monitoring, and collateral that can be slashed.

> **Steal:** two things.
> 1. **Rate limits are a first-class safety control, not a nice-to-have.** A spend cap alone doesn't stop an agent burning your capital through 200 pointless rebalances in an hour — each one individually within the cap. Cap *frequency*, not just amount. This is a real gap in the Altana-session-only model.
> 2. **Log the decision, not just the transaction.** "Why did it act?" recorded at decision time is what closes the auditability gap — and it's the thing that makes your evidence ledger genuinely different from a block explorer.

---

### PAIN 6 — "Discovery at scale"

**The finding that matters most** comes from the same Nosko & Tadelis work: they ran an experiment where the platform **actively promoted higher-quality sellers in search results** — and it improved outcomes measurably.

Read that again, because it's a permission slip: **the marketplace ranking *is* the quality intervention.** You are not obliged to show everything neutrally. Ranking by verified quality is the single highest-leverage lever you have, and it's empirically validated.

Corollary from the same literature: a quality score that doesn't feed ranking is decoration. If your trust engine doesn't change what gets shown first, it isn't doing its job.

---

## 3. What the agent-native marketplaces do (and where they fall short)

| Who | Their answer to trust | The hole in it |
|---|---|---|
| **Coinbase x402 Bazaar** | Listings are earned by *settled payment*, not by submission — you're in the catalog because someone actually paid you | Indexes services, not ongoing workers. No performance dimension. |
| **Circle Agent Marketplace** | Human curation — Circle approves/rejects/suspends listings | Doesn't scale, and conflicts with permissionless identity |
| **Fetch Agentverse** | Activity and engagement as discoverability signals | No financial execution or economic outcome layer |
| **Olas Mech** | Agent-to-agent hiring with on-chain job records | Trust largely inherited from the Olas ecosystem |
| **Virtuals ACP** | **Evaluator agents** assess deliverables before escrow releases | Moves the trust assumption to the evaluator (per the SoK) |
| **TermiX / AACP** | Staked evaluators + program proofs | `realGroth16: false` today; 9 evaluators network-wide |
| **Recall Network** | **Competitions/arenas** — agents compete, results recorded on-chain | Great for skill; doesn't cover liveness or safe delegation |
| **8004scan** | Indexing + a ranking layer | Explorer, not a decision surface |

**The pattern across all of them:** everyone solved *one* layer. Coinbase solved payment-earned listing. Virtuals solved evaluation. Recall solved competitive benchmarking. TermiX solved verified job settlement.

**Nobody has assembled: liveness + capability + economically-grounded reputation + honest financial track record + safe bounded delegation, in one consumer surface, for financial agents.** That's still open.

---

## 4. The competitor you need to know about

### 4.1 RNWY — someone is already building the evidence layer

This is the most important discovery in this research, so I'm not going to soften it.

**RNWY** provides counterparty risk intelligence for AI agents. What they've built:

- **150,000+ agents** assessed
- **Trust score 0–95**, base 50, from four factors: on-chain activity, feedback quality, address history depth, ownership continuity
- **Six risk signals** exposed via API: trust score, **Sybil indicators** (5-level, detecting reviewer wallet clustering and funding patterns), address age (flags <30 days), original-owner check (agents are NFTs and can be sold), review count (<3 = insufficient), **reviewer credibility** (% of reviewers with established wallet histories)
- **Six risk tiers**, with Tier 6 triggering on absolute red flags and returning a *decline* recommendation
- Indexes **1.7 million commerce jobs** across Olas (Gnosis, Base, Polygon, Optimism), Virtuals ACP (Base), 12 EVM chains plus Solana, and the ERC-8004 / Olas / Virtuals / SATI registries
- Recomputed **nightly** from public chain data
- Principle: *"Transparency, Not Judgment. Every formula published. Every calculation reproducible."*

**The bad news:** the thesis in `RESEARCH.md` — "build the evidence layer nobody has built" — is not unique. Someone funded it and shipped it.

**The good news, and it's substantial:**

1. **They're infrastructure, not a marketplace.** They *sell risk intelligence to* marketplaces, escrow providers and orchestrators. They are a potential **supplier or partner**, not a rival for the BNB prize.
2. **They validate the thesis commercially.** Someone built a business on exactly this reasoning. That's the strongest possible evidence the direction is right.
3. **They don't do the hard half.** RNWY scores *identity and counterparty risk*. They do not do liveness probing of financial agents, per-category DeFi performance measurement (time-in-range, net-of-cost APY, health-factor intervention latency), or safe delegation. Their signals are generic; yours are financial.
4. **Their focus is Base/Gnosis/Polygon/Optimism/Solana** — BSC-native depth is open.

**And now the single best idea to steal from them:**

> **Don't just output a score. Output transaction parameters.**
>
> RNWY converts a trust tier into concrete recommendations: **collateral 10–150%, max transaction value $500–$500k, escrow timeout 24–120 hours, evaluator optional-or-required.**
>
> That turns "trust" from a decorative badge into a **control**. Now map that onto your architecture and something clicks:
>
> ```
> trust tier  →  recommended Altana spend cap
>             →  recommended session expiry
>             →  recommended max single action size
>             →  whether an AACP evaluator is required
>             →  action rate limit
> ```
>
> **Your evidence engine should drive the authorization screen.** A Basic-tier agent gets suggested $100 / 7 days / evaluator required. An Institutional-tier agent gets $5,000 / 30 days / optional. The user can override, but the default is *computed from evidence*.
>
> That single connection — trust score → permission defaults — makes your two strongest subsystems (the scoring engine and the Altana authorization moment) into one coherent product instead of two features sitting side by side. It's also the most honest expression of a trust score there is: *we don't just tell you it's risky, we limit the blast radius accordingly.*

---

## 5. The steal list — everything worth taking, in priority order

| # | Idea | From | Effort | Why it matters |
|---|---|---|---|---|
| 1 | **Trust tier → permission defaults** (cap, expiry, rate limit, evaluator) | RNWY + Altana | Low | Unifies your two best subsystems; nothing else does this |
| 2 | **Early revocation = negative signal / session survival rate** | Nosko-Tadelis silent majority | Low | Un-fakeable, uniquely yours, invisible to on-chain reputation |
| 3 | **Repeat hires weighted highest** | Upwork JSS | Low | Nobody hires a bad worker twice |
| 4 | **GIPS-style honest track record** — all deployments, failures included, standard windows, net of costs | GIPS | Medium | The literal answer to "Data Quality"; no competitor has it |
| 5 | **Risk shown next to return, always; drawdown equal weight** | eToro / Morningstar | Low | Prevents performance-chasing; instantly reads as professional |
| 6 | **Rank by verified quality — ranking IS the intervention** | Nosko-Tadelis experiment | Low | Empirically validated; makes the trust engine actually do work |
| 7 | **Publish the methodology, make scores reproducible** | RNWY + Upwork's failure | Low | Avoids JSS's most-hated flaw; required for sponsor adoption |
| 8 | **Rate limits as a safety primitive, not just spend caps** | SoK agentic commerce | Medium | Real gap: 200 small rebalances can drain you inside the cap |
| 9 | **Log decisions, not just transactions** | SoK auditability gap | Medium | What makes your ledger better than a block explorer |
| 10 | **Sybil-tolerant, not Sybil-proof — bound the gain** | MeritRank | — | Already your design; now it has literature behind it |
| 11 | **Constrain the choice set — intent → a few candidates** | a16z / dating apps | Low | Already your design |
| 12 | **Seed supply honestly and label it** | Every marketplace ever | Low | Already your decision; the labelling is the part to hold |
| 13 | **Managed marketplace posture** — verify, monitor, intervene | a16z managed marketplaces | Structural | High-trust services can't run as passive directories |
| 14 | **Prompt-injection defence for DeFi agents** | SoK | Medium | Your agents read attacker-controllable on-chain data |

---

## 6. Where innovation is genuinely still available

Having read everything above, these are the gaps nobody has filled. This is where an original contribution is actually possible:

**a) Nobody applies asset-management performance standards to agents.** GIPS-style composite reporting for autonomous strategies doesn't exist. It's an obvious idea to anyone from finance and invisible to everyone in crypto.

**b) Nobody uses delegation telemetry as a quality signal.** Session survival, early revocation, cap-utilisation patterns, renewal rate — this data only exists if you issue the permissions, and nobody who issues permissions is also scoring quality.

**c) Nobody connects trust scores to permission scope.** RNWY recommends transaction parameters but doesn't hold the permission rail. Altana holds the rail but doesn't compute trust. **You'd be the first to hold both ends.**

**d) Nobody measures per-category DeFi KPIs.** "Time in range," "net-of-cost APY," "intervention latency," "inventory skew" — the metrics that actually decide these four jobs. Generic agent scores can't see them.

**e) Nobody publishes a live liveness census for BSC.** The 4% figure is from a May 2026 academic paper. A continuously-updated, public number would be a genuinely valuable public good — and a fantastic submission artifact.

---

## 7. The honest summary

The thesis survives contact with the market research, but it needs sharpening:

- ✅ **"The evidence layer is the product"** — correct, and commercially validated by RNWY
- ⚠️ **"Nobody has built this"** — wrong. Someone has, for generic agents on other chains. **Your edge is specificity: financial agents, BSC-native, per-category KPIs, and owning the permission rail.**
- ✅ **"Reputation data is unusable raw"** — correct, and now backed by 25 years of literature, not just one paper
- ➕ **New:** your best signals aren't on-chain at all. They're in your own delegation telemetry — revocations, renewals, session survival. Nobody can copy those without being you.
- ➕ **New:** the strongest unclaimed positioning isn't "we score agents." It's **"we're the only marketplace that limits what an agent can do based on how much it has actually proven."**

---

### Sources

**Economics & marketplace design**
- Akerlof, *The Market for Lemons* (1970) — adverse selection, quality uncertainty
- Nosko & Tadelis, *The Limits of Reputation in Platform Markets* — NBER w20830 / faculty.haas.berkeley.edu/stadelis/EPP.pdf
- Tadelis, *Reputation and Feedback Systems in Online Platform Markets* (Annual Review)
- a16z — *Required Reading for Marketplace Entrepreneurs*, *The Marketplace Glossary*, *8 Things to Consider When Building Managed Marketplace Companies*

**Reputation & Sybil resistance**
- Douceur, *The Sybil Attack* (2002)
- EigenTrust — global trust via eigenvector on a local trust matrix
- *MeritRank: Sybil Tolerant Reputation for Merit-based Tokenomics* — arXiv 2207.09950
- *Web3Recommend* — arXiv 2307.01411 (decentralized reputation trilemma)

**Financial track-record standards**
- GIPS Standards for Firms 2020 — gipsstandards.org
- Morningstar rating predictive-power literature
- eToro Risk Score methodology — help.etoro.com

**Services marketplaces**
- Upwork Job Success Score — support.upwork.com

**Agent-native**
- RNWY — rnwy.com/risk-intelligence and /learn
- Virtuals ACP whitepaper — whitepaper.virtuals.io
- Recall Network — arenas / on-chain competitive benchmarking
- *SoK: Security of Autonomous LLM Agents in Agentic Commerce* — arXiv 2604.15367
- *Can Trustless Agents Be Trusted?* — arXiv 2606.26028
- dHEDGE / Enzyme — on-chain asset management permission models
