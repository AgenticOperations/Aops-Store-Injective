# Aops-Store-BNB — Agent Workspace Rules

Agent marketplace for BNB Chain's "Build the Era" hackathon. See `PRODUCT-STATE.md` for what's
currently being built/decided — read it at the start of any non-trivial session.

This file exists because of a recurring, concrete failure mode: new ideas discussed in
conversation kept conflicting with things already written in older docs, and that conflict
got treated as a silent veto — either the new idea got blocked because "the docs say
otherwise," or an old doc got silently contradicted with nothing updated to reflect it.
Found in the wild in this repo on 2026-08-24: three files describing three different
trust-tier systems simultaneously, and a set of states (`COMMERCIAL_VERIFIED`, `RISK_REVIEW`,
`APPROVED`) silently dropped from the ingestion ladder with no record of the decision. The
rules below exist to stop that specific thing from happening again.

## Doc pipeline — three tiers, in order

1. **`docs/unverified-ideas-and-flows/`** — raw ideas, from either collaborator (Ryuk or KC)
   or an AI session. No structure required. Nothing here is binding on anything, and nothing
   here should be treated as a reason to block discussing a different idea.
2. **`docs/architecture/`** — structured, verified design docs (numbered sections,
   `decisions/` holds ADRs recording *why* a change was made — folded into the numbered files,
   not read as a separate parallel source of truth). This is where active design work happens
   and content can still change as understanding improves.
3. **`docs/final-review-docs/`** — canonical, factually-proven-robust, ready-for-review docs.
   Once a topic has an entry here (tracked in that folder's own `README.md`), it is the source
   of truth for that topic. `docs/architecture/` content on the same topic is reconciled
   toward it, never the reverse.

## The rule that actually fixes the recurring conflict

An older doc describing a topic that's now being actively redesigned in conversation is
**not a veto**. When a new idea conflicts with something already written:

- Say so explicitly and name the conflict, quoting the specific line/section.
- Do not silently treat the old doc as binding and refuse to discuss the new idea further.
- Do not silently overwrite the old doc either, before the human(s) have actually decided.
- Once a decision is made, update the doc **and** stamp everything it supersedes, in the same
  turn (see below). Discussion happens first; documents catch up after, not before.
- If dropping or changing something that existed before (a state, a gate, a rule), say so
  explicitly, even if it seems like an obvious simplification. "This exists in doc X and I'm
  now removing/changing it because Y" is one sentence. Silently letting it disappear is the
  exact failure this file exists to prevent.

## Supersession rule (mandatory, not optional)

The moment a doc's content is superseded by a newer decision, in the **same turn**:

1. Add an inline `⚠ SUPERSEDED` (or reconcile the content directly, if it's cheap to do so —
   prefer fixing the actual table/text over just a warning banner where feasible) at the exact
   section, pointing to the doc that replaces it.
2. If a `docs/final-review-docs/` entry is involved, update that folder's `README.md` status
   table.
3. If something is being dropped/changed without a full resolution yet, add it to an explicit
   "open architectural gaps" note in the affected canonical doc (see
   `final-review-docs/01-ingestion-and-registration-of-agents.md` §12 for the pattern) — not
   silently, and not conflated with ordinary tuning-value open items.

Do not defer any of this to "later." Deferring it is exactly the mechanism that caused the
2026-08-24 three-way trust-tier conflict.

## Handoffs — named for the reader, not the writer

Two append-only logs: `HANDOFF_RYUK.md`, `HANDOFF_KC.md`. **A handoff goes in the file named
for whoever it is written *to*** — KC writing for Ryuk appends to `HANDOFF_RYUK.md`; Ryuk
writing for KC appends to `HANDOFF_KC.md`. Never edit or delete prior entries in either file.
If it's unclear who the note is for, ask before appending.

> ⚠ **Changed 2026-08-25**, superseding "each session appends to the file matching whoever is
> driving that session" — which was the reverse. `HANDOFF_KC.md`'s existing entry already
> follows this rule (written by Ryuk's session, for KC). `HANDOFF_RYUK.md`'s pre-split entries
> are author-keyed self-logs from before 2026-08-24 and are left as they are, not reinterpreted.

## Rigor bar for `docs/final-review-docs/`

Writing or editing anything in this folder requires the same bar as
`01-ingestion-and-registration-of-agents.md`: primary-source-verified (not asserted from
memory), actively challenged for loopholes before being called done, and any gap versus prior
docs resolved explicitly — named and decided, or named and left open — never silently
dropped.

## Never do

- Do not treat `docs/architecture/` content as immutable just because it's already written —
  it's the "structured but still refinable" tier, not the final tier.
- Do not invent Circle/AACP/Altana/PancakeSwap/Venus/ERC-8004 API behavior — verify against
  primary sources (raw whitepaper text, live API calls via `curl`/`gh api`, not WebFetch
  summaries — see `docs/architecture/03-evidence-trust-engine-pipeline.md`'s Audit Notes for
  the standard this repo already holds itself to).
- Do not push to `main` directly.

## Branches

- `main` — stable.
- `planning/docs` — architecture/design docs land here first, before any code.
