/**
 * RING 1 · OBSERVATION — private vendor client
 * On-chain reads against the ERC-8004 Identity Registry via viem. Never imported outside this
 * package (`architecture/00` §3.2) — `public/registry.ts` is the only caller, and it is the
 * boundary that turns whatever comes back here into a validated, typed result before anything
 * downstream ever sees it (`00` §6.3).
 */
import { type PublicClient, type Transport, createPublicClient } from 'viem'
import { bsc } from 'viem/chains'
import { ERC721_OWNER_OF_ABI, IDENTITY_REGISTRY_ADDRESS, type SupportedChainId } from './constants'

/** Builds a viem client for the Identity Registry's chain. Callers supply the transport —
 * `http(rpcUrl)` in production (`rpcUrl` from `public/keys.ts`), a fixture `custom({ request })`
 * transport in tests. Factory, not a hidden default instance, because the transport is a
 * runtime value this package cannot know on its own (`00` §3.6). */
export function createIdentityRegistryClient(transport: Transport): PublicClient {
  return createPublicClient({ chain: bsc, transport })
}

/**
 * Raw on-chain `ownerOf` read. Returns `unknown` deliberately — this file does zero validation
 * of what comes back; `registry.ts`'s `getAgentOwner` is the only place that's allowed to
 * decide whether the result is well-formed (`00` §6.3's one-boundary invariant). Throws on any
 * RPC/contract failure (bad RPC URL, reverted call, malformed transport response that viem's
 * own ABI decoder rejects) — the public function is responsible for catching that, not this one.
 */
export async function readOwnerOf(
  client: PublicClient,
  chainId: SupportedChainId,
  tokenId: bigint,
): Promise<unknown> {
  return client.readContract({
    address: IDENTITY_REGISTRY_ADDRESS[chainId],
    abi: ERC721_OWNER_OF_ABI,
    functionName: 'ownerOf',
    args: [tokenId],
  })
}
