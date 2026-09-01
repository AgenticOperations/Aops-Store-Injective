---
created: 2026-09-01
project: BUILD-BNB — BNB "Build the Era" marketplace
status: drafted, adversarially reviewed before write. This is the buyer/caller-side
  counterpart to final-review 01, which covers seller-side onboarding only. Two corrections
  to the originating brief are applied in §2 rather than silently absorbed. Amended 2026-09-01
  with §11.5 (credential lapse vs. job lifetime) and §12 (Altana sessions as the renewal root,
  which resolves the `dlg` refresh friction and carries one unconfirmed vendor assumption in §12.5).
section: final-review 4 of N — Agent-Side Onboarding and Machine Credentials
depends_on: docs/architecture/00-repo-architecture-and-agent-conventions.md,
  docs/architecture/01-data-model-state-machines.md,
  docs/architecture/05-buyer-trust-hiring-hosting.md (§5.3 agent-hires-agent, §5.4 feedback gate),
  docs/final-review-docs/01-ingestion-and-registration-of-agents.md,
  docs/final-review-docs/02-fraud-sybil-detection.md
---

# Agent-Side Onboarding and Machine Credentials

## 1. What this document answers

`final-review 01` answers *"how does an agent become sellable here."* It says nothing about the
other direction. This document answers the missing half:

> A piece of autonomous software — a Claude Code session on a developer's laptop, an OpenClaw
> or Hermes runtime, a BNB Agent Studio agent, or one of our own four category agents — decides
> it wants to hire someone on this marketplace. **How does it arrive, how do we know who it is,
> and what is it allowed to do once we do?**

Three things have to be true at once, and they pull against each other:

1. **Discovery must be frictionless.** An agent that hits an auth wall on `search` never comes
   back. The catalog is a public good; gating it destroys the only distribution we have.
2. **Money must be hard to move.** The moment a caller can create a job, we are one bug away
   from `00` §1.2's unrecoverable class of mistake.
3. **The buyer must be a stable identity across time.** Not for login — for `05` §5.4's
   outstanding-feedback gate, for per-buyer spend caps, for the dashboard, and for `02`'s
   sybil clustering. Anonymous hires make three existing mechanisms unimplementable.

The resolution is that these apply to **different calls**, not to one uniform "account."

---

## 2. Two corrections this document makes to the originating brief

The brief that prompted this work described a scheme where "the marketplace issues a token, the
agent saves it, and the wallet address (public and private) is provided to the agent." Both
halves need amending before anything is built on them. The rest of the design keeps the brief's
actual intent — a durable handle the agent stores and re-presents — and changes only the two
properties that would otherwise be load-bearing security defects.

### 2.1 The marketplace never generates, holds, escrows, or transmits an agent's private key

Not once, not in a "convenience" flow, not for hosted agents, not on testnet. The moment we
hand a caller a private key we have taken custody of every asset that key will ever touch, and
a single breach of one table becomes total, irreversible loss for every buyer at once — the
exact failure `00` §1.2 exists to prevent, at maximum blast radius.

**The agent brings its own wallet.** It already must: it cannot fund an ERC-8183 escrow or pay
an x402 invoice otherwise. Studio agents and any ERC-8004-registered agent already have one.
For a caller that genuinely has no wallet (a coding session on a laptop), the answer is §6.3's
delegated credential — the human's wallet stays with the human and the agent never sees it.

*Hosted agents (`05` §5.5) are the one place a key is generated near us — but it is generated
inside that agent's own isolated AWS Secrets Manager secret under its own scoped runtime role,
never returned over an API, and never readable by the marketplace application.*

### 2.2 The token is a delegation, not an identity

A bearer token that *is* the identity means: whoever holds the string is the buyer. In an agent
context that is a much worse assumption than in a web app, because agent credentials leak
through channels a web app does not have — model context windows, chat transcripts pasted into
issues, MCP config files checked into repos, verbose tool logs, crash dumps, and the agent
helpfully printing its own configuration when asked to debug itself.

So the wallet signature is the identity, and the token is a **capability with a name on it**:
scoped, capped, expiring, revocable, and — critically — **useless on its own** (§8). The
agent still stores one string and re-presents it, exactly as the brief wanted. It just cannot
be spent by whoever steals it.

---

## 3. Who actually calls us, and what each one needs

| Caller | Has a wallet? | Should hold a wallet key? | Credential it needs |
|---|---|---|---|
| BNB Agent Studio agent / any ERC-8004 agent | Yes, its own | Yes — it already does | `svc` credential, or none at all if it hires purely on-chain (§4) |
| OpenClaw / Hermes / other autonomous runtime | Usually | Yes | `svc` credential |
| Coding session (Claude Code, Cursor) acting for a developer | Gets **its own** Altana wallet; the **human's** wallet grants it a session (§12) | Never the human's | `dlg` credential riding an Altana session key |
| Our own four category agents (separate repo, Decision 0001) | Yes | Yes | `svc` credential, obtained through the identical public path (`00` §4) |
| Anonymous crawler / a human's browser | No | No | **None.** Read is open. |

The fourth row is the check on this whole design: if our own agents need a private path to
onboard, the public path is broken and we would not find out until a stranger tried it.

---

## 4. Two rails — and the credential only guards one of them

This is the single most important structural point in the document, and it collapses most of
the perceived complexity.

```
   ON-CHAIN RAIL                          HTTP RAIL
   ─────────────                          ─────────
   agent calls ERC-8183 escrow /          agent calls  /v1/search  /v1/quote
   Altana session directly                             /v1/jobs    /v1/feedback

   authentication  = the signature        authentication = §8 credential + proof
   on the transaction                     (except read, which is open)

   authorization   = what the contract    authorization  = §9 scopes and caps,
   permits                                re-checked on-chain at Ring 3

   WE ISSUE NOTHING. There is no          WE ISSUE a credential, because there is
   account to have. The chain is          off-chain state to bind to: job history,
   the account.                           feedback debt, caps, rate limits.
```

An agent that discovers a listing on-chain and funds an escrow to it **never touches our API and
never needs a token.** That is correct and we should not fight it — it is the most trust-minimised
path on the platform and the one BNB's own ecosystem story points at.

The HTTP rail exists because it is *convenient*: structured search, ranked results, quotes,
explanations, and the settlement-review loop. Convenience is what we are charging identity for.

**Consequence for the build:** the credential system is not on the critical path for a working
hire. It is on the critical path for a *good* one. That is what makes §16's staging honest.

---

## 5. The four doors, and where the handshake sits behind each

`final-review 01` §2 has two provenances for sellers. Callers have four doors, all landing on
one backend.

| Door | Artifact | What it tells a machine |
|---|---|---|
| Coding agent | `/llms.txt` | Plain text: search is open and needs nothing; to hire, run the §7 handshake; here are the four endpoints. |
| MCP client | `/mcp` + a published skill | Tools `search` · `get` · `quote` · `hire`, plus `enroll`. The **MCP server process holds the credential; the model never sees the string** (§10.2). |
| A2A runtime | `/.well-known/agent.json` | Agent Card declaring the marketplace itself as an agent, with the §8 scheme in `securitySchemes`. Also `/.well-known/ai-catalog.json` and `/.well-known/agent-discovery.json` while those conventions are cheap to serve. |
| On-chain | our own ERC-8004 identity as a broker | No document. Another agent discovers us in the registry and negotiates over ERC-8183. Rail 1 — no credential. |

Every door terminates in the same handler set. Per `00` §3.5 there is exactly one gate
implementation; a door is transport, never policy. A hire that the web UI would block must be
blocked identically at `/mcp`, at A2A, and at the raw API — and that property is only free if
the guard lives in `domain` (§15).

---

## 6. The object model

Three objects, deliberately separate. Collapsing any two of them is where this design would go
wrong.

### 6.1 Account — the durable buyer identity

One per **wallet address**, created at first successful enrollment. This is what job history,
feedback debt (`05` §5.4), spend caps, rate limits, and `02`'s sybil clustering hang off. It is
never authenticated against directly and holds no secret.

```
UNFUNDED ──(first settled escrow / x402 payment)──► FUNDED
    │                                                 │
    │                                    (outstanding feedback, 05 §5.4)
    │                                                 ▼
    │                                            RESTRICTED ──(feedback filed)──► FUNDED
    │                                                 │
    └────────────(02 fraud signal / operator)─────────┴──► SUSPENDED
```

- `UNFUNDED` — may read, search, quote. **May not create a job.** This is the anti-sybil
  anchor: a free account buys nothing that costs us anything, so minting a thousand of them is
  pointless. Cost anchoring beats CAPTCHAs and beats IP heuristics.
- `RESTRICTED` — implements `05` §5.4's next-hire gate directly. It was specified there as a
  request-time policy check with no stated home; this is its home.
- `SUSPENDED` — all credentials revoked, escrow untouched. We can stop future authority; we
  cannot and must not claw back settled funds.

### 6.2 Credential — one per running instance, never shared

An account may hold several. Three replicas of the same agent take **three credentials**, not
one shared string. Sharing means one leak forces a revoke that takes down every replica, and it
destroys the attribution that makes the audit log worth keeping.

```
PENDING ──(enroll, §7)──► ACTIVE ──(rotate, §11)──► ROTATING ──(5 min)──► EXPIRED
                             │                          │
                             └──────(revoke)────────────┴──────────────► REVOKED
```

### 6.3 Device key — the thing that actually authenticates

At enrollment the caller generates an **Ed25519 keypair locally**. The public half is bound
into the credential and into the wallet-signed delegation. The private half never leaves the
machine and is never sent to us.

This is the piece that makes §2.2 true, and it is what lets a coding session act for a
developer without ever holding the developer's wallet key: the human signs the delegation once
with their wallet, the agent proves possession of a throwaway device key forever after.

---

## 7. Enrollment — "do you already have an account, or do you need one?"

The brief asked for exactly this exchange. Here it is, with the enumeration oracle removed.

### 7.1 The rule that shapes it

**There is no endpoint that answers "is address 0xABC registered?"** An address is public; an
answer keyed only on an address hands an attacker a free map of which wallets are active buyers
here, which is a targeting list. The existence question is answered *only* to someone who can
prove key possession — which means it is answered by presenting a credential, or by completing
the handshake.

### 7.2 The flow

```
  1. agent generates Ed25519 device keypair            (local, never transmitted)

  2. POST /v1/auth/challenge  { wallet, device_pubkey, requested_scopes, caps }
     ← 200 { eip712_payload, nonce, expires_at: now+120s }
        nonce is single-use, stored server-side, bound to (wallet, device_pubkey)

  3. wallet signs the EIP-712 typed data               (human clicks, or agent signs)

  4. POST /v1/auth/enroll  { nonce, signature, device_pubkey }
     server: recover signer → must equal payload.wallet
             nonce unused, unexpired, and matches this device_pubkey
             chainId + salt match this environment
     ← 201 { account_id, credential (shown EXACTLY ONCE), expires_at, scopes, caps }
        an already-enrolled wallet gets 200 with its EXISTING account_id and a NEW credential

  5. agent stores credential + device key              (§10.2 storage rules)
```

Step 4's "already enrolled returns the existing account" is deliberate: agents retry, and an
error here produces a loop that a human has to break. Credential sprawl is bounded instead by a
per-account live-credential ceiling (default 5) — reaching it requires an explicit revoke, not
a silent eviction of whichever credential a running job happens to be using.

### 7.3 The signed delegation

The EIP-712 struct is the delegation certificate. Its content matters more than its shape:

```solidity
domain = { name: "AgentOps Marketplace", version: "1", chainId: <56|97>, salt: <env> }

struct AgentEnrollment {
  string  intent;          // "enroll" | "rotate" | "revoke" — never overloadable
  address wallet;
  bytes32 devicePubKey;
  string  scopes;          // canonical, sorted, comma-joined
  uint256 maxSpendPerJob;  // atomic units of the settlement asset
  uint256 maxSpendPerDay;
  uint64  issuedAt;
  uint64  expiresAt;
  bytes32 nonce;
}
```

- **Scopes and caps are inside the signed payload.** The server therefore cannot widen either
  one — not by bug, not by a compromised admin path, not by a later migration. What the wallet
  authorised is cryptographically pinned, and we can show the buyer that exact struct in the
  dashboard.
- **`chainId` + `salt`** kill cross-environment replay. A testnet delegation is structurally
  invalid on mainnet. This is the same instinct as `00` §6.1's simulate-by-default rule,
  applied to credentials.
- **EIP-712, not `personal_sign`**, for the same reason `final-review 01` §4.1 requires it on
  the seller side: a raw message signature is a blank cheque that can be re-presented anywhere,
  and the wallet UI cannot show the human what they are agreeing to.
- **`intent` is a distinct field**, so an enrollment signature can never be replayed as a
  revocation or vice versa.

---

## 8. Per-request authentication — proof of possession, no bearer mode

### 8.1 Token format

```
aops_<tier>_<net>_<kid>_<secret>_<crc>

aops_       fixed prefix — registered with GitHub secret scanning so a leaked
            credential is reported to us and auto-revoked before it is used
tier        dlg | svc                          (§3)
net         bsc | tbsc                         (mainnet | testnet — never interchangeable)
kid         22 chars, Crockford base32         (public lookup key, indexed, NOT secret)
secret      32 bytes CSPRNG → base64url        (43 chars)
crc         CRC32 of everything preceding      (client-side typo/truncation detection)
```

Design choices, each with a reason:

- **Opaque reference, not a JWT/PASETO.** Self-contained tokens make revocation a denylist, and
  a denylist that fails open is a money bug. We look the credential up on every request — one
  indexed read — so **revocation is instant and unconditional**. Revoke being genuinely
  immediate is also the product surface the Altana track is judged on; it should not be a
  best-effort claim.
- **We store `SHA-256(secret)`, never the secret.** Plain SHA-256 is correct here (not bcrypt /
  argon2): the input is 256 bits of CSPRNG output, so there is nothing to brute-force, and a
  slow KDF on the hot path would just be a self-inflicted DoS. Comparison is constant-time.
- **`kid` is separate from `secret`** so lookup never touches the secret, which removes the
  timing side channel entirely rather than trying to make it small.
- **The token is displayed exactly once.** There is no "show credential again" endpoint. Lost
  means re-enroll; the wallet is the recovery root (§11.4).

### 8.2 Every request carries a fresh signature

```http
POST /v1/jobs
Authorization: AOPS-PoP aops_svc_bsc_...
AOPS-Proof: <base64url(payload)>.<base64url(ed25519_sig)>

payload = {
  kid, htm: "POST", htu: "https://api.…/v1/jobs",
  ath: sha256(token), bh: sha256(raw_body),
  iat: <unix>, jti: <16 random bytes>
}
```

Verification order — cheapest and most discriminating first:

1. parse token, verify `crc`, verify `net` matches this deployment
2. look up by `kid`; constant-time compare `SHA-256(secret)`
3. credential is `ACTIVE` or `ROTATING`, not expired
4. verify Ed25519 proof against the credential's bound `device_pubkey`
5. `iat` within ±90s of server time; `jti` unseen in that window
6. `htm`/`htu` match the actual request; `bh` matches the actual body bytes
7. scope permits this route; caps permit this amount (§9)

**There is no bearer fallback. Ever.** A token presented without a valid proof is a `401`, full
stop. The downgrade attack — strip the proof header and hope the server accepts the token alone
— is the single most common way this class of design fails in practice, and the only reliable
defence is that the permissive path does not exist in the code at all.

What each field buys, concretely:

| Field | Attack it closes |
|---|---|
| `ath` | Proof captured from one credential replayed with a different (stolen) token |
| `bh` | Body tampering — swapping the payee or the amount on an otherwise valid signed request |
| `htm` / `htu` | A proof for `GET /v1/quote` replayed against `POST /v1/jobs` |
| `iat` + `jti` | Straight replay of a captured request |
| device key binding | **Token theft alone.** This is the one that makes §2.2 true. |

Clock skew is a real operational problem on developer laptops, so a `401` from step 5 returns
`server_time` and the client is expected to correct once and retry. A silent, unexplained
`401` here produces support load and gets worked around badly.

---

## 9. Scopes, caps, and the two-check rule

### 9.1 Scopes, split by direction of exposure

Scopes are not divided into "read" and "write". They are divided by **which way they move the
buyer's exposure**, because that — not read/write — is what should be allowed to expire.

> **Expiry may only remove the ability to *increase* exposure. It may never remove the ability
> to reduce or freeze it.**

A safety control that expires is not a safety control. An agent whose credential has aged out
must still be able to cancel, dispute, and revoke — those actions can only ever make the buyer
safer, so gating them behind a live spend window would mean the system becomes *less* safe the
longer nobody touches it.

| Scope | Grants | Direction | Tier (§11.5) |
|---|---|---|---|
| `catalog:read` | search, get, compare | neutral | **Public** — no credential at all |
| `quote:create` | priced quote, gate pre-check | neutral | Standing |
| `job:read` | full enriched view of **own** jobs, evidence timeline, dispute thread | neutral | Standing |
| `job:feedback` | submit the settlement review (`05` §5.4) | neutral | Standing |
| `job:cancel` · `job:dispute` | cancel, open a dispute, freeze release | **reduces** | Standing |
| `credential:revoke` | revoke own credentials | **reduces** | Standing |
| `job:create` · `job:fund` | create and fund a job | **increases** | **Fresh** |
| `job:approve` | release escrow to the provider | **increases** | **Fresh** |
| `session:grant` | Altana session grant (Ring 3) | **increases** | **Fresh**, and never `dlg` |

Two placements are worth defending explicitly:

- **`job:feedback` is Standing, not Fresh.** It moves no money, and putting it in the Fresh tier
  creates a deadlock: `RESTRICTED` (§6.1) blocks the next hire until feedback is filed, but
  filing it would require an authority the agent no longer has, so the account can never leave
  `RESTRICTED`. The account would be permanently unable to hire *and* permanently unable to fix
  it. This was a real bug in an earlier draft of this document, caught by asking what a coding
  agent does two months after its credential lapsed.
- **`job:approve` is Fresh, even though the escrow is already funded.** Release looks like
  "completing a committed transaction," but a provider who has compromised a buyer's agent could
  release their own payment before the work is verified. That is theft, so it stays behind fresh
  wallet authority.

`session:grant` is excluded from delegation entirely. A persistent-service session is standing
authority over a buyer's funds (`05` §5.3); granting it is a decision a human makes with their
own wallet in front of them, not something a laptop agent does on their behalf. A delegated
agent can create and fund a bounded job. It cannot hand out an open-ended session.

### 9.2 The two-check rule

> **A credential is never the only thing between an attacker and money.**

Every value-moving call is checked twice, against two independently-derived limits:

1. **Off-chain**, at the API boundary: does the signed delegation's scope and cap permit this?
2. **On-chain**, at Ring 3: does the ERC-8183 escrow allowance or Altana session scope permit
   this?

The second check does not trust the first, and `custody`/`settlement` re-derive it from chain
state rather than from anything the request carried. A total compromise of the credential
database therefore still cannot exceed what buyers have granted on-chain, and the on-chain
revoke remains an unconditional kill switch that no server-side bug can bypass.

### 9.3 Cap accounting is a reservation, not a check

The naive implementation reads the day's spend, compares it to the cap, and then creates the
job. Two concurrent requests both read `0`, both pass, and both spend the full cap. This is the
canonical TOCTOU bug and in this system it costs real money.

Caps are enforced by an **atomic reserve-then-commit** inside one database transaction:
`SELECT … FOR UPDATE` on the account's cap row, insert a reservation, commit, *then* touch
Ring 3. A failed or abandoned job releases its reservation on a sweep. Never check-then-act.

---

## 10. What the agent stores, and where

### 10.1 On disk

- Device private key and credential in the OS keychain where available; otherwise a `0600` file
  under the agent's own config directory.
- **Never** in `.env` files that get committed, never in a repo, never in an MCP config that is
  shared as a snippet.
- The `aops_` prefix exists so that when this rule is broken anyway — and it will be — GitHub's
  secret scanning tells us and we revoke before anyone uses it.

### 10.2 The rule that matters most for LLM-driven agents

**The credential lives in the MCP server process. It never enters the model's context window.**

The model calls `hire(listing_id, amount)`; the server attaches the credential and the proof.
The model cannot read the token, therefore prompt injection cannot exfiltrate it, therefore a
poisoned README in some repo the agent is reading cannot walk away with it. Any integration that
puts the token in a system prompt or a tool argument has defeated this design, and that is worth
stating as a hard rule rather than a recommendation.

---

## 11. Lifecycle

### 11.1 Expiry — two clocks, not one

A single expiry date forces a false choice: short enough to contain a compromise, or long enough
that an agent can still find its own job next month. A credential therefore carries **two**
independent deadlines over the same device key.

| Clock | `dlg` | `svc` | What lapsing it costs |
|---|---|---|---|
| `spend_expires_at` | **24 hours** | **30 days** | Fresh-tier scopes only. The credential keeps working for everything else. |
| `valid_until` | **90 days, sliding** — extended on every authenticated request | same | Standing tier. Re-enrollment required. |

Short `spend_expires_at` is the mitigation that works even when we never learn about a
compromise. The sliding `valid_until` means an actively-used credential effectively never
lapses, while one abandoned for a quarter does — which is the correct shape, since an idle
credential is exactly the one most likely to be sitting in a stale config file somewhere.

Neither clock is ours to pick freely. **Both are ceilinged by the on-chain session's expiry**
(§12.3) — we may be more conservative than what the buyer signed, never less.

**A lapsed spend window degrades a credential. It does not kill it.** See §11.5.

### 11.2 Rotation, with overlap

Present a valid credential + proof to `POST /v1/auth/rotate` → receive a new one; the old one
stays valid for **5 minutes**, then dies. The overlap is not politeness — a hard cutover kills
in-flight requests on a long-running agent, and the recovery path an agent picks on its own is
usually to re-enroll in a loop.

Rotation cannot widen scopes or caps. Widening requires a fresh wallet signature (§7.3).

### 11.3 Revocation

Four triggers, all landing in the same place:

- **Human, from the dashboard** — one row per credential, `last_used`, source, scopes, caps, one
  button. This is the Altana-track surface: bounded authority that is visibly withdrawable.
- **Cascade from chain.** `apps/watch` observes an on-chain session revoke and enqueues a job
  that revokes the off-chain credentials derived from it. The chain is the source of truth
  (`00` §1.3); the off-chain record follows it, never the reverse.
- **Anomaly** — velocity spike, repeated scope-escalation attempts, proof failures in bulk.
- **Leak detection** — a secret-scanning report auto-revokes and notifies.

Revocation is immediate because §8.1 chose per-request lookup. This is the payoff for that
choice.

### 11.4 Loss and recovery

Lost credential → re-enroll with the wallet. Lost wallet → **the account is gone.** There is no
email recovery, no support-desk reset, no backup code. Every recovery channel added here becomes
the weakest link and the preferred attack path, because social-engineering a human is cheaper
than breaking Ed25519. The wallet is the root; we do not build a second root.

### 11.5 What happens to a job when the credential lapses

The question this section answers: *a coding agent hired someone for a job that runs for weeks.
Its 24-hour spend window closed on day one. Two months later it wants to know what happened.
Can it?*

**Yes, at every level, and no job is ever affected by it.**

#### The rule that has to be stated before anything else

> **Credential expiry and credential revocation never cancel, pause, refund, or otherwise touch
> a job.**

The job is escrow on-chain, funded by a wallet, governed by contract terms. Our credential is
access to the HTTP rail (§4) and nothing more. An implementation that wires "credential revoked
→ jobs cancelled" would let anyone who can trigger a revoke destroy a live engagement — and
would make the dashboard's revoke button, the safest control on the platform, into a
destructive one. Revoking removes an agent's ability to *start* things. It never unwinds what
is already committed.

#### Three tiers of access, and what survives into each

| Tier | Requires | Can see / do |
|---|---|---|
| **Public** | nothing at all | The on-chain truth: escrow state, funding and settlement tx hashes, provider identity, terminal outcome. Plus a public job receipt endpoint keyed by the on-chain job id — this data is already public on-chain, so gating it would be theatre. |
| **Standing** | credential + device key, `spend_expires_at` lapsed, within `valid_until` | Everything above, plus the **enriched** view: evidence timeline, provider reports, dispute thread, cost breakdown. Plus file feedback, cancel, dispute, revoke (§9.1). |
| **Fresh** | credential with a live spend window | Everything above, plus create, fund, approve, grant. |

So the honest answer to "the credential expired, is my job history gone" is: **the record is
never gone.** Worst case — device key lost, machine reimaged, wallet lost, no credential of any
kind — the chain still holds what happened, and it is readable by anyone forever. What lapses is
*authority*, never *history*. This is the practical payoff of §6.1's rule that the Account is
keyed to the wallet and the credential is disposable: job history hangs off the account, so a
new credential under the same wallet sees every job the old one ever created.

#### Regaining Fresh tier

- **`svc` (agent owns its wallet)** — fully automatic. The agent signs its own EIP-712 refresh
  and reopens the window with no human involved. The 30-day clock is a non-event; do not
  over-engineer for it.
- **`dlg` (human owns the wallet)** — `POST /v1/auth/refresh` returns the EIP-712 payload; the
  agent surfaces it to the human as a link; the human signs; the window reopens. **The
  credential string and the device key are unchanged** — refresh reopens a window, it does not
  rotate a secret, so nothing the agent stored has to be rewritten and no in-flight request is
  disturbed. That is the difference between refresh (§11.5) and rotation (§11.2).

#### Long jobs must not depend on a human being awake

An agent hiring for a 30-day job under a 24-hour spend window would otherwise be signing up for
"a human must be online on day 30 or the funds are stuck." Two mechanisms prevent that:

1. **Pre-flight warning at hire time.** If the job's horizon exceeds `spend_expires_at`, the
   quote and the hire response both say so explicitly, and `AOPS-Spend-Expires` is on every
   response header so an agent can plan rather than discover.
2. **Release is an on-chain timeout, not an HTTP call.** The ERC-8183 escrow's own dispute
   window and auto-release terms govern settlement for any job outliving the spend window.
   `job:approve` is the *early* path, not the only path. The chain is the source of truth
   (`00` §1.3), so the long-horizon case is handled where it should be — in the contract the
   buyer already signed — and never by our uptime or a human's calendar.

## 12. The permanent key — the Altana session is the renewal root

### 12.1 The proposal, and the one property that decides whether it works

The proposal: give the agent one durable key it keeps indefinitely. Short-lived credentials are
minted from it. When they lapse, the agent presents the durable key, gets its history back, and
mints a new one — without waking the human.

That is a refresh-token architecture, and stated abstractly it has a well-known fatal flaw:
**if the durable key can silently mint spending authority, the durable key *is* the spending
authority, and the short expiry on what it mints is decoration.** An attacker who steals it does
not care that credentials last 24 hours. They mint a new one every 24 hours, forever.

So the proposal is correct if and only if one property holds:

> **Renewal must buy the holder time, but never more money.**

If each renewal arrives with a fresh spend cap, renewal is escalation and the design is broken.
If every renewal draws from a single budget that never refills, under an expiry that never
extends, then renewal is not escalation — and a durable key becomes safe for an agent to hold.

We do not have to build that property. **It already exists on-chain, and it is precisely what
Altana sells.**

### 12.2 What Altana actually provides `[V — RESEARCH.md §3.5, primary-source verified]`

```ts
createWallet / createPasskeyWallet
grantSession    // allowed calls + spend cap + expiry
execute         // act under a session
revokeSession   // one tx, immediate
balances
```

- EIP-7702 wallet with session keys, **TypeScript only** — which is why everything on this rail
  is TS (RESEARCH.md §9).
- Every permission is written to an open on-chain **Keystore** registry any app or agent can
  read. The grant is *provable*, not claimed.
- `revokeSession` is **one transaction, immediate**.
- Networks: BNB Smart Chain (default), BNB testnet, Ethereum, Base.
- Also ships `hireErc8183Agent` (ERC-8183 buyer side) and `@altananetwork/x402-server`.

Read that surface against §12.1's requirement and the mapping is exact:

| §12.1 needs | Altana provides |
|---|---|
| A durable key the agent holds | the session key (`grantSession`) |
| A budget that does not refill on renewal | the session's **spend cap** |
| A wall renewal cannot push back | the session's **expiry** |
| Authority the holder cannot widen | the session's **allowed-calls allowlist** |
| A kill switch that survives total compromise of our backend | `revokeSession` — one on-chain tx |
| Public proof of exactly what authority exists | the **Keystore** registry |

### 12.3 The resulting rule

> **We never mint authority. We mirror it.**

The human signs `grantSession` **once**. That grant — allowlist, cap, expiry — is the permanent
key's entire power, and it lives on-chain where we cannot widen it and a breach of our database
cannot reach it.

Our off-chain credential (§8) becomes a convenience layer over that grant, and its rules follow
from the grant rather than from anything we choose:

- `spend_expires_at` **auto-renews while the on-chain session is live and has budget left** — no
  human, no 3am problem, no refresh link to deliver to a headless process.
- It can never exceed the session's on-chain expiry. A hard wall the human set, not one we did.
- Cumulative spend across every renewal is bounded by the session cap, because §9.2's second
  check re-derives it from chain state on every value-moving call.
- Revoking the session on-chain kills every derived credential (§11.3's cascade) — and does so
  even if our API is down, or hostile.

This is what turns §11.5's `dlg` story from "re-sign every 24 hours" into **"sign once, work for
30 days, revoke in one click."** The friction did not get relaxed; the authority moved to where
it always belonged.

### 12.4 Three keys — the proposal conflates two of them

| Key | Held by | Lifetime | Can | Cannot |
|---|---|---|---|---|
| **Wallet key** | the human (or a `svc` agent, for itself) | permanent | grant sessions, widen scope, recover the account | — |
| **Session key** (Altana) | the agent — **this is the "permanent key"** | until session expiry or revoke | act within allowlist + cap; keep our credential renewed; read all history | grant a new session; widen its own scope; outlive its expiry; recover the account |
| **Device key** (Ed25519, ours) | one per running instance | until re-enroll | prove *which instance* is talking to our HTTP rail | move value; act on-chain |

Stated precisely: the permanent key lets the agent **resume work and read its history without
waking the human.** It does not let it *restart the account* — that phrasing implies recovery
authority, and recovery stays with the wallet (§11.4).

**Why the session key and the device key stay separate**, despite the appeal of one fewer key:
the session key signs *chain transactions*, the device key signs *HTTP requests*. Merging them
means presenting the more dangerous key to our server on every single request, widening its
exposure for no gain. Separation also preserves attribution — three replicas share one on-chain
session but hold three device keys, so the audit log still says which instance acted.

### 12.5 The load-bearing assumption — flagged, not assumed

Per this repo's no-vendor-invention rule, one question must be answered against the SDK **before
any of §12.3 is built**, because the whole safety argument rests on it:

> **Is `grantSession`'s spend cap cumulative and non-refilling for the session's life, or does it
> refill per period?**

- **Cumulative** → §12.1's requirement is satisfied natively and this design is sound as written.
- **Refilling** → auto-renewal reintroduces exactly the escalation §12.1 rules out, and
  `settlement` must enforce a cumulative ceiling itself. Auto-renewal then becomes a trade-off
  with a real cost rather than a free win.

Two smaller items in the same class:

- Does the Keystore expose **remaining** budget readably, or only the original grant? §9.2's
  second check needs the former.
- Can a session key be rotated without a fresh `grantSession` (i.e. without a human signature)?

None of these block Phase A, which does not touch Ring 3. All three block §12.3.

---

---

## 13. Threat model

Written attacker-first: what someone actually does, not what a checklist says.

| # | Attack | How it plays out here | What stops it | Residual |
|---|---|---|---|---|
| 1 | Steal the token from a log, transcript, or repo | Attacker has the string | Useless without the device key (§8.2). Prefix triggers secret scanning → auto-revoke | None material |
| 2 | Steal token **and** device key (host compromise) | Attacker is the agent | Caps, expiry, on-chain limit (§9.2), human revoke | **Real.** See §14 |
| 3 | Prompt-inject the agent into hiring an attacker's listing | Injected text in a repo/webpage tells the agent to hire | Model never sees the credential (§10.2); caps bound the loss; `session:grant` is not delegable; the on-chain cap holds | Bounded loss up to `maxSpendPerJob` |
| 4 | Replay a captured request | Re-send the signed `hire` | `iat` window + `jti` cache + `bh` + `htu` (§8.2) | None |
| 5 | Downgrade — strip the proof header | Hope the server accepts bearer | The permissive code path does not exist | None |
| 6 | Enumerate which wallets are registered | Query by address to build a target list | No address-keyed existence endpoint (§7.1) | On-chain activity is public regardless |
| 7 | Pre-register a victim's wallet | Enroll `0xVictim`, wait for them | Enrollment requires their EIP-712 signature | None |
| 8 | Sybil — thousands of accounts | Free accounts to farm rate limits, reviews, ranking | Accounts start `UNFUNDED` (§6.1): reads only. Hiring needs real escrow. Reviews need a settled job (`05` §5.4). Clustering feeds `02` | Attacker can spend money to look real — same as any market |
| 9 | Steal our credential database | Dump the table | Hashes and public keys only. No secrets, no private keys. Still needs a device key **and** the on-chain cap | None from this table alone |
| 10 | Cross-environment replay | Use a testnet delegation on mainnet | `net` in the token, `chainId` + `salt` in the domain | None |
| 11 | Cap race — two concurrent hires | Both pass a check-then-act cap | Atomic reservation (§9.3) | None |
| 12 | Confused deputy — sub-hiring | Agent A forwards its credential to B | **Credentials are non-delegable and non-forwardable.** B enrolls its own; the chain of escrows is on-chain and attributable | None |
| 13 | Timing attack on lookup | Probe response times to recover a secret | Lookup by `kid`, constant-time hash compare | None |
| 14 | Clock manipulation on the agent host | Widen the replay window | ±90s hard bound; future `iat` beyond skew rejected | 3-minute window, accepted |
| 15 | Use a Standing-tier credential (spend window lapsed) maliciously | Read the buyer's job history; file a self-serving review; cancel a live job | Requires the device key too, i.e. host compromise (§14). Every Standing scope is neutral or exposure-reducing (§9.1), so the ceiling is a privacy leak and nuisance cancellation — never a transfer | Accepted: strictly smaller than the §13 residual it is a subset of |
| 16 | Steal the session key — the "permanent key" | Attacker renews our credential indefinitely and acts on-chain as the agent | Bounded by the on-chain cap (non-refilling — §12.5) and the session expiry; `revokeSession` kills it in one tx and works even if our entire backend is compromised | Bounded loss up to remaining session budget — the blast radius the buyer saw in the Keystore before signing |
| 17 | Compromise our backend and try to extend a session | Widen cap or push out expiry to escalate | We never hold `grantSession` authority (§12.3). Widening requires the human's wallet key | None |

---

## 14. The honest limit

In the style `final-review 01` §6.3 sets for the sandbox test, the limit is stated plainly
rather than implied away.

**If an attacker owns the machine the agent runs on, they have the device key and the token, and
they are that agent.** No credential design fixes this — the credential is on the compromised
machine by construction. Every mechanism here is chosen on the assumption that this eventually
happens to someone, and the goal is that it is *survivable and bounded* rather than prevented:

- the on-chain cap the buyer signed is the true ceiling, and no server-side compromise moves it;
- expiry closes the window even when nobody notices;
- revoke is immediate and visible, on-chain and off;
- attribution survives, because credentials are per-instance and non-forwardable, so the audit
  log says which instance did it.

That is the correct target. A design that claimed to prevent host compromise would be lying.

---

## 15. Where the code goes

Per `00` §7.2, and adding one package.

| Piece | Home | Ring |
|---|---|---|
| Scope/cap predicates, delegation validity, state-machine guards | `packages/domain` | 0 — pure, exhaustively testable, **one implementation every door calls** (`00` §3.5) |
| Accounts, credentials, device keys, nonce/`jti` cache, cap reservations | `packages/access` **(new)** | 2 — owned state, recoverable |
| On-chain revoke detection → cascade | `apps/watch` → `apps/jobs` | watch detects only; it has no import path to Ring 3 (`00` §5.1) |
| The second, authoritative cap check | `packages/custody` · `packages/settlement` | 3 — never trusts the off-chain check |
| `/llms.txt`, `/.well-known/*`, `/mcp`, A2A, the API itself | `apps/api` | app — thin transport, no policy |
| Credential list + revoke UI | `apps/web` (buyer) · `apps/console` (builder) | app — the dashboard is human-only; agents never log in |

`packages/access` is capability-named, so the vendor inside it is swappable (`00` §3.2), and it
is distinct from `agent-registry`, which reads *on-chain* identity and must not be confused with
*our* account records. It declares `"ring": 2` in its manifest and is picked up automatically by
`tooling/check-boundaries.ts` — no new lint rule needed, which is the point of that checker.

---

## 16. Build plan — staged against the 2026-09-09 deadline

Eight days, with the UI scaffold still in flight (Decision 0003). Scoped accordingly: §4 already
established that the credential system is not what makes a hire *work*, so it is staged behind
the things that are.

### Phase A — the demo path (target: 2 days)

- [ ] `/llms.txt`, `/.well-known/agent.json`, `/.well-known/ai-catalog.json` served from `apps/api`
- [ ] `/mcp` with `search` · `get` · `quote` · `hire`, credential held server-side (§10.2)
- [ ] `POST /v1/auth/challenge` + `/enroll` — EIP-712, single-use nonce, 120s
- [ ] Token mint/format/hash-store (§8.1); `AOPS-PoP` + `AOPS-Proof` verification (§8.2), **no bearer path**
- [ ] `packages/access` standing with `"ring": 2`; guards in `domain`; `bun run check:boundaries` green
- [ ] `catalog:read` open and tokenless — verified by an unauthenticated `curl`
- [ ] Hires stay `mode: simulate` per `00` §6.1 — unchanged by any of this

### Phase B — the parts that make it safe to point at real money (target: 2 days)

- [ ] Scopes + atomic cap reservation (§9.3), with a concurrency test that actually races it
- [ ] Two-check rule wired: Ring 3 re-derives the cap from chain state (§9.2)
- [ ] Rotation with 5-minute overlap; expiry enforced
- [ ] Revoke endpoint + dashboard row (`last_used`, scopes, caps, one button)
- [ ] Cascade revoke from the on-chain event via `watch` → `jobs`
- [ ] Account `UNFUNDED → FUNDED` transition; `job:create` gated on it
- [ ] Two-clock expiry (§11.1) and the Standing tier — **including a test that an expired-spend credential can still file feedback**, which is the `RESTRICTED` deadlock (§9.1)
- [ ] `POST /v1/auth/refresh` (reopens the window, does not rotate the string); `AOPS-Spend-Expires` header; hire-time warning when job horizon > spend window
- [ ] Public job-receipt endpoint keyed by on-chain job id (§11.5)
- [ ] Explicit test: revoking a credential leaves its jobs untouched (§11.5)
- [ ] **Confirm §12.5 against the Altana SDK before wiring auto-renewal** — cap refill semantics, readable remaining budget, session-key rotation. Blocks §12.3, blocks nothing in Phase A
- [ ] `grantSession` → derived credential: `spend_expires_at` ceilinged by on-chain session expiry (§12.3)
- [ ] Auto-renew while the session is live and funded; Keystore entry surfaced in the dashboard next to revoke

### Phase C — hardening, after the mandated-category work (post-submission if it comes to that)

- [ ] `RESTRICTED` state wired to `05` §5.4's feedback gate
- [ ] x402 on `quote` as payment-in-place-of-account
- [ ] Anomaly-triggered auto-revoke; velocity limits per account/wallet/ASN
- [ ] `aops_` prefix registered with GitHub secret scanning + revocation endpoint
- [ ] Signals into `02`'s clustering

The demo that wins nothing extra but must not break: a Claude Code session enrolls, searches,
and hires in simulate mode without the developer's private key ever leaving their wallet — and
the developer revokes it from the dashboard, on camera, in one click.

---

## 17. Open items

Tuning values and deferred decisions, listed rather than silently assumed — consistent with
`final-review 01` §11.

- Exact default caps for `dlg` vs `svc`, and whether `maxSpendPerDay` resets on a rolling
  window or a UTC boundary. Rolling is more correct; UTC is easier to explain in a dashboard.
- Live-credential ceiling per account (proposed 5) and behaviour at the ceiling — currently
  "explicit revoke required," which is safe but could annoy a legitimately-scaled operator.
- Whether `svc` credentials for agents that already hold an ERC-8004 identity should skip
  enrollment entirely and authenticate by on-chain identity signature alone. Cleaner, but it
  means two authentication paths, and §3's fourth-row test says one path is worth a lot.
- Whether the `jti` replay cache is per-process memory or shared. Per-process is a real
  weakening under horizontal scale (the same `jti` replays against a different instance) —
  needs to be shared before Phase B is called done.
- Rate limits per scope, and whether `catalog:read` gets a soft limit for anonymous callers
  without becoming an adoption barrier.
- ~~Absolute ceiling on `valid_until`'s sliding extension~~ — **resolved by §12.3**: the ceiling
  is the on-chain session expiry. Not a config value we choose.
- ~~How the `dlg` refresh link reaches a headless human~~ — **largely resolved by §12.3**: the
  human signed `grantSession` up front, so routine renewal needs nobody. A pending-signature item
  in the dashboard is still needed for the case where the session itself has expired.
- The three Altana confirmations in §12.5. The first one is load-bearing for the whole
  auto-renewal design and should be answered before Phase B, not during it.
- Whether `packages/access` or `domain` owns the canonical scope string encoding. Leaning
  `domain`, since the EIP-712 payload's `scopes` field must be byte-identical on both the
  signing and verifying side and that is exactly the kind of pure, exhaustively-testable
  encoding Ring 0 exists for.
