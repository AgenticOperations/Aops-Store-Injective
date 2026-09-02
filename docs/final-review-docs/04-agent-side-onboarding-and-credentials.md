---
created: 2026-09-01
project: BUILD-BNB — BNB "Build the Era" marketplace
status: drafted, adversarially reviewed before write. This is the buyer/caller-side
  counterpart to final-review 01, which covers seller-side onboarding only. Two corrections
  to the originating brief are applied in §2 rather than silently absorbed. Amended 2026-09-01
  with §11.5 (credential lapse vs. job lifetime) and §12 (Altana sessions as the renewal root,
  which resolves the `dlg` refresh friction and carries one unconfirmed vendor assumption in §12.5).
  Further amended 2026-09-01 with §11.6, closing a gap surfaced in review: neither §11.3's
  credential-revoke row nor `05` §5.2's seller-trust UI specifies a buyer's own job-history view.
  Substantially simplified 2026-09-02: §7/§9/§11/§12 previously had the credential carry its own
  signed copy of scopes and spend caps, re-verified against the chain as a second check. Once
  every caller holds its own Altana session (§12), that copy has nothing to check against except
  the same grant the chain already holds — a duplicate that can only ever agree or be wrong. It
  is removed; the chain is now the only place authorization is decided (§9.2), and the credential
  is downgraded to exactly what it needs to be: a wallet-bound, device-bound receipt (§2.2).
  Same day, §12.5's flagged vendor assumption was checked directly against `docs.altana.network`
  and resolved against the hoped-for outcome: the session spend cap is a rolling-period rate,
  not a non-refilling lifetime pot, and the Keystore carries no remaining-budget field. §12.1,
  §12.2, §12.5, §9.3, and threat-table row 16 are corrected accordingly — the design still
  holds, but the actual bound on a compromised session is `rate x time-until-revoked`, not a
  fixed amount, which is now stated as such rather than assumed away.
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

### 2.2 The token is a receipt, not an authority

A bearer token that *is* the identity means: whoever holds the string is the buyer. In an agent
context that is a much worse assumption than in a web app, because agent credentials leak
through channels a web app does not have — model context windows, chat transcripts pasted into
issues, MCP config files checked into repos, verbose tool logs, crash dumps, and the agent
helpfully printing its own configuration when asked to debug itself.

So the wallet signature is the identity, the on-chain session is the authority (§12), and the
token is neither. It is a **disposable, device-bound receipt** that a wallet recently proved
itself — kept around so the agent does not have to re-sign an EIP-712 payload on every `search`
call. It grants nothing by itself (§9), it is useless on its own (§8), and stealing it without
the paired device key buys an attacker nothing. The agent still stores one string and
re-presents it, exactly as the brief wanted. It simply never carries authority — only a wallet
signature and an on-chain session do that, and both already lived outside our system before any
of this was designed.

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

   authorization   = what the contract    authorization  = §9 tiers — anything that
   permits                                moves value is decided on-chain, period

   WE ISSUE NOTHING. There is no          WE ISSUE a credential, because there is
   account to have. The chain is          off-chain state to bind to: job history,
   the account.                           feedback debt, rate limits.
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
feedback debt (`05` §5.4), rate limits, and `02`'s sybil clustering hang off — off-chain state
that has no on-chain equivalent. Spend caps and expiry are never duplicated here; they live
exactly once, on-chain, in whatever session gets bound to this Account (§7.4, §9, §12). It is
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

### 7.2 The flow — enroll once for Standing, bind a session for Fresh

Enrollment is two steps, and most callers only ever need the first — the second is only for
callers that will create or fund jobs, not ones that only search and read.

```
  BASE ENROLLMENT — unlocks Standing tier. No on-chain session needs to exist yet.

  1. agent generates Ed25519 device keypair            (local, never transmitted)

  2. POST /v1/auth/challenge  { wallet, device_pubkey }
     ← 200 { eip712_payload, nonce, expires_at: now+120s }
        nonce is single-use, stored server-side, bound to (wallet, device_pubkey)

  3. wallet signs the EIP-712 typed data               (human clicks, or agent signs)

  4. POST /v1/auth/enroll  { nonce, signature, device_pubkey }
     server: recover signer → must equal payload.wallet
             nonce unused, unexpired; chainId + salt match this environment
     ← 201 { account_id, credential (shown EXACTLY ONCE), valid_until }
        an already-enrolled wallet gets 200 with its EXISTING account_id and a NEW credential

  5. agent stores credential + device key              (§10.2 storage rules)

  BINDING A SESSION (§7.4) — unlocks Fresh tier. Requires a grantSession to already exist.

  6. POST /v1/auth/bind-session  { session_id }
     server reads the Altana Keystore entry for session_id: does it name this wallet
     (or this wallet's controlling delegate) as an authorised party?
     ← 200 { fresh: true, session_expires_at }
        no signature required — see §7.4 for why that is not a shortcut
```

Step 4's "already enrolled returns the existing account" is deliberate: agents retry, and an
error here produces a loop that a human has to break. Credential sprawl is bounded instead by a
per-account live-credential ceiling (default 5) — reaching it requires an explicit revoke, not
a silent eviction of whichever credential a running job happens to be using.

### 7.3 The signed delegation

The EIP-712 struct proves wallet control and binds a device key. Nothing else belongs in it,
because nothing else is ours to grant:

```solidity
domain = { name: "AgentOps Marketplace", version: "1", chainId: <56|97>, salt: <env> }

struct AgentEnrollment {
  string  intent;          // "enroll" | "revoke" — never overloadable
  address wallet;
  bytes32 devicePubKey;
  uint64  issuedAt;
  bytes32 nonce;
}
```

An earlier draft of this struct also carried `scopes`, `maxSpendPerJob`, and `maxSpendPerDay` —
signed once, re-signed to widen. That was a second, off-chain-only copy of exactly what
`grantSession` already signs on-chain. Two places asserting the same fact is not two controls;
it is one fact with a second copy that can only ever agree with the original or be wrong, and no
mechanism was keeping the two in agreement. Removing them deletes that entire class of bug —
"off-chain says X, on-chain says Y" — rather than defending against it.

- **`chainId` + `salt`** kill cross-environment replay. A testnet delegation is structurally
  invalid on mainnet. This is the same instinct as `00` §6.1's simulate-by-default rule,
  applied to credentials.
- **EIP-712, not `personal_sign`**, for the same reason `final-review 01` §4.1 requires it on
  the seller side: a raw message signature is a blank cheque that can be re-presented anywhere,
  and the wallet UI cannot show the human what they are agreeing to.
- **`intent` is a distinct field**, so an enrollment signature can never be replayed as a
  revocation or vice versa.

### 7.4 Why binding a session needs no second signature

Step 6 (§7.2) grants Fresh tier from nothing but an on-chain read. That is not a shortcut taken
for convenience — it is the direct, necessary consequence of §12.3's rule: **we never mint
authority, we mirror it.** The human already authorised exactly this by signing `grantSession`
once, directly with Altana, outside our system entirely. Asking for a second signature over a
fact that is already public and already binding on-chain would not add security — it would ask
the human to re-approve something they already approved, and give us a second copy of an
answer we could just read.

The only thing our read has to get right is **which wallet** the Keystore names as the session's
authorised delegate, checked against the wallet that signed §7.3's enrollment. Get that
comparison right and there is nothing left for a signature to additionally prove.

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
7. tier permits this route (§9) — Fresh-tier calls are confirmed live against the bound
   session, never against anything stored off-chain

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

## 9. Authorization — two tiers, mirrored from the chain

### 9.1 Standing and Fresh, not nine scopes

Actions split into two tiers by **which way they move the buyer's exposure**, not by a
per-action scope list re-signed every time it changes. Only two facts ever need checking: is
this Account enrolled and not `SUSPENDED` (Standing) — and, for anything that increases
exposure, is there currently a **live on-chain session bound to this Account that covers this
exact call** (Fresh).

> **Expiry may only remove the ability to *increase* exposure. It may never remove the ability
> to reduce or freeze it.**

A safety control that expires is not a safety control. An agent whose Fresh access has lapsed
must still be able to cancel, dispute, and revoke — those actions can only ever make the buyer
safer, so gating them behind a live session would mean the system becomes *less* safe the longer
nobody touches it.

| Tier | Covers | Requires |
|---|---|---|
| **Public** | search, get, compare | nothing — no credential at all |
| **Standing** | quote, full view of **own** jobs, evidence timeline, dispute thread, filing feedback, cancel, dispute, revoke-own-credential | any enrolled, non-`SUSPENDED` Account (§6.1) — no session needed, ever |
| **Fresh** | create/fund a job, approve release | a live on-chain session bound to this Account (§7.4), whose allowlist and remaining cap cover this specific call |

Two placements are worth defending explicitly:

- **Filing feedback is Standing, not Fresh.** It moves no money, and putting it behind Fresh
  creates a deadlock: `RESTRICTED` (§6.1) blocks the next hire until feedback is filed, but
  filing it would require a live session the agent may no longer have, so the account could
  never leave `RESTRICTED`. This was a real bug in an earlier draft of this document, caught by
  asking what a coding agent does two months after its session lapsed.
- **Approving release is Fresh, even though the escrow is already funded.** Release looks like
  "completing a committed transaction," but a provider who has compromised a buyer's agent could
  release their own payment before the work is verified. That is theft, so it stays behind a
  live session.

**Granting a session is not one of our tiers at all.** `grantSession` happens directly between
the human's wallet and the Altana contract, over the Altana SDK — it never passes through our
API, so there is nothing here for us to gate. We only ever read the result (§7.4).

### 9.2 The chain is the only real check

> **There is exactly one place that decides whether a value-moving call is allowed: the
> on-chain session.**

An earlier draft of this document specified a "two-check rule" — an off-chain scope/cap check at
the API boundary, independently re-verified on-chain at Ring 3. Once every caller holds its own
session (§12), that off-chain check has nothing left to check *against* except a copy of the
same grant the chain already holds. A copy that can only ever agree with the original, or be
wrong, is not a second control — it is a place a bug can make the two disagree, which is strictly
worse than not having it.

So Ring 3 (`custody`/`settlement`) reads the caller's bound session directly from chain state and
decides, once, with nothing off-chain asked to agree first. A total compromise of our database
cannot move a Fresh-tier action past what the buyer signed on-chain, because our database was
never where that decision was made — there was never a second decision to compromise.

### 9.3 The off-chain mirror is a courtesy cache, never a boundary — and it has less to mirror than planned

Checking the bound session's live state before forwarding a call — rather than always making the
caller wait on Ring 3's own read — is worth doing for latency and for a better error message
("your session cap is exhausted" beats a raw contract revert). This is **read-through caching of
public on-chain state, not an authorization decision**, and the code must reflect that
distinction, not just the prose: a stale or wrong cache may produce a false rejection (retried,
annoying) but must never be able to produce a false approval, because Ring 3 checks again
regardless and is the only check that was ever load-bearing.

**§12.5 checked this cache's intended data source and it does not exist where this section
assumed.** The Keystore exposes authorization state only (valid / revoked / expired) — no spend
or remaining-budget field. Two honest options, not one assumed-free one:

1. **Don't show a remaining-budget number at all.** Forward the call, let `execute` revert if the
   current period's rate is exhausted, surface that reason. Zero new infrastructure; a slightly
   worse error message than originally planned.
2. **Compute it ourselves**, by indexing this session's `execute` events on-chain and summing
   spend within the current period. This is a read-only rollup over independently-observed chain
   state — the same shape as `metrics`'s existing KPI computations, never fed back into an
   authorization decision — so it does not reopen the single-source-of-truth problem §9.2 fixed.
   It is genuinely new work, not a free read, and belongs wherever `apps/watch` already observes
   this session for the §11.3 revoke cascade.

Cut for Phase A regardless of which option is chosen later; option 1 is the default until there
is a concrete reason to build option 2.

**The one assumption this section still leans on** — flagged with the same discipline as §12.5,
because it is exactly as load-bearing: *does the Altana session contract enforce its per-period
spend cap atomically inside `execute`, such that two concurrent calls within the same period
cannot together exceed it?* Any sane spending-limit contract does this by construction — the cap
check is a `require` against on-chain state, and a chain has no concurrent writes to race
against. But it is an unconfirmed vendor fact (§12.5), not a design choice of ours, and it must
be confirmed before "the chain is the only real check" is treated as settled rather than
assumed.

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

### 11.1 Expiry — one stored clock, one derived fact

Only one expiry is ours to store: `valid_until` (Standing tier) — **90 days, sliding**, extended
on every authenticated request. An actively-used credential effectively never lapses; one
abandoned for a quarter does — which is the correct shape, since an idle credential is exactly
the one most likely to be sitting in a stale config file somewhere.

Fresh-tier access is **not a second clock we maintain.** It is a live fact, read or cached from
the bound session (§9.2/§9.3): is there currently a live, funded, on-chain session bound to this
Account that covers the requested call? When the session expires or is exhausted, Fresh access
ends the instant that becomes true on-chain — never on a schedule we chose, and never later than
what the buyer actually signed.

**A `valid_until` lapse degrades a credential to nothing — re-enrollment required. A
Fresh-availability lapse degrades it to Standing only.** Neither ever touches a job already in
flight. See §11.5.

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
| **Standing** | credential + device key, within `valid_until` — regardless of whether any session is bound, or a bound one has since lapsed | Everything above, plus the **enriched** view: evidence timeline, provider reports, dispute thread, cost breakdown. Plus file feedback, cancel, dispute, revoke (§9.1). |
| **Fresh** | credential + device key, within `valid_until`, **and** a live on-chain session bound to this Account (§9) | Everything above, plus create, fund, approve. |

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

1. **Pre-flight warning at hire time.** If the job's horizon exceeds the bound session's
   on-chain expiry, the quote and the hire response both say so explicitly, and
   `AOPS-Session-Expires` is on every response header so an agent can plan rather than discover.
2. **Release is an on-chain timeout, not an HTTP call.** The ERC-8183 escrow's own dispute
   window and auto-release terms govern settlement for any job outliving the spend window.
   `job:approve` is the *early* path, not the only path. The chain is the source of truth
   (`00` §1.3), so the long-horizon case is handled where it should be — in the contract the
   buyer already signed — and never by our uptime or a human's calendar.

### 11.6 The buyer-facing job history view — the screen §11.3 and `05` §5.2 do not cover

§11.3 specifies one row per **credential** — what can currently act, and a kill switch. `05`
§5.2 specifies four layers about **a seller's** trustworthiness. Neither is "what has my agent
actually done," and that gap has a name now because a real question exposed it: a coding agent
whose credential lapsed weeks ago still needs a place to see its own history when it comes back.

**This is a read, not a new capability.** `job:read` already exists at Standing tier (§9.1) —
this section specifies the query and the screen that scope was always meant to serve, since
nothing before this wrote either down.

#### The query

```
GET /v1/me/jobs?status=&feedback_owed=&hired_via=

  ownership check: job.buyer_wallet == caller's Account.wallet  — NOT by credential.
  A wallet's job history is one list regardless of which of its (possibly several,
  possibly all-expired) credentials created each row. This is §6.1's rule made concrete:
  the Account is the durable identity; credentials are disposable and never the join key.
```

Available at **Standing tier** (§11.5) — an expired spend window must not hide history, since
hiding it is exactly the failure this whole thread started from. Available with **no
credential at all** for the subset that's already public on-chain (§11.5's Public tier);
the credential only unlocks the enriched view.

#### What each row shows

```
Job #4471 · hired via: svc-a3f2… (Cursor, MCP)  ← which credential/session created it
Provider: YieldOptimizer-v2 · $200 · ACTIVE
Created 2026-07-14 · that credential's status now: EXPIRED (Standing)
[Evidence timeline →]  [File feedback]  [Dispute]
```

- **`hired_via`** — attribution back to §6.2's per-instance credential, shown even after that
  credential has expired or been revoked. This is the same audit-log property §6.2 already
  requires for revocation; this view is its second consumer, not a new mechanism.
- **Evidence timeline** — the existing per-job feed from `05` §5.2 Layer 2, filtered to this
  job. No new evidence pipeline; a different entry point onto the same rows.
- **Feedback-owed** — surfaces `05` §5.4's gate as a visible flag on the specific job that
  triggered `RESTRICTED` (§6.1), not as an opaque account-state error discovered only when the
  next hire is rejected.

#### Placement

Query composition lives in `apps/web`'s buyer surface (thin transport, per `00` §3.5) over
`packages/access` (job-credential attribution, owned by the package that already owns
credentials — §14) joined with `packages/listings`/`evidence` (job and evidence rows, already
owned there). No new package. The join is read-only and crosses no ring boundary that isn't
already crossed by the existing dashboard.

#### What this section deliberately does not do

It does not specify a full buyer console — layout, comparison-shopping-across-jobs, exports.
That's product surface, not an architectural gap, and belongs in whatever doc eventually covers
`apps/web`'s buyer dashboard in full (none exists yet, same status as the Builder Console per
the final-review index). This section closes only the specific hole: the query, the ownership
check, and the fact that history must be visible independent of credential state.

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

**Checked directly against `docs.altana.network` on 2026-09-02 (§12.5) — that exact property does
not hold as first written.** Altana's session cap is a *rate*, not a *pot*: `{ limit, period,
token }`, and the docs state plainly that "spend permissions cap how much the session can move
per token, **per rolling period**." A session refills every period for as long as it stays live.
The property that actually holds is weaker, and stated precisely below (§12.1.1) rather than
assumed.

#### 12.1.1 The real property — bounded rate, not bounded total

A rolling-period cap still bounds something, it is just a different quantity than "the total the
key can ever move":

> **What a live, unrevoked session actually bounds is `rate × time-since-last-check`, not a
> fixed lifetime pot.** The rate itself never grows — the human set it once and it is
> immutable for the session's life — but the *cumulative* amount an undetected compromise can
> extract grows with every period that passes before someone revokes it.

This still satisfies the load-bearing half of §12.1's property — **the rate never escalates,
ever, no matter how many times access is renewed or how long the session lives** — which is what
actually rules out the refresh-token failure mode this section opened with (an attacker minting
themselves a bigger allowance). What it does *not* give us for free is a hard ceiling on total
exposure over an arbitrarily long, undetected compromise. That ceiling still exists — it is just
`rate × session duration`, a number *we* compute, not one Altana hands us (§12.5).

Two consequences, carried through the rest of this section:

- **Session duration is now a real safety lever, not just a UX convenience.** A "50 USDT/day"
  session granted for 90 days has a materially larger blast radius (up to 4,500 USDT) than the
  same rate granted for 3 days (up to 150 USDT), even though the *rate* the human approved is
  identical. §12.3's dashboard must show this multiplication, not just the rate.
- **Detection speed is doing real safety work now**, not just tidiness. §11.3's revoke triggers
  (anomaly detection, leak detection) bound the "time" term directly; they were always good
  practice, they are now load-bearing.

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

Read that surface against §12.1/§12.1.1's requirement and the mapping is exact:

| §12.1/§12.1.1 needs | Altana provides |
|---|---|
| A durable key the agent holds | the session key (`grantSession`) |
| A rate that never escalates on renewal (not a fixed lifetime pot — §12.1.1) | the session's **spend cap**, `{ limit, period, token }` |
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

- **Fresh access is simply true for as long as the session is live and funded.** There is no
  off-chain renewal mechanism because there is no off-chain clock to renew (§11.1) — no human,
  no 3am problem, no refresh link to deliver to a headless process, and nothing that can drift
  out of sync with the thing it would have been renewing from.
- It can never exceed the session's on-chain expiry, because it is never stored independently of
  it (§9.2) — a hard wall the human set, not one we did.
- Spend *per period* is bounded by the session cap, enforced on-chain at the moment of each
  `execute` (§9.2's flagged assumption). Cumulative spend across the session's whole life is
  bounded by `rate × duration` (§12.1.1) — a number we compute for the dashboard, since Altana's
  primitive is the rate, not a running lifetime total.
- Revoking the session on-chain removes Fresh access from every credential bound to it
  immediately (§11.3's cascade) — and does so even if our API is down, or hostile.

This is what turns the naive `dlg` story of "re-sign every 24 hours" into **"sign once, work for
as long as the session lasts, revoke in one click."** The friction did not get relaxed; the
authority — and the only clock that matters for it — moved to where it always belonged.

### 12.4 Three keys — the proposal conflates two of them

| Key | Held by | Lifetime | Can | Cannot |
|---|---|---|---|---|
| **Wallet key** | the human (or a `svc` agent, for itself) | permanent | grant sessions, widen scope, recover the account | — |
| **Session key** (Altana) | the agent — **this is the "permanent key"** | until session expiry or revoke | act within allowlist + cap; keep Fresh tier live (§7.4/§9.2 — nothing to renew, it's read live); read all history | grant a new session; widen its own scope; outlive its expiry; recover the account |
| **Device key** (Ed25519, ours) | one per running instance | until re-enroll | prove *which instance* is talking to our HTTP rail | move value; act on-chain |

Stated precisely: the permanent key lets the agent **resume work and read its history without
waking the human.** It does not let it *restart the account* — that phrasing implies recovery
authority, and recovery stays with the wallet (§11.4).

**Why the session key and the device key stay separate**, despite the appeal of one fewer key:
the session key signs *chain transactions*, the device key signs *HTTP requests*. Merging them
means presenting the more dangerous key to our server on every single request, widening its
exposure for no gain. Separation also preserves attribution — three replicas share one on-chain
session but hold three device keys, so the audit log still says which instance acted.

### 12.5 The vendor assumptions — checked 2026-09-02, one resolved against us

Per this repo's no-vendor-invention rule, these were checked directly against
`docs.altana.network` (`/sdk/grant-session`, `/sdk/execute`, `/concepts/sessions`,
`/concepts/keystore`) rather than left as hopeful defaults.

> **Is `grantSession`'s spend cap cumulative and non-refilling for the session's life, or does it
> refill per period?**

**RESOLVED: refilling.** `spend: [{ limit, period: "day" | "hour", token }]`; the docs state
plainly that permissions "cap how much the session can move per token, per rolling period." This
is the branch this section originally flagged as costly, and §12.1.1/§12.3 above are written to
that outcome, not the hoped-for one. Nothing about the credential design breaks — expiry, the
allowlist, and instant revoke are separately confirmed and unaffected — but the specific claim
that the *cap* alone bounds total exposure no longer holds, and no future edit to this document
should imply otherwise.

> **Does the Keystore expose remaining budget readably, or only the original grant?**

**RESOLVED: neither.** The Keystore's documented job is authorization state only — "whether a
given key is currently authorized": exists, not revoked, not expired. It carries no spend or
consumption data at all. §9.3's courtesy cache cannot read "remaining budget" from the Keystore
because that field does not exist there; a real number requires indexing on-chain `execute`
events ourselves (§9.3 amended below).

**Still open, undocumented either way:**

- Whether the per-period cap is enforced atomically inside `execute` against concurrent calls
  within the same period. §9.2/§9.3's flagged assumption stands as originally written — this
  needs the contract itself, not the docs, and still blocks nothing in Phase A.
- Whether a session's signing key can be rotated without a fresh `grantSession` human signature.

---

## 13. Threat model

Written attacker-first: what someone actually does, not what a checklist says.

| # | Attack | How it plays out here | What stops it | Residual |
|---|---|---|---|---|
| 1 | Steal the token from a log, transcript, or repo | Attacker has the string | Useless without the device key (§8.2). Prefix triggers secret scanning → auto-revoke | None material |
| 2 | Steal token **and** device key (host compromise) | Attacker is the agent | The bound session's on-chain cap and expiry (§9.2), human/cascade revoke | **Real.** See §14 |
| 3 | Prompt-inject the agent into hiring an attacker's listing | Injected text in a repo/webpage tells the agent to hire | Model never sees the credential (§10.2); the bound session's on-chain allowlist and cap hold regardless of what any off-chain layer thinks (§9.2); granting a new session is never reachable from here | Bounded loss up to the session's remaining on-chain cap |
| 4 | Replay a captured request | Re-send the signed `hire` | `iat` window + `jti` cache + `bh` + `htu` (§8.2) | None |
| 5 | Downgrade — strip the proof header | Hope the server accepts bearer | The permissive code path does not exist | None |
| 6 | Enumerate which wallets are registered | Query by address to build a target list | No address-keyed existence endpoint (§7.1) | On-chain activity is public regardless |
| 7 | Pre-register a victim's wallet | Enroll `0xVictim`, wait for them | Enrollment requires their EIP-712 signature | None |
| 8 | Sybil — thousands of accounts | Free accounts to farm rate limits, reviews, ranking | Accounts start `UNFUNDED` (§6.1): reads only. Hiring needs real escrow. Reviews need a settled job (`05` §5.4). Clustering feeds `02` | Attacker can spend money to look real — same as any market |
| 9 | Steal our credential database | Dump the table | Hashes and public keys only — no scopes, no caps, no secrets, no private keys, since none of that is stored off-chain any more (§9). Still needs a device key **and** the on-chain cap | None from this table alone |
| 10 | Cross-environment replay | Use a testnet delegation on mainnet | `net` in the token, `chainId` + `salt` in the domain | None |
| 11 | Cap race — two concurrent hires | Both pass a check-then-act cap | There is no off-chain cap to race against any more (§9). The on-chain session contract enforces cumulative spend atomically per call — §9.2's flagged assumption | Depends on §9.2's assumption holding. Our own read-through cache (§9.3) could theoretically approve both if stale, but Ring 3's live on-chain read is what actually executes, so a stale cache produces at most a wasted attempt, never a double-spend |
| 12 | Confused deputy — sub-hiring | Agent A forwards its credential to B | **Credentials are non-delegable and non-forwardable.** B enrolls its own; the chain of escrows is on-chain and attributable | None |
| 13 | Timing attack on lookup | Probe response times to recover a secret | Lookup by `kid`, constant-time hash compare | None |
| 14 | Clock manipulation on the agent host | Widen the replay window | ±90s hard bound; future `iat` beyond skew rejected | 3-minute window, accepted |
| 15 | Use a Standing-tier credential (no session bound, or a bound one lapsed) maliciously | Read the buyer's job history; file a self-serving review; cancel a live job | Requires the device key too, i.e. host compromise (§14). Every Standing-tier action is neutral or exposure-reducing (§9.1), so the ceiling is a privacy leak and nuisance cancellation — never a transfer | Accepted: strictly smaller than this table's own row 2, of which it is a subset |
| 16 | Steal the session key — the "permanent key" | Attacker keeps Fresh access live and acts on-chain as the agent, once per period, for as long as the session stays unrevoked | Bounded by the on-chain per-period rate and the session expiry; `revokeSession` kills it in one tx and works even if our entire backend is compromised | **Not a fixed pot (§12.5's refilling finding).** Bounded by `rate × time-until-detected-or-revoked` — a drip risk, not a one-time cap. Residual size depends directly on §11.3's detection speed and on how conservatively the human set session duration relative to rate (§12.1.1) |
| 17 | Compromise our backend and try to extend a session | Widen cap or push out expiry to escalate | We never hold or store *any* copy of session authority to widen (§9.2, §12.3) — there is no field in our database that means "cap" or "expiry" for a session any more. Widening requires the human's wallet key, on-chain | None |

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
| Tier predicates (Standing/Fresh), delegation validity, state-machine guards | `packages/domain` | 0 — pure, exhaustively testable, **one implementation every door calls** (`00` §3.5) |
| Accounts, credentials, device keys, nonce/`jti` cache, bound-session read-through cache (§9.3) | `packages/access` **(new)** | 2 — owned state, recoverable |
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

- [ ] Standing/Fresh tier check (§9.1) — Fresh derived live from the bound session, never stored
- [ ] **Confirm §9.2's atomicity assumption against the Altana SDK before treating "the chain is
      the only check" as settled** — does the session contract enforce cumulative spend
      atomically per call? Blocks nothing in Phase A; blocks §9.2/§9.3 being load-bearing
- [ ] Ring 3 reads the bound session directly at call time (§9.2) — the only authorization
      decision that exists; no off-chain approval is ever asked to agree first
- [ ] Read-through cache of bound-session state for fast-fail UX (§9.3), built so a stale cache
      can only produce a false *rejection*, never a false approval — with a test for exactly that
- [ ] `POST /v1/auth/bind-session` (§7.2/§7.4) — Keystore read, no signature, no stored expiry
- [ ] Rotation with 5-minute overlap; `valid_until` enforced (§11.1)
- [ ] Revoke endpoint + dashboard row (`last_used`, bound session if any, one button)
- [ ] Cascade revoke from the on-chain event via `watch` → `jobs`
- [ ] Account `UNFUNDED → FUNDED` transition; `job:create` gated on it
- [ ] `valid_until` sliding expiry (§11.1) and the Standing tier — **including a test that a
      credential with no bound session (or a lapsed one) can still file feedback**, which is the
      `RESTRICTED` deadlock (§9.1)
- [ ] Public job-receipt endpoint keyed by on-chain job id (§11.5)
- [ ] `GET /v1/me/jobs` (§11.6) — wallet-keyed, not credential-keyed; available at Standing tier
- [ ] Explicit test: revoking a credential leaves its jobs untouched (§11.5)
- [ ] Grant-session UI shows **effective max exposure = rate × session duration** (§12.1.1)
      before the human signs — this is the actual total-exposure figure now that §12.5 confirmed
      the cap is a rate, not a pot; nothing computes this for us
- [ ] Pick §9.3's option 1 (surface the `execute` revert, no stored number) or option 2 (index
      spend events ourselves) for showing remaining budget — option 1 is the default absent a
      concrete reason to build option 2
- [ ] Keystore entry surfaced in the dashboard next to revoke

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

- ~~Exact default off-chain caps for `dlg` vs `svc`~~ — **moot after the 2026-09-02
  simplification**: caps are never ours to default; they are exactly whatever the signer set in
  `grantSession`. A *recommended* cap shown in the grant-session UI before the human signs is a
  product default at the point of signing, not a backend policy — worth a product decision, not
  an architectural one.
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
- **Absolute ceiling on `valid_until`'s sliding extension is open again.** It was framed as
  resolved by the session's on-chain expiry, but after the 2026-09-02 simplification `valid_until`
  governs Standing tier only and no longer touches any session at all — it is purely our own
  clock now, and needs its own tuning decision (e.g. never beyond 1 year regardless of use).
- ~~How the `dlg` refresh link reaches a headless human~~ — **largely resolved by §12.3**: the
  human signed `grantSession` up front, so routine renewal needs nobody. A pending-signature item
  in the dashboard is still needed for the case where the session itself has expired.
- ~~The three Altana confirmations in §12.5~~ — **two resolved 2026-09-02** (cap is refilling,
  not cumulative; Keystore has no spend/remaining-budget field — both checked directly against
  `docs.altana.network`). Two genuinely remain open, undocumented either way: whether the
  per-period cap is enforced atomically inside `execute` against concurrent calls, and whether a
  session key can rotate without a fresh human signature. Neither blocks Phase A; the first
  should be answered before §9.2/§9.3 are treated as load-bearing rather than assumed.
- ~~Whether `packages/access` or `domain` owns the canonical scope string encoding~~ — **moot**:
  the 2026-09-02 simplification removed the signed `scopes` field from `AgentEnrollment`
  entirely (§7.3). There is no string to encode; tier is derived from Account state and
  bound-session presence, not from anything signed.
