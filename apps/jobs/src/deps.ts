/**
 * Production dependency wiring for `@repo/listings/lifecycle`.
 */

import { loadAgentRegistryKeys } from '@repo/agent-registry/keys'
import {
  type SupportedChainId,
  getAgentOwner as readAgentOwner,
  createIdentityRegistryClient,
} from '@repo/agent-registry/registry'
import { probeEndpoint } from '@repo/census/probe'
import type { DbClient } from '@repo/database/client'
import type { ListingLifecycleDeps } from '@repo/listings/lifecycle'
import { http } from 'viem'

export function createListingLifecycleDeps(db: DbClient): ListingLifecycleDeps {
  const { bscRpcUrl } = loadAgentRegistryKeys()
  const client = createIdentityRegistryClient(http(bscRpcUrl))
  return {
    db,
    probeEndpoint,
    getAgentOwner: (params) =>
      readAgentOwner({
        client,
        tokenId: params.tokenId,
        ...(params.chainId !== undefined
          ? { chainId: params.chainId as SupportedChainId }
          : {}),
      }),
  }
}

/** Fixture stub — tests inject their own owner/probe fakes. */
export function createStubListingLifecycleDeps(db: DbClient): ListingLifecycleDeps {
  return {
    db,
    probeEndpoint: async (url) => ({
      live: true,
      url,
      httpStatus: 200,
      latencyMs: 1,
      checkedAt: new Date().toISOString(),
    }),
    getAgentOwner: async () => ({
      ok: false,
      error: { code: 'RPC_ERROR', message: 'getAgentOwner stub — inject in tests' },
    }),
  }
}
