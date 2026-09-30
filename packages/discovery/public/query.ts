/**
 * RING 2 · OWNED STATE — our database
 * `@repo/discovery/query` — public contract. Named exports only.
 *
 * Structured query → candidate retrieval. Deterministic.
 */

export { filterCandidates, type FilterInput } from '#private/filter'
export { parseByKeyword } from '#private/keyword-parser'
export { resolveDiscoveryQuery, type ResolveResult } from '#private/resolve-query'
export { assertSameCategory, type CompareValidationResult } from '#private/compare'
export {
  discoveryQuerySchema,
  CLARIFYING_QUESTION,
  type DiscoveryQuery,
} from './schema'
export type {
  DiscoveryCandidate,
  RankFactor,
  RankWeights,
  RankFactorBreakdown,
  RankedCandidate,
} from './types'
export { DISCOVERY_METHODOLOGY_VERSION } from './types'
