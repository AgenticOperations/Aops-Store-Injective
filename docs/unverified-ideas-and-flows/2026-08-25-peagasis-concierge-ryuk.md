# PEAGASIS — Conversational Concierge Layer (Unverified, raw capture)

Author: Ryuk (+ GPT session, pasted verbatim into this repo 2026-08-25 after being lost across
two prior sessions — see reconciliation note at the bottom). Drop-zone doc per this folder's
README. This is the source-of-truth capture of the original content — do not summarize over it
or lose the specifics again; extend it in a new doc/section instead of editing this one.

**PEAGASIS = Personalised Agentic Service Infra for the Site.**

---

## Raw content, as provided

PEAGASIS serves as the conversational orchestration layer embedded in `apps/web`, transforming
ambiguous natural language or voice prompts into structured, risk-scoped agent hiring
transactions. On the UI side: a greeting/marketplace agent predominantly present in the Discovery
UI, conversational support starting with discovery of agents, that also questions the user if
their request can't directly resolve to the best agent (asks for more detail) — making discovery
much more usable once the backend Discovery service itself is robust.

```
                                  [ User Voice / Prompt ]
                                             │
                                             ▼
                             ┌───────────────────────────────┐
                             │        PEAGASIS AGENT         │
                             │   Conversational Concierge    │
                             └───────────────┬───────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
        [Ambiguous Intent / Missing Params]               [Complete Intent]
                       ▼                                           ▼
          [Multi-Turn Clarification]                   [Deterministic Search Query]
     "What's your risk tolerance on Venus?"                        │
     "Set max spend cap in USDC?"                                  ▼
                       │                               ┌───────────────────────┐
                       └──────────────────────────────►│ Discovery Engine      │
                                                       │ • Trust-Tier Filter   │
                                                       │ • Category Scoping    │
                                                       └───────────┬───────────┘
                                                                   │
                                                                   ▼
                                                       [Pre-Populated Hire Card]
                                                       • Agent: Venus Sentinel
                                                       • Altana Session Scope
                                                       • 1-Click Signature
```

### Core Functional Capabilities

**Multi-Turn Slot-Filling & Disambiguation**: When inputs lack parameters (e.g., "Make money on
BNB"), PEAGASIS initiates targeted follow-ups rather than returning generic results:
- Clarification prompt: "Are you looking for automated yield routing on Venus, LP range
  rebalancing on PancakeSwap, or grid trading?"
- Parameter extraction: solicits specific bounds — capital allocation, allowable drawdown, target
  pool/token, session duration.

**Transparent Trust & Evidence Translation**: Translates complex backend trust metrics into clear
rationale:
- Highlights the agent's trust tier (Basic, Verified, Proven, Institutional).
- Summarizes verifiable proofs: "This agent holds Proven status with 5 verified executions via
  AACP and zero liquidations over 30 days."

**1-Click Altana Session Formulation**: Constructs the exact non-custodial authorization schema
(contract allowlist, spend_cap, expiry) directly in the chat drawer, letting users review
boundaries and sign in a single wallet interaction.

### Integration Architecture in `apps/web`

| Layer | Implementation Component | Function |
|---|---|---|
| Client UI | `apps/web/components/peagasis/` | Omnipresent floating assistant / conversational search modal with voice-to-text input and inline interactive agent preview widgets |
| Orchestrator API | `apps/web/app/api/peagasis/chat/` | Serverless route executing the intent-parser chain (LLM function calling with strict JSON output schemas) |
| Catalog Resolver | `chain-adapters/8004scan` & `packages/db` | Executes semantic vector + filter queries against verified listings, matching category and requested risk parameters |
| Session Builder | `chain-adapters/altana` | Constructs the unsigned EIP-712 session grant payload for browser-wallet signature |

### Clarification Flow Example

> **User**: "Protect my borrow position from getting wiped out."
>
> **PEAGASIS**: "I found 2 agents in the Health Factor Monitoring category. To configure the
> right session:
> 1. Which lending protocol are you using (e.g., Venus Protocol)?
> 2. What is your minimum target Health Factor (recommended: ≥1.30)?
> 3. What is the maximum USDC reserve you authorize the agent to draw to repay debt?"
>
> **User**: "Venus, HF 1.35, max 300 USDC."
>
> **PEAGASIS**: "Matched Venus Sentinel v1 (Proven Tier, L3 execution proof). Review the session
> permissions below and click Grant & Activate."

### Open question (as originally posed)

Should PEAGASIS remain purely a pre-hire discovery and configuration concierge, or should it also
provide post-hiring proactive notifications (e.g., alerting the user in-app when an agent
triggers an automated rebalance or nears a spend cap)?

---

## Reconciliation note (added on capture, 2026-08-25)

Two things worth flagging plainly rather than silently smoothing over, since this content was
written independently of the rest of this repo's design:

1. **Conflict with an established hard constraint**: the Catalog Resolver row above says
   "semantic vector + filter queries." The project's locked constraint (from an earlier session,
   restated verbatim on record) is that ranking/matching must be a deterministic, tunable
   weighted formula — **never** embedding-similarity search. PEAGASIS's own multi-turn
   slot-filling actually *matches* that constraint well (LLM only extracts structured parameters,
   same bounded role already designed for E8's query parser in
   `2026-08-25-discovery-engine-ryuk.md`) — but the "semantic vector" phrase in the Catalog
   Resolver row contradicts it and needs to be corrected to "deterministic filter + E9 ranking"
   when this gets formalized, not carried forward as-is.
2. **Overlaps with, doesn't replace, the E8–E10 Discovery Engine doc**: PEAGASIS is the
   human/voice-facing concierge UI over the same Discovery/Ranking/Compare pipeline already
   designed — the "Deterministic Search Query" step in the diagram above is E8, "Trust-Tier
   Filter / Category Scoping" is E8's executor, "Pre-Populated Hire Card" is E10 Compare feeding
   E11 hiring. This doc and the Discovery Engine doc need to be reconciled into one, not kept as
   two competing descriptions of the same flow.
