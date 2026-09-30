# Bounded PEAGASIS Chat (v1) — Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available)
> or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax
> for tracking. This plan implements **Chunk 2a** of
> `docs/build/2026-08-27-ui-scaffold-plan.md`, per Decision
> [`0004`](../../architecture/decisions/0004-bounded-peagasis-chat-in-scaffold.md). Read both
> before starting — they define what's in scope and, just as importantly, what isn't (v2
> conversation-set weights, semantic search, chat-driven hire/sign, voice, Agent Studio content
> — none of that belongs in this plan).

**Goal:** Add a bounded natural-language search box to `apps/web`'s landing page that parses
free text into a structured discovery query (via Gemini, with a deterministic keyword
fallback) and feeds it into the same category-filter function the plain category grid uses —
so typing and clicking always produce identical results, and the surface never dead-ends even
if the LLM call fails.

**Architecture:** A pure, fully-unit-tested core (`fixtures → filter → schema → keyword-parser
→ resolve-query`) that has zero network dependency and zero framework dependency, wrapped by
one thin Next.js route (`app/api/discover/route.ts`) that supplies the real Gemini call, and a
small set of client components that render the landing page. The core is where all the
judging-relevant logic lives; the route and components are glue.

**Tech Stack:** Next.js 15 App Router (already in `apps/web`), `zod` (already a workspace
catalog dependency — add it to `apps/web`'s own `package.json`, not a new package to the repo),
`bun test`, Gemini REST API via `fetch` (no SDK dependency needed).

---

## Before you start

- This repo is not generic — read `Aops-Store-BNB/CLAUDE.md` in full first. Hard stops that
  bind this plan: no `@repo/custody`/`@repo/settlement` imports, no `@repo/domain`/
  `@repo/database` writes, no new packages beyond what's listed above, no `console.log`
  (Biome errors on it — use nothing, or a comment, on the fallback path instead of logging).
- `apps/web/src` currently contains only `app/layout.tsx` and `app/page.tsx` (a one-line
  placeholder). This plan is greenfield within that app. It also builds the minimum viable
  category grid needed to host the chat results — full grid polish (pipeline/engine/status
  rail text, KPI stat blocks, etc.) is Chunk 2's job per the main scaffold plan; this plan
  builds only enough grid to prove the filter function and give the chat a home, using the
  same fixtures Chunk 2 would otherwise have to invent, so nothing here gets thrown away.
- Every fixture/type/function created here lives under `apps/web/src/` — nothing goes in
  `@repo/domain` (per the main plan's explicit rule, fixture shapes stay app-local until the
  shared Ring 0 package is agreed).
- Run `bun run check:boundaries` after Task 8 (and again at the end) — this plan adds no
  Ring 3 imports, but it's a cheap, fast check and the main plan requires it before any chunk
  is considered done.

---

## File Structure

```
apps/web/
  .env.example                          NEW — documents GEMINI_API_KEY / GEMINI_MODEL
  package.json                          MODIFY — add zod
  src/
    fixtures/
      listings.ts                       NEW — Listing type + 4 fixtures, one per category
    lib/discovery/
      schema.ts                         NEW — E8 structured-query zod schema + Category enum
      filter.ts                         NEW — pure deterministic filter (chat + grid share this)
      filter.test.ts                    NEW
      keyword-parser.ts                 NEW — no-network fallback parser
      keyword-parser.test.ts            NEW
      gemini-parser.ts                  NEW — Gemini REST call, returns parsed E8 query or null
      resolve-query.ts                  NEW — orchestrator: gemini → fallback → filter/clarify
      resolve-query.test.ts             NEW
    components/
      listing-card.tsx                  NEW — one fixture listing, presentational
      listing-grid.tsx                  NEW — grid of cards + EmptyState wiring
      discover-chat.tsx                 NEW — client component, the search box itself
    app/
      layout.tsx                        MODIFY — import design-system tokens.css
      page.tsx                          MODIFY — category grid + chat, wired to the same filter
      api/discover/route.ts             NEW — thin route, wires resolve-query to real Gemini call
```

**Why this split:** `lib/discovery/*` has no React, no Next.js, no network in `filter.ts` or
`keyword-parser.ts` — those two are pure functions over plain data, which is what makes them
unit-testable with fixed inputs the same way the discovery-engine doc requires (`E8`/`E9`
testability notes). `gemini-parser.ts` is the only file that touches the network, and
`resolve-query.ts` takes it as an injected function so tests never make a real HTTP call.

---

## Task 1: Fixture listings

**Files:**
- Create: `apps/web/src/fixtures/listings.ts`

- [ ] **Step 1: Write the file**

```typescript
// apps/web/src/fixtures/listings.ts

export type Category =
  | 'rebalancing'
  | 'grid-trading'
  | 'yield-optimization'
  | 'health-factor-monitoring'

export type ListingStatus =
  | 'DISCOVERED'
  | 'CLAIMED'
  | 'OWNERSHIP_VERIFIED'
  | 'ENDPOINT_VERIFIED'
  | 'LIVE'

export type TrustTier = 'Low' | 'Medium' | 'High'

export type Listing = {
  id: string
  name: string
  category: Category
  status: ListingStatus
  trustTier: TrustTier
  /** Owner-declared, per `commercial_config` — never session-enforced at this stage. */
  feeBps: number
  /** null = no evidence yet. Never render this as 0. */
  evidenceCount: number | null
  capabilities: string[]
  summary: string
}

/**
 * One listing per mandated category (rebalancing, grid trading, yield optimization,
 * health-factor monitoring) — the hackathon rubric scores equal depth across all four, so the
 * fixture set must never favor one category with more/richer entries than the others.
 * Statuses are deliberately spread across the DISCOVERED → LIVE ladder (`final-review-docs/01`
 * §4) so both the unclaimed-directory case and the zero-evidence / has-evidence LIVE cases are
 * all exercised by at least one fixture, per the main scaffold plan's Chunk 2 fixture spec.
 */
export const FIXTURE_LISTINGS: Listing[] = [
  {
    id: 'lst-rebal-01',
    name: 'PancakeSwap Range Rebalancer',
    category: 'rebalancing',
    status: 'DISCOVERED',
    trustTier: 'Low',
    feeBps: 0,
    evidenceCount: null,
    capabilities: ['PancakeSwap V3'],
    summary: 'Registered on-chain, not yet claimed by an operator.',
  },
  {
    id: 'lst-grid-01',
    name: 'BNB/USDT Grid Runner',
    category: 'grid-trading',
    status: 'LIVE',
    trustTier: 'Low',
    feeBps: 50,
    evidenceCount: null,
    capabilities: ['BNB/USDT', 'fixed-grid'],
    summary: 'Live at Low trust. No sandbox or execution evidence yet.',
  },
  {
    id: 'lst-yield-01',
    name: 'Venus Yield Router',
    category: 'yield-optimization',
    status: 'LIVE',
    trustTier: 'Medium',
    feeBps: 75,
    evidenceCount: 12,
    capabilities: ['Venus Protocol', 'multi-pool routing'],
    summary: 'Medium trust — passed the marketplace sandbox test, 12 evidence rows on file.',
  },
  {
    id: 'lst-health-01',
    name: 'Venus Sentinel',
    category: 'health-factor-monitoring',
    status: 'LIVE',
    trustTier: 'Medium',
    feeBps: 40,
    evidenceCount: 5,
    capabilities: ['Venus Protocol', 'auto-repay'],
    summary: 'Medium trust — 5 verified executions, zero liquidations on record.',
  },
]
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && bun run typecheck`
Expected: no errors (this file has no callers yet, so it just needs to compile standalone).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/fixtures/listings.ts
git commit -m "feat(web): add fixture listings covering all four categories"
```

---

## Task 2: E8 structured-query schema

**Files:**
- Create: `apps/web/src/lib/discovery/schema.ts`
- Modify: `apps/web/package.json` (add `zod`)

- [ ] **Step 1: Add zod to `apps/web/package.json`**

In the `dependencies` block, add (matching the existing catalog-reference style already used
by `packages/database`, `packages/agent-registry`, etc.):

```json
"zod": "catalog:"
```

Run: `bun install` (from repo root) to link it.

- [ ] **Step 2: Write the schema**

```typescript
// apps/web/src/lib/discovery/schema.ts
import { z } from 'zod'

/**
 * E8's bounded contract (discovery-engine-ryuk.md §4). This is the ONLY shape an LLM output is
 * ever trusted to have — nothing downstream re-parses free text, and nothing downstream ever
 * calls the LLM again.
 */
export const discoveryQuerySchema = z.object({
  category: z
    .enum(['rebalancing', 'grid-trading', 'yield-optimization', 'health-factor-monitoring'])
    .nullable(),
  risk_tolerance: z.enum(['low', 'medium', 'high']).nullable(),
  budget_ceiling: z.number().positive().nullable(),
  min_trust_tier: z.enum(['Low', 'Medium', 'High']).nullable(),
  capability_requirements: z.array(z.string()),
  availability_required: z.boolean(),
  free_text_original: z.string(),
})

export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>

/** Used whenever category can't be confidently resolved — one question, never a second round. */
export const CLARIFYING_QUESTION =
  'Which category is this for — rebalancing, grid trading, yield optimization, or health-factor monitoring?'
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/discovery/schema.ts bun.lock
git commit -m "feat(web): add E8 discovery query schema"
```

---

## Task 3: Deterministic filter (shared by chat and grid)

**Files:**
- Create: `apps/web/src/lib/discovery/filter.ts`
- Test: `apps/web/src/lib/discovery/filter.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/discovery/filter.test.ts
import { describe, expect, test } from 'bun:test'
import { FIXTURE_LISTINGS } from '../../fixtures/listings'
import { filterListings } from './filter'

describe('filterListings', () => {
  test('returns only listings in the requested category', () => {
    const results = filterListings(FIXTURE_LISTINGS, { category: 'yield-optimization' })
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('lst-yield-01')
  })

  test('excludes DISCOVERED (unclaimed) listings — not hireable yet', () => {
    const results = filterListings(FIXTURE_LISTINGS, { category: 'rebalancing' })
    expect(results).toHaveLength(0)
  })

  test('filters by minimum trust tier when provided', () => {
    const results = filterListings(FIXTURE_LISTINGS, {
      category: 'grid-trading',
      minTrustTier: 'Medium',
    })
    expect(results).toHaveLength(0) // lst-grid-01 is Low, below the Medium floor
  })

  test('filters by capability requirement substring match', () => {
    const results = filterListings(FIXTURE_LISTINGS, {
      category: 'health-factor-monitoring',
      capabilityRequirements: ['Venus Protocol'],
    })
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('lst-health-01')
  })

  test('returns empty array, not an error, on zero matches', () => {
    const results = filterListings(FIXTURE_LISTINGS, {
      category: 'grid-trading',
      capabilityRequirements: ['nonexistent-capability'],
    })
    expect(results).toEqual([])
  })

  test('same category input from chat or grid returns the same result set', () => {
    const a = filterListings(FIXTURE_LISTINGS, { category: 'yield-optimization' })
    const b = filterListings(FIXTURE_LISTINGS, { category: 'yield-optimization' })
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/lib/discovery/filter.test.ts`
Expected: FAIL — `filter.ts` does not exist yet (module not found).

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/lib/discovery/filter.ts
import type { Listing, TrustTier } from '../../fixtures/listings'
import type { DiscoveryQuery } from './schema'

const TRUST_RANK: Record<TrustTier, number> = { Low: 0, Medium: 1, High: 2 }

export type FilterInput = Partial<
  Pick<DiscoveryQuery, 'category' | 'capability_requirements'>
> & {
  category: DiscoveryQuery['category'] | NonNullable<DiscoveryQuery['category']>
  minTrustTier?: TrustTier
  capabilityRequirements?: string[]
}

/**
 * The single deterministic filter both the chat box and the plain category grid call. Never
 * ranks (that's E9, out of scope here) — only narrows LISTINGS to a candidate set, same as
 * E8's executor (discovery-engine-ryuk.md §4). Only LIVE listings are hireable; DISCOVERED
 * (unclaimed) listings surface on the separate `/unclaimed` directory, never here.
 */
export function filterListings(listings: Listing[], query: FilterInput): Listing[] {
  return listings.filter((listing) => {
    if (listing.status !== 'LIVE') return false
    if (listing.category !== query.category) return false
    if (query.minTrustTier && TRUST_RANK[listing.trustTier] < TRUST_RANK[query.minTrustTier]) {
      return false
    }
    if (query.capabilityRequirements?.length) {
      const hasAll = query.capabilityRequirements.every((req) =>
        listing.capabilities.some((cap) => cap.toLowerCase().includes(req.toLowerCase())),
      )
      if (!hasAll) return false
    }
    return true
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/lib/discovery/filter.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/discovery/filter.ts apps/web/src/lib/discovery/filter.test.ts
git commit -m "feat(web): add deterministic listing filter shared by chat and grid"
```

---

## Task 4: Keyword fallback parser (no network)

**Files:**
- Create: `apps/web/src/lib/discovery/keyword-parser.ts`
- Test: `apps/web/src/lib/discovery/keyword-parser.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/discovery/keyword-parser.test.ts
import { describe, expect, test } from 'bun:test'
import { parseByKeyword } from './keyword-parser'

describe('parseByKeyword', () => {
  test('matches health-factor-monitoring on liquidation language', () => {
    const result = parseByKeyword('protect my borrow position from getting wiped out')
    expect(result.category).toBe('health-factor-monitoring')
  })

  test('matches grid-trading on grid language', () => {
    const result = parseByKeyword('set up a grid on BNB/USDT')
    expect(result.category).toBe('grid-trading')
  })

  test('matches yield-optimization on yield/APR language', () => {
    const result = parseByKeyword('find me the best APR for my USDC')
    expect(result.category).toBe('yield-optimization')
  })

  test('matches rebalancing on LP/range language', () => {
    const result = parseByKeyword('rebalance my LP range automatically')
    expect(result.category).toBe('rebalancing')
  })

  test('returns null category on fully ambiguous text', () => {
    const result = parseByKeyword('make money on BNB')
    expect(result.category).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/lib/discovery/keyword-parser.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/lib/discovery/keyword-parser.ts
import type { Category } from '../../fixtures/listings'
import type { DiscoveryQuery } from './schema'

/**
 * No-network fallback. Fires whenever Gemini errors, times out, or the API key is missing —
 * the surface must never dead-end on an LLM hiccup during judging. Deliberately narrow: it only
 * ever resolves `category`, everything else stays null/empty, same as an under-specified LLM
 * result would. If it can't find a confident keyword hit, it returns `category: null` and the
 * caller asks the same one clarifying question the LLM path would ask — one fallback behavior,
 * not a second bespoke UX.
 */
const KEYWORD_MAP: Array<{ category: Category; keywords: string[] }> = [
  {
    category: 'health-factor-monitoring',
    keywords: ['liquidat', 'health factor', 'wiped out', 'borrow position', 'collateral'],
  },
  { category: 'grid-trading', keywords: ['grid'] },
  { category: 'yield-optimization', keywords: ['yield', 'apr', 'apy', 'route liquidity'] },
  { category: 'rebalancing', keywords: ['rebalanc', 'lp range', 'liquidity range', 'lp position'] },
]

export function parseByKeyword(freeText: string): Pick<DiscoveryQuery, 'category'> {
  const lower = freeText.toLowerCase()
  for (const entry of KEYWORD_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return { category: entry.category }
    }
  }
  return { category: null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/lib/discovery/keyword-parser.test.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/discovery/keyword-parser.ts apps/web/src/lib/discovery/keyword-parser.test.ts
git commit -m "feat(web): add no-network keyword fallback parser"
```

---

## Task 5: Gemini parser

**Files:**
- Create: `apps/web/src/lib/discovery/gemini-parser.ts`
- Create: `apps/web/.env.example`

- [ ] **Step 1: Write `.env.example`**

```bash
# apps/web/.env.example

# Required for the bounded chat parser (Decision 0004). Without this set, the surface still
# works — it silently falls back to the no-network keyword parser.
GEMINI_API_KEY=

# Optional. Defaults to a small/fast free-tier-eligible model if unset.
GEMINI_MODEL=gemini-2.0-flash
```

- [ ] **Step 2: Write the implementation**

No test-first here — this file's only job is an HTTP call to a real external API, which is
exactly what Task 6's `resolve-query.ts` is designed to keep out of the unit-tested core (it
takes this function as an injected dependency and fakes it in tests). This file gets exercised
for real in Task 7's manual verification instead.

```typescript
// apps/web/src/lib/discovery/gemini-parser.ts
import { discoveryQuerySchema, type DiscoveryQuery } from './schema'

const GEMINI_TIMEOUT_MS = 6000

const RESPONSE_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    category: {
      type: 'STRING',
      enum: ['rebalancing', 'grid-trading', 'yield-optimization', 'health-factor-monitoring', 'unknown'],
    },
    risk_tolerance: { type: 'STRING', enum: ['low', 'medium', 'high', 'unknown'] },
    budget_ceiling: { type: 'NUMBER' },
    min_trust_tier: { type: 'STRING', enum: ['Low', 'Medium', 'High', 'unknown'] },
    capability_requirements: { type: 'ARRAY', items: { type: 'STRING' } },
    availability_required: { type: 'BOOLEAN' },
  },
  required: ['category', 'capability_requirements', 'availability_required'],
}

const SYSTEM_PROMPT = `You extract a structured query from a buyer's free text about hiring an
on-chain trading agent. Only these four categories exist: rebalancing (LP range management),
grid-trading (automated grid orders), yield-optimization (routing liquidity to APR), and
health-factor-monitoring (protecting lending positions from liquidation). If the text does not
clearly and confidently map to exactly one category, set category to "unknown" — never guess.
Do not invent values for fields the text doesn't mention; use "unknown" / omit / false as
appropriate. Never include commentary, only the JSON object.`

/**
 * Returns a validated DiscoveryQuery, or null on any failure (bad key, timeout, malformed
 * output, schema mismatch) — callers must treat null exactly like "Gemini is unavailable" and
 * fall back to the keyword parser (Task 4). This function never throws.
 */
export async function parseWithGemini(freeText: string): Promise<DiscoveryQuery | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: freeText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_JSON_SCHEMA,
          },
        }),
      },
    )
    if (!response.ok) return null

    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null

    const raw = JSON.parse(text) as Record<string, unknown>
    const normalized = {
      category: raw.category === 'unknown' ? null : raw.category,
      risk_tolerance: raw.risk_tolerance === 'unknown' ? null : (raw.risk_tolerance ?? null),
      budget_ceiling: typeof raw.budget_ceiling === 'number' ? raw.budget_ceiling : null,
      min_trust_tier: raw.min_trust_tier === 'unknown' ? null : (raw.min_trust_tier ?? null),
      capability_requirements: raw.capability_requirements ?? [],
      availability_required: raw.availability_required ?? false,
      free_text_original: freeText,
    }

    const parsed = discoveryQuerySchema.safeParse(normalized)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/discovery/gemini-parser.ts apps/web/.env.example
git commit -m "feat(web): add Gemini-backed E8 parser, fails closed to null"
```

---

## Task 6: Orchestrator (`resolve-query.ts`) — the core the route wraps

**Files:**
- Create: `apps/web/src/lib/discovery/resolve-query.ts`
- Test: `apps/web/src/lib/discovery/resolve-query.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/discovery/resolve-query.test.ts
import { describe, expect, test } from 'bun:test'
import { FIXTURE_LISTINGS } from '../../fixtures/listings'
import { resolveDiscoveryQuery } from './resolve-query'
import type { DiscoveryQuery } from './schema'

const baseQuery = (overrides: Partial<DiscoveryQuery> = {}): DiscoveryQuery => ({
  category: null,
  risk_tolerance: null,
  budget_ceiling: null,
  min_trust_tier: null,
  capability_requirements: [],
  availability_required: false,
  free_text_original: '',
  ...overrides,
})

describe('resolveDiscoveryQuery', () => {
  test('confident Gemini category resolution returns matching listings', async () => {
    const result = await resolveDiscoveryQuery({
      freeText: 'find me the best yield route',
      listings: FIXTURE_LISTINGS,
      parseWithGemini: async () => baseQuery({ category: 'yield-optimization' }),
    })
    expect(result.kind).toBe('results')
    if (result.kind === 'results') {
      expect(result.listings).toHaveLength(1)
      expect(result.listings[0]?.id).toBe('lst-yield-01')
    }
  })

  test('ambiguous Gemini result returns exactly one clarifying question', async () => {
    const result = await resolveDiscoveryQuery({
      freeText: 'make money on BNB',
      listings: FIXTURE_LISTINGS,
      parseWithGemini: async () => baseQuery({ category: null }),
    })
    expect(result.kind).toBe('clarify')
  })

  test('Gemini failure falls back to keyword parser and still resolves', async () => {
    const result = await resolveDiscoveryQuery({
      freeText: 'set up a grid on BNB/USDT',
      listings: FIXTURE_LISTINGS,
      parseWithGemini: async () => null,
    })
    expect(result.kind).toBe('results')
    if (result.kind === 'results') {
      expect(result.listings[0]?.id).toBe('lst-grid-01')
    }
  })

  test('Gemini failure + ambiguous keyword text still returns a clarify, never an error', async () => {
    const result = await resolveDiscoveryQuery({
      freeText: 'make money on BNB',
      listings: FIXTURE_LISTINGS,
      parseWithGemini: async () => null,
    })
    expect(result.kind).toBe('clarify')
  })

  test('confident category with zero matches returns the empty-result kind, not an error', async () => {
    const result = await resolveDiscoveryQuery({
      freeText: 'rebalance my LP range',
      listings: FIXTURE_LISTINGS,
      parseWithGemini: async () => baseQuery({ category: 'rebalancing' }),
    })
    // rebalancing's only fixture is DISCOVERED, not LIVE — filterListings excludes it
    expect(result.kind).toBe('results')
    if (result.kind === 'results') expect(result.listings).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/lib/discovery/resolve-query.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/lib/discovery/resolve-query.ts
import type { Listing } from '../../fixtures/listings'
import { filterListings } from './filter'
import { parseByKeyword } from './keyword-parser'
import { CLARIFYING_QUESTION, type DiscoveryQuery } from './schema'

export type ResolveResult =
  | { kind: 'results'; listings: Listing[]; resolvedVia: 'gemini' | 'keyword'; freeText: string }
  | { kind: 'clarify'; question: string }

type ResolveInput = {
  freeText: string
  listings: Listing[]
  /** Injected so tests never make a real network call. Task 7 wires the real one in. */
  parseWithGemini: (freeText: string) => Promise<DiscoveryQuery | null>
}

/**
 * The one place chat's two failure modes (ambiguous category, Gemini unavailable) and its one
 * success path (confident category → same filter the grid uses) all meet. Nothing here calls
 * the network directly — that's `gemini-parser.ts`'s job, injected as a parameter precisely so
 * this function stays a pure orchestrator over its inputs and is fully unit-testable.
 */
export async function resolveDiscoveryQuery(input: ResolveInput): Promise<ResolveResult> {
  const geminiResult = await input.parseWithGemini(input.freeText)

  if (geminiResult?.category) {
    return {
      kind: 'results',
      listings: filterListings(input.listings, {
        category: geminiResult.category,
        minTrustTier: geminiResult.min_trust_tier ?? undefined,
        capabilityRequirements: geminiResult.capability_requirements,
      }),
      resolvedVia: 'gemini',
      freeText: input.freeText,
    }
  }

  // Gemini either failed outright (null) or came back genuinely ambiguous (category: null).
  // Either way, the fallback is the same keyword parser — one fallback behavior, not two.
  const keywordResult = parseByKeyword(input.freeText)
  if (keywordResult.category) {
    return {
      kind: 'results',
      listings: filterListings(input.listings, { category: keywordResult.category }),
      resolvedVia: 'keyword',
      freeText: input.freeText,
    }
  }

  return { kind: 'clarify', question: CLARIFYING_QUESTION }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/lib/discovery/resolve-query.test.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Run the full discovery test suite together**

Run: `cd apps/web && bun test src/lib/discovery`
Expected: PASS, all 16 tests across the three files green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/discovery/resolve-query.ts apps/web/src/lib/discovery/resolve-query.test.ts
git commit -m "feat(web): add discovery orchestrator tying gemini, keyword fallback, and filter together"
```

---

## Task 7: API route

**Files:**
- Create: `apps/web/src/app/api/discover/route.ts`

- [ ] **Step 1: Write the route**

This is intentionally the thinnest possible wrapper — all its logic already has unit-test
coverage from Task 6, so this file's only new responsibility is HTTP request/response shape.

```typescript
// apps/web/src/app/api/discover/route.ts
import { NextResponse } from 'next/server'
import { FIXTURE_LISTINGS } from '../../../fixtures/listings'
import { parseWithGemini } from '../../../lib/discovery/gemini-parser'
import { resolveDiscoveryQuery } from '../../../lib/discovery/resolve-query'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null
  const freeText = typeof body?.text === 'string' ? body.text.trim() : ''

  if (!freeText) {
    return NextResponse.json({ kind: 'clarify', question: 'What are you looking to do?' })
  }

  const result = await resolveDiscoveryQuery({
    freeText,
    listings: FIXTURE_LISTINGS,
    parseWithGemini,
  })

  return NextResponse.json(result)
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && bun run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual verification — keyword fallback path (no key set)**

```bash
cd apps/web && bun run dev
# in another shell:
curl -s -X POST http://localhost:3000/api/discover \
  -H 'Content-Type: application/json' \
  -d '{"text":"set up a grid on BNB/USDT"}' | head -c 500
```

Expected: JSON with `"kind":"results"` and a listing with `id":"lst-grid-01"`, resolved via
`"resolvedVia":"keyword"` — proves the surface works with zero API key configured, satisfying
the "never dead-ends" requirement without needing Gemini credentials to demo locally.

- [ ] **Step 4: Manual verification — clarify path**

```bash
curl -s -X POST http://localhost:3000/api/discover \
  -H 'Content-Type: application/json' \
  -d '{"text":"make money on BNB"}' | head -c 500
```

Expected: `{"kind":"clarify","question":"Which category is this for..."}`.

- [ ] **Step 5: Manual verification — Gemini path (if you have a key)**

Add a real key to `apps/web/.env.local` (gitignored — do not commit it), restart `bun run dev`,
then re-run Step 3's curl with a more oblique phrase, e.g. `"protect my Venus position from
getting wiped out"`. Expected: `"resolvedVia":"gemini"`, category resolved to
`health-factor-monitoring`, matching `lst-health-01`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/discover/route.ts
git commit -m "feat(web): add /api/discover route wiring resolve-query to the real Gemini call"
```

---

## Task 8: Landing page UI — chat box + category grid

**Files:**
- Create: `apps/web/src/components/listing-card.tsx`
- Create: `apps/web/src/components/listing-grid.tsx`
- Create: `apps/web/src/components/discover-chat.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/page.tsx`

- [x] **Step 1: `listing-card.tsx`**

```typescript
// apps/web/src/components/listing-card.tsx
import { Badge, Card, Stat } from '@repo/design-system/components'
import type { Listing } from '../fixtures/listings'

const TRUST_TONE = { Low: 'neutral', Medium: 'live', High: 'live' } as const

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong>{listing.name}</strong>
        <Badge tone={TRUST_TONE[listing.trustTier]}>{listing.trustTier} trust</Badge>
      </div>
      <p style={{ margin: 0, color: 'var(--ink-muted)' }}>{listing.summary}</p>
      {listing.evidenceCount === null ? (
        <Badge tone="warn">No track record yet</Badge>
      ) : (
        <Stat label="Evidence" value={String(listing.evidenceCount)} window="all-time" />
      )}
    </Card>
  )
}
```

- [x] **Step 2: `listing-grid.tsx`**

```typescript
// apps/web/src/components/listing-grid.tsx
import { EmptyState } from '@repo/design-system/components'
import type { Listing } from '../fixtures/listings'
import { ListingCard } from './listing-card'

export function ListingGrid({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return (
      <EmptyState
        title="No matching agents yet"
        body="No LIVE agent in this category matches your filters yet — this is a genuine
          absence, not a low score. Try a different category or check back as more agents come
          online."
      />
    )
  }
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  )
}
```

- [x] **Step 3: `discover-chat.tsx`**

```typescript
// apps/web/src/components/discover-chat.tsx
'use client'

import { Button } from '@repo/design-system/components'
import { useState } from 'react'
import type { Listing } from '../fixtures/listings'
import { ListingGrid } from './listing-grid'

type DiscoverResponse =
  | { kind: 'results'; listings: Listing[]; resolvedVia: 'gemini' | 'keyword'; freeText: string }
  | { kind: 'clarify'; question: string }

/**
 * Bounded chat surface (Decision 0004). This box is an alternate INPUT to the same filter the
 * category grid below it calls — it never replaces the grid, which stays visible and usable
 * whether or not this box is touched at all.
 */
export function DiscoverChat() {
  const [text, setText] = useState('')
  const [response, setResponse] = useState<DiscoverResponse | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = (await res.json()) as DiscoverResponse
      setResponse(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12, marginBottom: 32 }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. protect my Venus position from liquidation"
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid var(--rule)',
            borderRadius: 2,
            fontSize: 14,
          }}
        />
        <Button disabled={loading}>{loading ? 'Thinking…' : 'Find an agent'}</Button>
      </form>

      {response?.kind === 'clarify' && (
        <p style={{ margin: 0, color: 'var(--ink-muted)' }}>{response.question}</p>
      )}

      {response?.kind === 'results' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>
            Showing results for: "{response.freeText}"
          </p>
          <ListingGrid listings={response.listings} />
        </div>
      )}
    </div>
  )
}
```

- [x] **Step 4: Wire `layout.tsx` to the design-system tokens**

```typescript
// apps/web/src/app/layout.tsx
import '@repo/design-system/tokens.css'

export const metadata = { title: 'Aops Store' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [x] **Step 5: Rewrite `page.tsx`**

```typescript
// apps/web/src/app/page.tsx
import { Card, EngineRail, Shell } from '@repo/design-system/components'
import { DiscoverChat } from '../components/discover-chat'
import { ListingGrid } from '../components/listing-grid'
import { FIXTURE_LISTINGS } from '../fixtures/listings'
import { filterListings } from '../lib/discovery/filter'

const CATEGORIES = [
  { key: 'rebalancing', label: 'Rebalancing' },
  { key: 'grid-trading', label: 'Grid Trading' },
  { key: 'yield-optimization', label: 'Yield Optimisation' },
  { key: 'health-factor-monitoring', label: 'Health Factor Monitoring' },
] as const

export default function Page({
  searchParams,
}: {
  searchParams: { category?: string }
}) {
  const activeCategory = CATEGORIES.find((c) => c.key === searchParams.category)?.key

  return (
    <Shell product="Aops Store" nav={null}>
      <EngineRail pipeline="③ DEMAND" engine="E8/E9 (bounded v1)" status="scaffold" />
      <h1>Find an agent</h1>
      <DiscoverChat />

      <h2>Or browse by category</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {CATEGORIES.map((cat) => (
          <a key={cat.key} href={`/?category=${cat.key}`}>
            <Card>{cat.label}</Card>
          </a>
        ))}
      </div>

      <ListingGrid
        listings={
          activeCategory ? filterListings(FIXTURE_LISTINGS, { category: activeCategory }) : []
        }
      />
    </Shell>
  )
}
```

- [x] **Step 6: Typecheck**

Run: `cd apps/web && bun run typecheck`
Expected: no errors.

- [x] **Step 7: Manual browser click-through**

Run: `cd apps/web && bun run dev`, open `http://localhost:3000`.

> Verified headless (no browser available in this environment): `bun run dev` on an alternate
> port (3000 was occupied by an unrelated pre-existing process, left untouched) plus curl
> against `/api/discover` and HTML-inspection of `/`, `/?category=yield-optimization`, and
> `/?category=rebalancing`.

- [x] Type `"protect my borrow position from getting wiped out"` into the chat box, submit.
      Expect: results showing `Venus Sentinel` (health-factor-monitoring), via keyword fallback
      if no `GEMINI_API_KEY` is set.
      Verified via curl: `resolvedVia":"keyword"`, listing `lst-health-01` (Venus Sentinel).
- [x] Type `"make money on BNB"`, submit. Expect: the one clarifying question, no results, no
      error.
      Verified via curl: `{"kind":"clarify","question":"Which category is this for..."}`.
- [x] Ignore the chat entirely. Click the "Yield Optimisation" category card. Expect: the exact
      same `Venus Yield Router` listing the chat would have shown for an equivalent query —
      this is the "chat and grid are one function, two callers" property from Decision 0004,
      confirm it holds visually.
      Verified: HTML for `/?category=yield-optimization` contains `Venus Yield Router`; an
      equivalent chat query ("optimize my yield farming returns") returns the identical
      `lst-yield-01` listing from `/api/discover`.
- [x] Click "Rebalancing". Expect: the empty state ("No matching agents yet"), since the only
      rebalancing fixture is `DISCOVERED`, not `LIVE` — confirms zero-match never renders a
      bare 0 or a broken layout.
      Verified: HTML for `/?category=rebalancing` contains the `EmptyState` markup
      ("NO TRACK RECORD YET" / "No matching agents yet"), not the PancakeSwap Range Rebalancer
      card and not a bare `0`.

- [x] **Step 8: Commit**

```bash
git add apps/web/src/components apps/web/src/app/layout.tsx apps/web/src/app/page.tsx
git commit -m "feat(web): wire bounded chat + category grid into the landing page"
```

---

## Task 9: Boundary check and plan bookkeeping

**Files:**
- Modify: `docs/build/2026-08-27-ui-scaffold-plan.md` (tick Chunk 2a boxes)

- [ ] **Step 1: Run the repo-wide boundary check**

Run: `bun run check:boundaries` (from repo root)
Expected: passes — this plan added no `@repo/custody`, `@repo/settlement`, `@repo/domain`, or
`@repo/database` imports anywhere.

- [ ] **Step 2: Run every test in `apps/web` once more, together**

Run: `cd apps/web && bun test`
Expected: all tests across `filter.test.ts`, `keyword-parser.test.ts`, and
`resolve-query.test.ts` pass (16 tests).

- [ ] **Step 3: Tick the Chunk 2a checkboxes**

Open `docs/build/2026-08-27-ui-scaffold-plan.md`, mark every box under `## Chunk 2a` `- [x]`
now that each is verifiably true (chat input shipped, route shipped, shared filter function
confirmed shared, clarifying-question behavior confirmed, keyword fallback confirmed, empty
state confirmed, env var documented, out-of-scope items confirmed untouched).

- [ ] **Step 4: Commit**

```bash
git add docs/build/2026-08-27-ui-scaffold-plan.md
git commit -m "docs: tick Chunk 2a — bounded PEAGASIS chat shipped"
```

---

## What this plan deliberately does not do

Carried forward from Decision 0004 so nobody re-derives it mid-implementation: no chat-set
ranking weights, no semantic/vector retrieval, no chat-driven hire or signing (the hire page
stays "not wired" exactly as the main plan already states), no persistent chat history across
page loads, no voice input, and no Agent Studio content anywhere in `apps/web`. If a future
session is tempted to add any of these to this code, that's a v2/new-decision conversation, not
a bug in this plan.
