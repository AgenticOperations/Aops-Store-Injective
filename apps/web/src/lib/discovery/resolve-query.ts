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
        capabilityRequirements: geminiResult.capability_requirements,
        // `exactOptionalPropertyTypes` forbids an explicit `undefined` — omit the key entirely
        // when Gemini didn't specify a trust floor rather than setting it to undefined.
        ...(geminiResult.min_trust_tier ? { minTrustTier: geminiResult.min_trust_tier } : {}),
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
