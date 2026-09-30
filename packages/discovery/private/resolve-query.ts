import { CLARIFYING_QUESTION, type DiscoveryQuery } from '../public/schema'
import type { DiscoveryCandidate } from '../public/types'
import { filterCandidates } from './filter'
import { parseByKeyword } from './keyword-parser'

export type ResolveResult =
  | {
      kind: 'results'
      candidates: DiscoveryCandidate[]
      resolvedVia: 'gemini' | 'keyword'
      freeText: string
    }
  | { kind: 'clarify'; question: string }

type ResolveInput = {
  freeText: string
  candidates: DiscoveryCandidate[]
  /** Injected so tests never make a real network call. */
  parseWithGemini: (freeText: string) => Promise<DiscoveryQuery | null>
}

/**
 * The one place chat's two failure modes (ambiguous category, Gemini unavailable) and its one
 * success path (confident category → same filter the grid uses) all meet.
 */
export async function resolveDiscoveryQuery(input: ResolveInput): Promise<ResolveResult> {
  const geminiResult = await input.parseWithGemini(input.freeText)

  if (geminiResult?.category) {
    return {
      kind: 'results',
      candidates: filterCandidates(input.candidates, {
        category: geminiResult.category,
        capabilityRequirements: geminiResult.capability_requirements,
        ...(geminiResult.min_trust_tier ? { minTrustTier: geminiResult.min_trust_tier } : {}),
      }),
      resolvedVia: 'gemini',
      freeText: input.freeText,
    }
  }

  const keywordResult = parseByKeyword(input.freeText)
  if (keywordResult.category) {
    return {
      kind: 'results',
      candidates: filterCandidates(input.candidates, { category: keywordResult.category }),
      resolvedVia: 'keyword',
      freeText: input.freeText,
    }
  }

  return { kind: 'clarify', question: CLARIFYING_QUESTION }
}
