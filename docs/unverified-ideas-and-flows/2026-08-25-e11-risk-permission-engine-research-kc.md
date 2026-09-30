---
created: 2026-08-25
author: KC session
status: UNVERIFIED / NON-BINDING as design. This folder's rules apply — nothing here is
  decided architecture. **However**: every claim in §2 tagged `[V]` is verified against a
  primary source fetched live on 2026-08-25 (raw doc text via `curl`, not a WebFetch
  summary), per the standard `CLAUDE.md` requires for Altana/AgentCore/ERC-8004 behaviour.
  Those `[V]` facts are not proposals — they are constraints, and they are binding on
  whatever design we choose.
scope: E11 · Risk & Permission Engine only. E12 (Hiring & Job) and E13 (Settlement &
  Dispute) are referenced where E11's output is their input, but are not designed here.
supersedes: nothing. Resolves nothing. It *scopes* Open Architectural Gap #1
  (`final-review-docs/01` §12) by proving which parts of it are even mechanically possible.
primary sources fetched 2026-08-25:
  - docs.altana.network/llms-full.txt (206 KB, @altananetwork/sdk 0.7.1)
  - docs.bnbchain.org/developer-kit/bnbchain-studio/{architecture,security,deployment,cli-reference}
  - BuildtheERA.md (Altana partner-track criteria)
---

# E11 · Risk & Permission Engine — Deep Research

## 0. Why this document exists, and the one sentence to take from it

E11 is the engine that makes *"this agent cannot withdraw your principal"* a provable claim.
The decomposition doc says that. It is right. But nobody in this repo had yet read the
Altana permission grammar closely enough to know **what that sentence can actually be made
to mean**, and the answer materially changes the engine.

> **The one sentence:** an Altana session can enforce exactly three things — *which contracts
> and method signatures* (`calls`), *how much of which token per rolling period* (`spend`),
> and *until when* (`expiry`) — and **three of the four fields in our own `commercial_config`
> are not among them.** Everything else we want to promise a buyer is a marketplace policy
> gate, not an on-chain guarantee, and the product has to stop conflating the two.

That is not a setback. It is the thing that tells us where E11's real work is.

---

## 1. Raw mental model, before interrogation

Written down deliberately so §3 can attack it. This is roughly what the repo currently
assumes, assembled from `architecture/01` §1.3, `architecture/05` §5.3, and the
decomposition doc's E11 entry:

> A buyer picks an agent. E11 shows a "blast radius" screen — contract allowlist, spend cap,
> expiry. The buyer signs one `grantSession` call. The session is written to the on-chain
> Keystore, so anyone can verify it. The agent acts within it. If the agent misbehaves, the
> buyer clicks revoke and one transaction kills it. The platform enforces a ceiling
> (`category baseline × trust tier`) on top of whatever the buyer chose, plus the owner's
> `commercial_config` — max position size, max daily tx count, max slippage, auto-pause
> threshold — and `custody` enforces all of it at session-grant time.

Six of those clauses survive contact with the primary sources. Four do not.

---

## 2. The verified constraint surface

Everything in this section is `[V]` — quoted or directly derived from primary source text
fetched 2026-08-25. Where a doc line is decisive I quote it.

### 2.1 The complete permission grammar — this is the whole thing

```ts
type Session = {
  walletAddress: Address;      // the wallet this session can act on
  signer: Signer;              // the session key — the agent signs with this
  publicKey: Hex;              // identifier onchain
  permissions: SessionPermissions;
  expiry: number;              // unix epoch seconds
};

type SessionPermissions = {
  calls?: readonly CallPermission[];   // allowed contracts / method signatures
  spend?: readonly SpendPermission[];  // per-token rolling caps
};
```

`CallPermission` supports three shapes, and no fourth:

```ts
{ to: "0xRouter..." }                          // any method on this contract
{ signature: "transfer(address,uint256)" }     // any contract, this method
{ signature: "swap(...)", to: "0xPool" }       // both, AND semantics
```

`SpendPermission`:

```ts
{ limit: bigint, period: "hour" | "day" | ..., token?: Address }  // token omitted = native
```

**That is the entire expressive power of an Altana session.** `to` + `signature` + per-token
rolling notional + expiry.

### 2.2 The consequence that resolves Open Gap #1 — three of four fields are unenforceable

`commercial_config` (from `final-review-docs/01` §12) against the grammar above:

| `commercial_config` field | Session-enforceable? | Why |
|---|---|---|
| **max position size** | ⚠️ **Only in aggregate** | `spend` caps *notional per token per rolling period*, not per-transaction. A $10k/day cap does not stop one $10k transaction. Per-tx sizing is invisible to the grammar. |
| **max daily tx count** | ❌ **No** | There is no `count` or rate primitive in `SessionPermissions`. None. |
| **max slippage** | ❌ **No** | `calls` matches on contract address and method *signature* — never on **argument values**. `swap(...)` with `amountOutMin = 0` and `swap(...)` with a tight bound are the same permission. |
| **auto-pause threshold** | ❌ **No** | Nothing in a session reacts to an external condition. Sessions are static from grant to expiry. |

> This is the answer to the "leaning proposal" in `01` §12 — *"capped by an automatic
> formula-driven ceiling (category baseline × trust tier) **enforced by `custody` at
> session-grant time**"*. **Only the capital ceiling can be enforced that way**, because only
> the capital ceiling maps onto `spend.limit`. The other three cannot be enforced at
> session-grant time by any mechanism, because the session has no vocabulary for them.

`HIRING-STACK.md` §2.3 already flagged the frequency half of this from the research side
(*"Spend caps don't stop frequency abuse... Rate limits are a safety primitive"*) and §6 #8
listed *"rate limits as a first-class permission"* as innovation candidate #8, **killed by:
nothing — this is just work.** That reading was optimistic in one specific way: it is not
work *inside* the session, because the session cannot hold it. It is work somewhere else,
and §4 is about where.

### 2.3 Only the wallet admin can grant a session — sub-delegation does not exist

Altana states this explicitly and unprompted, in the *Verify agent authority* guide:

> **"Only the wallet admin grants sessions. Do not read this as one agent minting a sub-key
> for another.** It is the admin authorizing both agents, and the agents verifying each
> other. If session-to-session sub-delegation lands later, the docs will be updated."

**This contradicts a line in `architecture/01` §1.4.** That doc says of the agent-hires-agent
rail: *"`buyer_wallet` is another Agent's session-controlled wallet."* A session-controlled
wallet **cannot grant a session** — a session key is not an admin key. So the
agent-hires-agent rail **cannot be built on session sub-delegation**, today, at all.

Naming the conflict rather than silently routing around it, per `CLAUDE.md`. What *does*
work for agent-hires-agent, both verified:

- **ERC-8183 escrow from a session** — `hireErc8183Agent(session, params, opts)` is an
  explicitly supported overload. Altana's own words: *"a scoped key with an on-chain spend
  limit caps what an autonomous agent can ever escrow."*
- **x402 from a session** — `fetchWithX402` signs from a session key; the *Agent pays for an
  API with x402* use case is exactly this.

So the rail survives; **its ALTANA_SESSION variant does not.** Agent-hires-agent inherits
escrow or x402, never a sub-session. That is a correction to `01` §1.4, not a new design.

### 2.4 The marketplace probably cannot revoke on the buyer's behalf

> `revokeSession` *"calls Keystore directly, not the Controller. The call is gated onchain by
> `onlyKeyOwnerOrValidator`, so only the wallet itself (executing inside its own userOp) or a
> designated validator can revoke a key. A random caller reverts at the modifier."*

And: *"Revocation does not require the session signer, only the wallet's admin signer."*

Two things follow, and the second one is load-bearing:

1. **The buyer's one-click revoke works.** The buyer is admin; the buyer can always kill it.
2. **The marketplace's kill switch does not exist by default.** We are neither the key owner
   nor a validator. If E14a detects a rogue agent at 3am, `custody` has **no authority to
   revoke** the session. We can notify, we can delist, we can refuse to route more work — we
   cannot pull the key.

The `validator` role is the seam that would change this, and **we have not verified what it
is, how one is designated, or whether the SDK exposes designation at all.** Marked `[GAP]`
in §6 — it is the single highest-value unknown in this document, because "the marketplace
can emergency-stop an agent" is a claim we are one unverified sentence away from making
falsely.

### 2.5 Permissions are immutable — every change is a revoke-and-regrant

From the Errors table, on a policy revert: *"Grant a new session with the right scope.
**Permissions are fixed at grant and cannot be widened.**"* There is no `updateSession`.

Consequences E11 must model, none of which are in `01` §1.3 today:

- Raising a spend cap = revoke + grant = **a new `authorization_id`**, a new Keystore
  registration fee, and a gap in coverage between the two transactions.
- Revocation is **monotonic** — *"once a key is revoked, it cannot be reactivated."* An
  accidental revoke is unrecoverable; the fix is a whole new session with a fresh keypair.
- `01` §1.3's *Renewal* concept (grant a fresh session at expiry, same mechanics, `Job`
  transitions `EXPIRED → RUNNING`) is correct and matches this. But **"adjust the cap
  mid-engagement" is mechanically identical to renewal and the doc does not say so** — it
  reads today as if a live session's scope could be edited. It cannot.

### 2.6 The session key is a bearer credential, and BNB's Agent Studio has the delivery seam

`grantSession` returns `session.signer` — *"the session key. Agent signs with this."* Altana:
*"Hand `session` to whichever process runs the agent."* and *"If you generated the session
signer (omitted `sessionSigner`), **persist `session.signer` securely.**"*

Whoever holds that private key has exactly the granted authority. So **"where does the
session key live" is a Ring 3 question E11 owns and the repo has never asked.**

For BNB Agent Studio agents — the user's "BNB AgentCore agents" — the primary source answers
it, and this is the most useful single sentence in the BNB docs for us. From the Deployment
page's *Keystore posture* section:

> **"An `Altana` deployment is different in kind: it sends only a budget- and time-bounded
> *runtime session* rather than a keystore. Keep the budget and expiry tight, and renew or
> revoke explicitly."**

Confirmed by the CLI: `bag init --wallet-kind evm-local|twak|altana`.

**The seam exists and it is officially blessed.** An AgentCore-deployed agent scaffolded with
`--wallet-kind altana` is designed to receive a session, not a key. That is precisely the
artifact E11 produces. It also means the delivery channel is *the agent's deploy-time secret
channel* (AWS Secrets Manager for the `aws` target), not something the marketplace invents.

### 2.7 AgentCore agents carry a second, independent permission system we do not control

This is the finding with the longest tail, and it is invisible from the chain.

A Studio agent is **"one runtime, one signer"** — *"A single deployed process serves every
public face you selected and holds the only key."* Its internal guardrails, all `[V]`:

| Guardrail | What it does | Where it lives |
|---|---|---|
| **Signing boundary** | All signing is fixed entrypoint code in `signing.ts`/`signing.py`. *"never an LLM-callable tool"*. The LLM's chain tools are **read-only**. | emitted code |
| **SigningPolicy (EIP-712)** | Allowed by default: EIP-3009 `TransferWithAuthorization`/`ReceiveWithAuthorization`. **Denied by default: ERC-2612 `Permit`, Permit2 `PermitSingle`/`PermitBatch` — *"even if your code mistakenly allowlists them"*.** | `studio.toml` |
| **x402 host allowlist** | `[payments.x402].allowed_hosts` must list a host before the buyer rail will fetch it. | `studio.toml` |
| **Price clamp** | `negotiate` clamps to `[min_price, max_price]` — *"No LLM touches money: pricing is deterministic code."* | `studio.toml` |
| **MCP read-only** | 15 tools, all reads. *"the MCP server never signs."* | Studio surface |

Both `studio.toml` gates *"require editing toml + restart."*

Two consequences:

1. **A latent conflict.** Altana's own x402/Permit2 rail (`approveTokenForPermit2`,
   `signOrder` over Permit2 digests) is **denied by default** in a Studio agent's signing
   policy. An AgentCore agent using Altana's permit2 x402 path needs `extra_primary_types` in
   `studio.toml`. Neither vendor's docs mentions the other's gate. This will surface as an
   inexplicable failure at integration time if we do not write it down now. `[V]` on both
   halves; the *conflict* is my inference, marked `[ASSUMED]`.
2. **Two permission systems, mutually blind.** The Altana session is on-chain, public, and
   read by us. The `studio.toml` gates are inside a container in *someone else's AWS account*,
   invisible to the chain, changed by a redeploy we never see. **A tightly-scoped session on a
   loosely-configured agent and a loose session on a tightly-configured agent are
   indistinguishable to the marketplace.** We only ever see one of the two.

### 2.8 Six mechanical landmines, each a real defect if missed

All `[V]`, all straight from the SDK docs, all things that produce a wrong product rather
than a crash:

| # | Landmine | Consequence if missed |
|---|---|---|
| 1 | **`permissions.calls` omitted = unrestricted.** *"If you don't pass `calls`, the session can call any contract within its spend cap."* | An empty allowlist silently becomes an **unlimited** allowlist. The blast-radius screen would display "no contracts" while granting everything. This is the worst bug in the document. |
| 2 | **Stablecoin decimals are 18 on BNB, 6 on Ethereum.** Altana flags it twice, unprompted. | `100_000_000n` for "100 USDT" on BNB sets a cap of 0.0000000001 USDT. The agent silently cannot act; looks like the agent is broken. |
| 3 | **`revokeSession` and `execute` return `status: "FAILED"` — they do not throw.** *"If you only wrap calls in `try/catch`, you will not notice these."* | The buyer clicks revoke, sees a success toast, and the agent still has full authority. A trust-destroying bug in the single most safety-critical interaction in the product. |
| 4 | **`getKeys` does not drop expired keys** — only revoked ones. *"a long-expired key still appears in `getKeys`."* | A "your active sessions" panel built on `getKeys` shows dead sessions as live. `isValidKey` is the only read that folds in expiry. |
| 5 | **Sessions must be byte-exact at execute.** *"Sloppy JSON round-trips (bigints to numbers, key reordering) break the match."* | Every execute fails, including ones that worked before. Presents as an agent-quality problem; is actually our serializer. |
| 6 | **`PENDING` is ambiguous for four minutes.** Without `noWait`, `PENDING` means the SDK polled for 240s with no verdict — *"a relay that is down for the whole four minutes is indistinguishable from one that is merely slow."* Altana: *"Treat an unexpected `PENDING` as unknown, not as failed."* | Retrying on `PENDING` risks **double-submitting a money-moving intent.** |

Landmine 3 deserves emphasis: `grantSession` is the *exception* that throws
(*"because there is no useful `Session` object to hand back"*), which makes the inconsistency
worse — the grant path teaches you to trust `try/catch`, and the revoke path punishes you
for it.

### 2.9 Two facts that make E11 cheaper than feared

- **BNB Smart Chain (56) is a standalone Keystore** — *"Standalone Keystore + wallet
  execution; SDK default."* The entire L1-source-of-truth / L2-cache / storage-proof /
  `syncKeyToL2` apparatus (and its nasty *"cache keeps reporting the old answer after you
  revoke"* failure mode) applies to Ethereum→Base, **not to us.** A BNB-only marketplace
  never touches it.
- **Verification is free and unlimited.** `isValidKey(user, keccak256(publicKey))` is one
  `eth_call` from any RPC — *"An agent can verify authorization a million times per second,
  from any RPC, without paying anything."* It folds three questions into one: key exists, not
  revoked, not expired. **E11's read path costs nothing**, which makes continuous
  authority-drift monitoring viable rather than a budget line.

One cost that is *not* free: **`grantSession` is the call that charges the buyer.** A one-time
Keystore registration fee, *"and on a wallet's very first admin action it pays that fee twice"*
(the admin's `initialRegisterKey` is prepended into the same userOp). The first hire on a
fresh wallet costs the buyer double, and our UI must say so before they sign.

And a footgun on top of it: `register: false` skips the fee — and the session still works, but
*"Keystore readers like `verify_authorization` won't see it."* **That flag would silently
disqualify us from the Altana track**, which judges on sessions *"registered onchain"* and
*"live onchain transactions in the Altana explorer."* It must be a banned value in `custody`,
not a default we rely on.

---

## 3. Attacking the §1 mental model

| §1 claim | Verdict |
|---|---|
| "Buyer signs one `grantSession` call" | ✅ **Holds.** One userOp, atomic: Keystore registration + account-level authorization. *"There is no intermediate state where one exists without the other."* |
| "Written to the on-chain Keystore, anyone can verify" | ✅ **Holds** — provided `register` stays true. |
| "Contract allowlist, spend cap, expiry" | ✅ **Holds**, and is *exhaustive*. Not a summary of a richer model — that is the whole model. |
| "The buyer clicks revoke and one transaction kills it" | ✅ **Holds for the buyer.** |
| "…if the agent misbehaves" | ❌ **[ONE-WAY]** — implies *we* can act on misbehaviour. Under `onlyKeyOwnerOrValidator` we cannot revoke. Only the buyer can. §2.4. |
| "`commercial_config` … enforced by `custody` at session-grant time" | ❌ **Three of four fields cannot be.** §2.2. |
| "`buyer_wallet` is another Agent's session-controlled wallet" (`01` §1.4) | ❌ **Not constructible.** Sub-delegation does not exist. §2.3. |
| "A session's scope can be adjusted" (implied by `01` §1.3's renewal framing) | ❌ **Immutable at grant.** Any change is revoke + regrant. §2.5. |
| "The session is the boundary of what the agent can do" | ❌ **[GAP]** — it is the boundary of what it can do *on that wallet*. An AgentCore agent also holds its **own** wallet and its own key (§2.6–2.7), which the session says nothing about. |
| "E11 produces Policy Compliance Rate — within policy vs. blocked vs. unauthorised" (decomposition doc) | ⚠️ **Not free.** §5.3. |

---

## 4. What this means E11 actually is

The engine splits into **two layers that the current design treats as one**, and keeping them
separate is the whole discipline:

```
┌─ LAYER A — THE ON-CHAIN GUARANTEE ──────────────────────────────────┐
│  calls allowlist · per-token rolling spend cap · expiry             │
│  Enforced by the Altana account contract at validation time.        │
│  Publicly verifiable by anyone via isValidKey. Cannot be bypassed   │
│  by the agent, by us, or by a bug in our code.                      │
│  → This is the only thing we may call a GUARANTEE in the product.   │
└─────────────────────────────────────────────────────────────────────┘
┌─ LAYER B — THE MARKETPLACE POLICY GATE ─────────────────────────────┐
│  max daily tx count · max slippage · auto-pause · per-tx sizing     │
│  Enforced only where we sit in the path, or detected after the      │
│  fact from the chain. Bypassable by an agent that ignores us.       │
│  → Must be labelled a POLICY, never a guarantee, in every surface.  │
└─────────────────────────────────────────────────────────────────────┘
```

Blurring these is not a UI nit. Telling a buyer "max slippage 1%" in the same visual
treatment as "spend cap $500/day" is a **material misrepresentation** — one is enforced by a
contract, the other is enforced by our hope that the agent behaves. The whole thesis of this
project is being the evidence layer that does not overclaim; overclaiming here, in the one
screen where money is at stake, would be the worst possible place to do it.

### 4.1 Layer B has exactly three possible enforcement positions

Since the session cannot carry these, they must live somewhere. There are three, and only
three, and each has a different honesty rating:

| Position | Mechanism | What it actually gets you | Honest label |
|---|---|---|---|
| **B1 · Detect-and-react** | E5/E14a read the chain, count transactions, compute realised slippage, compare to policy. On breach → notify buyer, write Evidence, recommend revoke. | Nothing is *prevented*. Everything is *recorded*, and the buyer is told fast. | *"We watch and tell you."* |
| **B2 · Constrain at grant time** | Translate a Layer-B intent into the Layer-A grammar where a lossy translation exists. E.g. a tx-count limit becomes a **tighter spend cap on a shorter period** (`period: "hour"` instead of `"day"`); a per-tx size limit becomes an hourly cap ≈ the intended per-tx max. | Real, on-chain, but **lossy and blunt** — it also constrains legitimate activity. | *"We converted your limit into the nearest enforceable one — here's the exact translation."* |
| **B3 · Route through us** | Only possible for the marketplace-hosted tier (`architecture/05` §5.5, deferred). We hold the session, the agent asks us to execute, we apply full policy. | Genuine prevention of all four fields. | *"We are the executor."* |

**B3 is not available for the categories that matter.** A self-hosted or AgentCore-deployed
agent holds its own session key and calls the Altana relay directly — we are not in the path,
by design (Decision 0001, and "the marketplace reaches agents through the same public path a
stranger's agent uses"). So for v0: **B1 is the default, B2 is the upgrade, B3 is deferred
with hosting.**

**B2 is the interesting one and it is under-explored.** The `period` field is the only rate
primitive in the grammar, and nobody in the repo has noticed it is one. A $500/day cap and a
$25/hour cap authorise nearly the same daily notional but have completely different frequency
characteristics — the second one makes a 200-trades-an-hour burn *mechanically impossible*
rather than merely detectable. That is the `HIRING-STACK` §2.3 gap, half-closed, using a field
we already have, at zero additional cost. It is lossy and it should be labelled as lossy — but
it is real on-chain enforcement of a frequency constraint, and it is available today.

### 4.2 The topology fork — the one decision that must be made before anything is built

`BuildtheERA.md` describes the Altana track as rewarding *"agents on their **own** Altana
wallets, sessions with real spend caps and expiries registered onchain, and revocation the
user can see in the product."* Read alongside §2.3's *"only the wallet admin grants sessions"*,
three topologies are possible and they are not equivalent:

**T1 · One buyer wallet, one session per agent.** Buyer is admin of their own Altana wallet.
Each hired agent gets its own scoped session on it.
*Directly supported* — this is Altana's own *Run a portfolio with multiple agents* use case:
two agents, one wallet, complementary scopes, revoke either without touching the other.
✅ Cheapest. ✅ Matches `01` §1.3 as written. ⚠️ All agents share a balance — Agent A's spend
consumes tokens Agent B was counting on. Isolation is *permission* isolation, not *capital*
isolation. ⚠️ Reads awkwardly against "agents on their **own** wallets."

**T2 · One dedicated Altana wallet per hire, buyer is admin.** Buyer creates a fresh wallet
per engagement, funds it with exactly the capital at risk, grants that agent the only session.
✅ Genuine capital isolation — blast radius is the wallet balance, and the on-chain claim
becomes *unconditionally* true rather than cap-conditionally true. ✅ Reads exactly as
"the agent's own Altana wallet, inside limits the user set." ⚠️ Costs a funding transfer plus
a doubled first-grant Keystore fee (§2.9) per hire. ⚠️ Capital fragments across wallets.

**T3 · Agent owns the wallet outright.** The agent is admin of its own wallet; buyers send it
funds. ❌ **Rejected.** This is custody by the agent operator. It contradicts
`architecture/01` §1.2's founding decision (*"buyer capital custody stays entirely on
Altana's Keystore… never route it through us"*), it removes the buyer's revoke entirely, and
it makes the safety claim false. Named here only so it is visibly rejected rather than
silently absent.

> **My read:** T2 for capital-touching persistent-service hires, T1 for everything else.
> T2 buys the strongest version of the safety claim in the highest-stakes flow, and it is the
> reading of the Altana criteria that most obviously satisfies a judge. But this is a
> **decision, not a finding** — it costs a transfer per hire, it needs KC/Ryuk agreement, and
> nothing should be built until it is made.

### 4.3 The buyer-visible artifact — "plain-English permission compiler"

`RESEARCH.md` §11 and `HACKATHON-FIRST-PRINCIPLES.md` both converge on the same framing, and
the constraint surface above makes it sharper rather than weaker:

> The user says what they want in words → we compile it into `calls` + `spend` + `expiry` →
> we show the **exact blast radius** before signature → we show the **live Keystore entry**
> after → revocation is one visible click.

What §2 adds to that framing:

1. **The compiler must show its own lossiness.** When a stated intent has no Layer-A
   representation, the screen says so — *"'max 1% slippage' cannot be enforced on-chain. We
   will monitor it and alert you."* — rather than rendering it identically to the enforced
   fields. This is the single highest-integrity detail in the whole product and it costs a
   CSS class.
2. **The B2 translation is shown as a translation.** *"You asked for max 20 trades/day. The
   nearest enforceable form is $25/hour instead of $500/day. Here is what that changes."*
3. **The `getKeys`/`isValidKey` distinction is a UI correctness requirement**, not a
   micro-optimisation (landmine 4).
4. **The post-grant Keystore entry is the proof surface**, and it is free to read, so it can
   be live rather than cached.

### 4.4 The revocation signal — E11 is where the third-flagged idea finally becomes buildable

`HIRING-STACK.md` §2.5: *"A user who revokes on day 3 of a 30-day session has told us
something they will never write in a review. **This is the third separate document in this
project to flag it. It is still not in any section, any engine list, or any schema.**"*

E11 is the engine that owns the object the signal is computed from. The four metrics
`HIRING-STACK` §6 #3 names — session survival, early-revocation rate, renewal rate, cap
utilisation — are all derivable from data **only the session issuer holds**, and are
un-fakeable in the specific way that matters: faking them requires actually keeping buyers
happy.

Concretely, once T1-vs-T2 is decided, E11 should emit on every session lifecycle event:
`granted_at`, `expiry`, `revoked_at` (null if not), `spend_cap`, `realised_spend_at_end`,
`renewed_into` (null if not). From those six fields all four headline metrics fall out.

Two things must be said about it plainly, because this is a trust-integrity engine and
overclaiming here would be self-defeating:

- **Early revocation is not unambiguously negative.** A buyer revoking at day 3 may be exiting
  the position, rotating strategy, or reacting to a market move that has nothing to do with
  the agent. Treated as a raw negative signal it is a defamation machine. It needs a
  denominator and a stated interpretation before it is ever surfaced per-agent.
- **Statistical significance by demo day is genuinely doubtful** (`HIRING-STACK` §6 #3's own
  stated kill condition). The *schema* is what must exist by 2026-09-09; the *metric* may
  legitimately be too thin to publish, and publishing a retention number computed off four
  sessions would be exactly the overclaim this project exists to avoid.

---

## 5. Where E11 touches the rest of the system

### 5.1 Feeding E7 (Integrity) — a new independence axis nobody has named

`final-review-docs/02` computes `independence_confidence` from wallet-cluster proximity,
timing bursts, and reciprocal pairs. §2.6–2.7 surface a **fourth axis it does not have**:
*how much of the agent's own authority does its operator control?*

Observable, all free chain reads or public config:

- Is the agent's session **Keystore-registered** at all, or was it granted `register: false`?
  (An agent whose authority is deliberately unverifiable is a signal.)
- Is the agent deployed to the **`bnb` managed 48-hour trial target**? BNB's own docs:
  *"Runs in the **operator's** cloud, so signing material leaves your control. Use a throwaway
  wallet and never reuse it on mainnet."* An agent whose key sits in a third party's cloud is
  not independently controlled, and that is verifiable from the deploy target.
- Does the buyer wallet's admin key cluster with the agent owner's identities? (Existing
  §3.1 wallet-cluster machinery, pointed at a new pair — the "buyer" and the agent operator
  being the same person is self-dealing dressed as a hire.)

That last one matters because it is a **hole in the current self-dealing guard**. `02`'s guard
covers evaluator identity. It does not cover *the buyer of a real job being the agent's own
owner* — which manufactures both an execution record and a Settlement Review, at the cost of
gas. E11 sees the buyer wallet at grant time and is the natural place to check it.

Flagged as a **new gap**, adjacent to but distinct from `01` §12's third bullet (which is
about the evaluator on the owner-funded path).

### 5.2 Feeding E14a (Liveness) — authority drift is free to watch, and nobody is watching

`isValidKey` costs nothing and answers "is this session live right now." Today `apps/watch`
polls endpoint health only. Three states it cannot currently see:

- **Silent expiry** — a session lapses; the job is `RUNNING` in our DB and dead on-chain.
  No transaction fires at expiry (*"Automatic at `expiry`. None. No transaction."*), so
  nothing pushes this to us. It is **poll-only, by construction.**
- **Out-of-band revocation** — the buyer revokes directly via the Altana Explorer or their
  own script, not through our UI. Our DB says `ACTIVE`. The chain says dead.
- **Cap exhaustion approaching** — `E15`'s input list already names *"spend cap near
  exhaustion"* and *"authority near expiry"* as notification triggers. **Neither has a
  producer.** E11 is the producer. Without it those two E15 events are undeliverable.

This is the cleanest example in the repo of a state-drift risk: **the chain is the source of
truth for authority, our DB is a cache, and there is currently no invalidation path.**
`apps/watch` may not import `custody` (Ring 3 rule, `00` §6.4) — but `isValidKey` is a plain
`eth_call` through `chain-adapters`, not a custody operation, so the watch is buildable
without violating the ring carve. Worth stating explicitly before someone assumes otherwise.

### 5.3 Policy Compliance Rate — the claimed differentiator has an unbudgeted cost

The decomposition doc calls this *"data a generic agent marketplace structurally cannot
produce"* — actions within policy vs. blocked vs. unauthorised attempts. That is a genuinely
strong claim and it is worth defending. But:

> **"`FAILED` carries no reason.** The SDK returns `{ status: "FAILED" }` and nothing else.
> There is no revert string, no error code, and no receipt to inspect. Diagnosis is by
> elimination… If you need the onchain reason, look up the userOp yourself."

So a policy revert (agent tried something outside its allowlist — the *interesting* event) is
**indistinguishable at the SDK level** from a relay rejection, an unfunded wallet, or a
byte-mismatch bug. Producing the metric honestly requires **trace-level inspection of the
userOp on BscScan**, per failure. And we only observe failures the agent tells us about or
that we find by scanning the wallet — an agent that tries and fails silently, off our path,
is invisible unless we watch the wallet address directly.

Not a blocker. But "we measure whether agents respect their limits" is currently costed as
free and is not, and the honest v0 version is probably *"attempts we observed"* rather than
*"all attempts."* Better to size that now than to discover it while building the demo.

---

## 6. Open items, stated as gaps not decisions

Per `CLAUDE.md`: named and left open, never silently dropped.

| # | Gap | Why it matters | Who decides |
|---|---|---|---|
| 1 | **The `validator` role.** Can the marketplace be designated a validator on a buyer's wallet, and does the SDK expose it? `[GAP]` — `onlyKeyOwnerOrValidator` is quoted verbatim in the docs and the role is never defined. | Determines whether a platform emergency-stop exists at all. We are one unverified sentence from claiming a kill switch we do not have. **Highest-value unknown in this doc.** | Needs a source dig — SDK types / Keystore contract on BscScan / CertiK audit report (published, CertiK Skynet, completed 15 Jul 2026). |
| 2 | **Topology: T1 vs T2.** §4.2. | Changes the schema, the cost per hire, the strength of the safety claim, and how well we read against the Altana criteria. Everything downstream depends on it. | **KC + Ryuk. Blocks build.** |
| 3 | **How much Layer B ships in v0.** B1 only (watch + alert), or B1 + B2 (period-translation)? | B2 is the only on-chain frequency enforcement available and is cheap — but it is lossy and needs a UI that admits that. | KC |
| 4 | **`commercial_config` owner-side vs. buyer-side.** The field is the *owner's* declared operating envelope; the session is the *buyer's* grant. §2.2 proves three fields cannot be enforced in the session — so does the owner's declaration become a **published, machine-readable commitment** we hold them to (the `HIRING-STACK` §4.2(c) "listing-terms manifest"), rather than a control? | Resolves Open Gap #1 in a direction §12's "leaning proposal" did not anticipate, because §12 assumed session-time enforceability that does not exist. | KC + Ryuk |
| 5 | **Studio signing-policy conflict.** `[ASSUMED]` — Altana's Permit2 x402 rail vs. Studio's default Permit2 deny. Both halves `[V]`; the collision is inferred, not observed. | Silent integration failure for AgentCore agents using x402-permit2. Cheap to verify with one test agent; expensive to discover during demo prep. | Verify before any x402 buyer-rail work |
| 6 | **`01` §1.4's agent-hires-agent line is wrong** (§2.3) and **`01` §1.3 implies mutable session scope** (§2.5). | Two live inaccuracies in an `architecture/` doc, found by primary source. Per the supersession rule these need stamping — but `01` is `architecture/`-tier and being actively redesigned, so the correction belongs in the same turn as the E11 decision, not as a drive-by edit now. | Stamp when §6-#2 lands |
| 7 | **New self-dealing hole** (§5.1): buyer-wallet-admin clustering with agent-owner identities. Distinct from `01` §12's evaluator-side gap. | Manufactures execution evidence *and* a Settlement Review for the price of gas. Hits the strongest trust signal we have. | Belongs in `final-review-docs/02` |
| 8 | **Revocation-signal interpretation** (§4.4). Schema by 2026-09-09 is achievable; a publishable metric may not be. | Publishing a retention number off a handful of sessions is precisely the overclaim this project exists not to make. | KC |

---

## 7. The six lines that should survive if nothing else does

1. **A session enforces `calls`, `spend`, `expiry`. Nothing else. Ever.** Three of our four
   `commercial_config` fields have no on-chain representation, and the fix is not a better
   session — it is admitting which layer each promise lives in.
2. **Layer A is a guarantee; Layer B is a policy. Never render them the same way.**
3. **Only the wallet admin grants; only the key owner or a validator revokes.** No
   sub-delegation, and probably no platform kill switch. Verify the validator role before
   claiming otherwise.
4. **`permissions.calls` omitted = unrestricted.** Ban the omission in `custody` at lint level,
   not in review.
5. **`revokeSession` returns `FAILED`, it does not throw** — and it is the most safety-critical
   interaction in the product.
6. **BNB Agent Studio's `--wallet-kind altana` deploy already ships "a budget- and
   time-bounded runtime session rather than a keystore."** The seam E11 needs is officially
   blessed, and it is the cleanest integration story we have with the track sponsor's own tool.
