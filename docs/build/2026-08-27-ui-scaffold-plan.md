# UI scaffold — Implementation Plan

> **For the build agent:** REQUIRED. Follow this plan. Do not open research docs unless a
> task below cites a specific section. Do not invent engines, routes, or Ring 3 calls.
> Decision [`0003`](../architecture/decisions/0003-kc-ui-first-then-agents.md).

**Goal:** Stand the buyer marketplace (`apps/web`) and builder console (`apps/console`) as
routable page shells, mapped 1:1 onto the five pipelines in the engine decomposition, using
fixture data only.

**Architecture:** Surfaces only. No `domain/` types (those are a later joint commit). No
`custody/`, no `grantSession`, no Postgres. Every screen names the engine it belongs to and
whether that engine is design-ready. Hire / attest / sandbox-run are labeled **not wired**.

**Tech stack:** Next.js 15 App Router · shared `@repo/design-system` · local fixtures · no
new packages.

---

## Pipeline scorecard (decomposition, 2026-08-25)

Five pipelines. **None are coded.** "Ready" here means *design-canonical enough to scaffold a
surface against*. Source: `docs/unverified-ideas-and-flows/2026-08-25-marketplace-engine-decomposition-kc.md` §4.

| Pipeline | Engines | Design-ready? | UI this scaffold ships |
|---|---|---|---|
| **① SUPPLY** | E1 Ingestion ✅ · E2 Claim ✅ | **Yes** — `final-review-docs/01` | Unclaimed directory (web). Claim flow (console). |
| **② PROOF** | E3 mechanism ✅ / rubrics ❌ · E4 🚧 (contested) · E5 ✅ rebalancing only · E6 ✅ · E7 mechanism ✅ / thresholds ❌ | **Partial** | Evidence timeline + methodology on agent detail. Sandbox *trigger* shell (console). Attest shell labeled open. KPI slots on rebalancing cards. |
| **③ DEMAND** | E8 ❌ · E9 ❌ (formula in unverified docs) · E10 compare ✅ / simulate 🚧 | **No canonical discovery** | Category browse + filter shells. Compare. Preview/simulate *render* of a fixture decision. Ranking explanation is a labeled placeholder. |
| **④ TRANSACTION** | E11 🚧 gap · E12 ✅ · E13 🚧 | **Hiring flow designed; hire-card blocked** | Hire page **not wired**. Active-hire console with a visible revoke control that does not call Ring 3. Disputes read-only list. |
| **⑤ OPERATE** | E14a ✅ · E14b deferred · E15 ❌ · E16 ❌ | **Liveness only** | Listing status shows LIVE/DEGRADED. No notification center (E15 unwritten). |

**Deferred, do not scaffold:** E14b hosted watcher, Billing, Compliance/admin ops, PEAGASIS **v2**
(conversation-set ranking weights, semantic/vector retrieval), voice.

> **⚠ Amended 2026-08-29 — Decision [`0004`](../architecture/decisions/0004-bounded-peagasis-chat-in-scaffold.md).**
> Bounded PEAGASIS **v1** (text → structured E8 query, one clarifying question, same
> deterministic filter as the grid) is now in scope — see Chunk 2a below. This line's original
> "PEAGASIS chat" and hard stop 5 below applied to the whole concept without separating v1 from
> v2; only v2 stays deferred.

**Do not put in `@repo/domain`:** fixture shapes stay inside the apps until the shared Ring 0
package is agreed (Ryuk/KC, Decision 0003's "then agents" prelude).

---

## File map

```
packages/design-system/
  public/tokens.css              tokens + reset
  public/components.tsx          Shell, Nav, Badge, Card, Stat, EmptyState, Banner, Button
  public/components.ts           re-export (keep existing export path)

apps/web/src/
  fixtures/listings.ts           three fixture listings, not domain types
  app/layout.tsx · globals.css
  app/page.tsx                   ③ browse (rebalancing §9.1) + bounded chat input (0004)
  app/api/discover/route.ts      ③ E8 v1 bounded parser (0004) — Gemini + keyword fallback
  app/unclaimed/page.tsx         ① E1
  app/agents/[id]/page.tsx       ②③ detail Layers 1–3 + 03 §9.3
  app/agents/[id]/preview/page.tsx  ③ E10 / 03 §9.4
  app/agents/[id]/hire/page.tsx     ④ E11 NOT WIRED
  app/compare/page.tsx              ③ E10 / 03 §9.2
  app/hires/[id]/page.tsx           ④ E12 / 03 §9.6
  app/methodology/page.tsx          ② E6 Layer 3

apps/console/src/
  fixtures/listings.ts
  app/page.tsx                   listing dashboard (E2/E14a)
  app/listings/page.tsx
  app/listings/[id]/page.tsx
  app/listings/[id]/claim/page.tsx     ① E2
  app/listings/[id]/sandbox/page.tsx   ② E3 trigger only
  app/listings/[id]/attest/page.tsx    ② E4 labeled open
  app/listings/[id]/config/page.tsx    ④ E11 editor shell, not enforced
  app/disputes/page.tsx                ④ E13 read-only
```

---

## Chunk 1 — design-system

- [x] Add `react` / `react-dom` (catalog) to `@repo/design-system`. Export `./tokens.css` and keep `./components`.
- [x] Tokens: ~~surveyor-blue on cool paper (`#e8edf2` / `#1c2430` / `#0b6e99` / `#b5472a`)~~ — **superseded 2026-08-29** by the shipped BNB dark/gold theme (`#0a0a0a` paper / `#f2f0ea` ink / `#f0b90b` gold), commits `3baf6a1`+`6dba26e`. The signature rule below is unchanged. IBM Plex Sans + Plex Mono. Signature: every `Stat` renders `value` + `window` chip; never a bare number. `window` is a required prop, not a convention.
- [x] Primitives listed above. `design-system` imports no service package.

## Chunk 2 — buyer marketplace (`apps/web`)

- [x] Depend on `@repo/design-system`. Fixture listings: one `DISCOVERED` (unclaimed), one `LIVE` Low with zero evidence, one `LIVE` Medium rebalancer with KPI windows. **Extended**: rebalancing carries three LIVE entries, not one — §9.2's comparability rule is a statement about the relationship between two agents, so one fixture cannot exercise it. `lst-rebal-02`/`03` share a pool and window (directly comparable); `lst-rebal-04` differs on both (caveat path) and carries a low-confidence score (the weak-but-populated third state of `05` §5.2).
- [x] Routes in the file map. Each page header shows `pipeline · engine · design-status`.
- [x] Empty evidence uses the distinct "No track record yet" state (`05` §5.2). Never render `0`.
- [x] Compare refuses mixed categories (query-layer: if ids span categories, show error, no table). Enforced in `lib/compare.ts` as a **return type** — the failure branch has no `listings` field, so no render path can assemble a mixed table. 7 tests.
- [x] Hire page: copy that E11 is not wired. No wallet button that pretends to sign. Gate-fail shows required vs. current tier side by side (`05` §5.3).
- [x] Active hire: visible Revoke button `disabled` with "Ring 3 not connected".

## Chunk 2a — bounded PEAGASIS chat, v1 only (Decision 0004)

- [x] Landing page (`app/page.tsx`): chat/search input **above** the existing category grid. Grid stays fully functional as a zero-typing fallback — chat never replaces it.
- [x] `app/api/discover/route.ts`: POST free text → Gemini (small/fast model) → E8 schema only (`category`, `risk_tolerance`, `budget_ceiling`, `min_trust_tier`, `capability_requirements`, `availability_required`, `free_text_original`). No other LLM output shape accepted.
- [x] `category` confidently resolved → run the same fixture-filter function the grid page calls (one function, two callers — chat and grid must never diverge). Show "Showing results for: {free_text_original}".
- [x] `category` ambiguous/missing → return exactly one clarifying question (templated, category-list style per the discovery-engine doc's example). Never a second round, never a guess.
- [x] Keyword→category fallback (no network) fires on any Gemini error/timeout/throttle — surface never errors or dead-ends from an LLM hiccup.
- [x] Zero matches after filtering → existing "no track record yet" empty state (`05` §5.2), never a bare 0.
- [x] New env var `GEMINI_API_KEY`. No new package beyond the Gemini SDK/fetch call; no client-side key exposure (server route only).
- [x] Explicitly not built here: chat-set ranking weights, semantic/vector retrieval, chat-driven hire/sign, persistent chat memory, voice, any Agent Studio content.

## Chunk 3 — builder console (`apps/console`)

- [x] Same design-system. Zero Ring 3 imports. Console constructs, never signs (`00` / decomposition surfaces note). Verified by `check:boundaries`.
- [x] Routes in the file map. Sandbox page is opt-in trigger copy, not a fork. Attest page states E4 is an open product call. Config page lists `commercial_config` fields as owner-declared, not session-enforced — inputs are `disabled` so a typed number cannot be mistaken for a guarantee.

## Chunk 4 — verify

- [x] `bun run check:boundaries` — 21 workspaces, 0 forbidden edges.
- [x] `bun run typecheck --filter=@app/web --filter=@app/console --filter=@repo/design-system` — clean. Also `bun run lint` clean, `bun test` 23/23, and both apps `next build` with every file-map route present.
- [x] Click through: unclaimed → claim (console) ; browse → detail → preview → hire (dead end) ; compare same-category ; compare mixed-category error ; active hire revoke disabled ; console sandbox / attest / config / disputes ; chat with clear category text → results match grid's own filter for that category ; chat with ambiguous text → one clarifying question, then results ; chat with `GEMINI_API_KEY` unset/broken → keyword fallback still resolves, no error page.

## Hard stops (build agent)

1. Do not import `@repo/custody` or `@repo/settlement`.
2. Do not write to `@repo/domain` or `@repo/database`.
3. Do not add Tailwind / Nest / a new app / a new package.
4. Do not implement ranking, scoring, `eth_getLogs`, or Anvil.
5. Do not treat unverified PEAGASIS **v2** docs as routes to build (conversation-set weights,
   semantic/vector retrieval). Bounded v1 chat is in scope per Decision 0004 / Chunk 2a.
6. If a screen needs a product decision (E4, E11 hire-card, zero-evidence floor), render the open question on the page — do not pick a default and hide it.


---

## Deviations from the file map, recorded rather than silently absorbed

1. **No `apps/web/src/app/globals.css`.** The file map lists it beside `layout.tsx`, but Chunk 1
   shipped `layout.tsx` importing `@repo/design-system/tokens.css` directly, and the reset lives in
   that file. An empty `globals.css` would be a second place for page-level CSS to accumulate,
   which is the thing having one design-system file was meant to prevent.
2. **No `packages/design-system/public/components.ts` re-export.** The package's `exports` map
   points `./components` straight at `components.tsx`, so the import path the map asked to preserve
   already works and the extra file would be a redirect to nowhere.
3. **Three additions to `@repo/design-system` beyond Chunk 1's list**: `ScoreMeter` (score and
   confidence rendered together, since `05` §5.2 forbids showing either alone and both apps need
   it), `OpenQuestion` (hard stop 6's "render the open question" made into a primitive, so it looks
   the same on all six screens carrying one), and a `ghost` variant plus a `title` on `Button`
   (every dead control in this scaffold owes the reader a reason).
4. **`apps/console/src/fixtures/listings.ts` duplicates shapes from the web app rather than sharing
   them.** Deliberate, per the plan's own "fixture shapes stay inside the apps" rule — and the two
   are genuinely different views (buyer sees measured results, owner sees outstanding work).
