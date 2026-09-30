/**
 * RING 1 · OBSERVATION — read-only, output is a cache
 * `@repo/agent-registry/registry` — public contract. Named exports only.
 *
 * Who exists, who owns what, what they claim. Reads the ERC-8004 Identity Registry (on-chain,
 * via viem) and 8004scan (off-chain indexer, HTTP) for a single agent at a time — claim/detail
 * lookups only. This is not a crawler: no delta-poll, no scheduling, no population-scale scan.
 * That's `E1`'s ingestion job, explicitly cut from v1 (`docs/build/2026-09-02-v1-milestone-
 * plan-kc.md` §5, Chunk 2a).
 *
 * Every response from either vendor is untyped, adversarial input until it has crossed a zod
 * (or equivalent) validation check in this file — `architecture/00` §6.3's invariant: `census`
 * and `agent-registry` are the only two packages that touch arbitrary third-party input, so
 * nothing either produces may reach `domain`/`listings` without crossing that boundary here.
 * `private/` holds the vendor clients; this file never re-exports a vendor name.
 */
import { type Address, type PublicClient, getAddress, isAddress } from 'viem'
import { z } from 'zod'
import { BSC_MAINNET_CHAIN_ID, type SupportedChainId } from '#private/constants'
import { createIdentityRegistryClient, readOwnerOf } from '#private/identity-registry-client'
import { type Scan8004Deps, type Scan8004Result, scan8004Get } from '#private/scan-8004-client'

export type { SupportedChainId }
export { BSC_MAINNET_CHAIN_ID }
/** Re-exported factory — `private/` is unreachable from outside this package by module
 * resolution (`00` §3.1), so callers that need a real client build one through this entry. */
export { createIdentityRegistryClient }

// -------------------------------------------------------------------------------------------
// Shared result shape — every read in this file returns one of these, never a thrown vendor
// error and never raw vendor JSON. `ok: false` is data, not an exceptional path a caller can
// forget to handle.
// -------------------------------------------------------------------------------------------

export interface RegistryError {
  code: 'NOT_FOUND' | 'INVALID_RESPONSE' | 'RPC_ERROR'
  message: string
}

export type RegistryResult<T> = { ok: true; data: T } | { ok: false; error: RegistryError }

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// -------------------------------------------------------------------------------------------
// Owner-of-record — `final-review-docs/01` §4.1/§4.2: the guard that turns CLAIMED into
// OWNERSHIP_VERIFIED. `domain`'s `verifyClaimSignature` (Ring 0, pure, no I/O) takes
// `onChainOwner` as a parameter it does not fetch itself — this is where it comes from.
// -------------------------------------------------------------------------------------------

/**
 * Reads the ERC-8004 Identity Registry's owner-of-record for a given on-chain agent (its
 * ERC-721 `tokenId` — `domain`'s `Listing.erc8004Ref.tokenId`). `client` is caller-supplied
 * (production: `createIdentityRegistryClient(http(rpcUrl))` with `rpcUrl` from `keys.ts`;
 * tests: a fixture `custom({ request })` transport) so this function never touches
 * `process.env` and never hits the real network on its own.
 */
export async function getAgentOwner(params: {
  client: PublicClient
  tokenId: bigint
  chainId?: SupportedChainId
}): Promise<RegistryResult<Address>> {
  const chainId = params.chainId ?? BSC_MAINNET_CHAIN_ID

  let raw: unknown
  try {
    raw = await readOwnerOf(params.client, chainId, params.tokenId)
  } catch (err) {
    return {
      ok: false,
      error: { code: 'RPC_ERROR', message: err instanceof Error ? err.message : String(err) },
    }
  }

  const parsed = z.string().safeParse(raw)
  if (!parsed.success || !isAddress(parsed.data)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: 'Identity Registry did not return a well-formed address',
      },
    }
  }

  const owner = getAddress(parsed.data)
  if (owner.toLowerCase() === ZERO_ADDRESS) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: `token ${params.tokenId} has no owner of record` },
    }
  }

  return { ok: true, data: owner }
}

// -------------------------------------------------------------------------------------------
// 8004scan — the one endpoint confirmed live in this repo's docs. Kept here to prove the HTTP
// client's parsing and rate-limit handling; neither checklist item in Chunk 2a requires it.
// -------------------------------------------------------------------------------------------

const Scan8004ChainSchema = z.object({
  chain_key: z.string(),
  chain_id: z.number(),
  name: z.string(),
  is_testnet: z.boolean(),
  enabled: z.boolean(),
  provider_status: z.string(),
})

export type Scan8004Chain = z.infer<typeof Scan8004ChainSchema>

/**
 * `GET /chains` — confirmed live (`architecture/03` Provenance item 4). The response is assumed
 * to be a JSON array of chain objects (the endpoint name is plural; the doc's confirmed
 * live-call excerpt shows one element, not the enclosing structure) — treat that shape as
 * best-effort until independently reverified, same as any other 8004scan detail this repo
 * hasn't pinned down byte-for-byte.
 */
export async function getScan8004SupportedChains(
  deps: Scan8004Deps = {},
): Promise<Scan8004Result<Scan8004Chain[]>> {
  return scan8004Get('/chains', (raw) => z.array(Scan8004ChainSchema).min(1).parse(raw), deps)
}

// -------------------------------------------------------------------------------------------
// Registry/reputation snapshot — `architecture/05` §5.2's Layer 1/2 trust UI.
// -------------------------------------------------------------------------------------------

export interface AgentRegistrySnapshot {
  owner: RegistryResult<Address>
  /** OPEN ITEM, not built this chunk: see the doc comment on `getAgentRegistrySnapshot` below.
   * This is the same "tagged, never fabricated" discipline `scoring`'s zero-evidence rule
   * already established in this repo (milestone plan Chunk 1) — an unavailable reputation
   * signal must never render, or be computed, as if it were a real (e.g. zero) value. */
  reputation: { status: 'unavailable'; reason: string }
}

/**
 * Registry/reputation metadata for a `LIVE` listing's Layer 1/2 trust UI (`architecture/05`
 * §5.2). Ships the on-chain owner-of-record (same read as `getAgentOwner`, confirmed and
 * correctness-critical).
 *
 * Does **not** ship a reputation number this chunk. Two vendor facts it would need are both
 * unconfirmed by any doc this chunk is allowed to cite:
 *   1. 8004scan's per-agent endpoint path/response schema (only `GET /chains` is confirmed).
 *   2. The ERC-8004 Reputation Registry contract's ABI (its address is recorded in
 *      `private/constants.ts` for when this is confirmed, but no read function calls it).
 * Per `CLAUDE.md`'s "no vendor invention" hard stop, this returns an explicit unavailable state
 * rather than a guessed call that could silently show a wrong number on a trust surface.
 */
export async function getAgentRegistrySnapshot(params: {
  client: PublicClient
  tokenId: bigint
  chainId?: SupportedChainId
}): Promise<AgentRegistrySnapshot> {
  const owner = await getAgentOwner(params)
  return {
    owner,
    reputation: {
      status: 'unavailable',
      reason:
        '8004scan per-agent reputation endpoint and the ERC-8004 Reputation Registry ABI are ' +
        'both unconfirmed vendor facts as of Chunk 2a — flagged for KC, not guessed.',
    },
  }
}
