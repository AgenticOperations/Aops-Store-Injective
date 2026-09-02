/**
 * RING 1 · OBSERVATION — private
 * Vendor facts for the ERC-8004 registries on BNB Smart Chain. Confirmed live against chain by
 * prior research in this repo (not re-derived here — `docs/build/2026-09-02-v1-milestone-plan-
 * kc.md` Chunk 2a brief). Never imported outside this package (`architecture/00` §3.2 —
 * vendor names/addresses never appear in an import path outside their own `private/`).
 */

/** Only BSC mainnet is confirmed. A BSC testnet (chain 97) deployment of these two contracts
 * has NOT been confirmed by any doc in this repo as of this chunk — `docs/architecture/03-
 * evidence-trust-engine-pipeline.md`'s Provenance Addendum item 4 only confirms 8004scan's
 * *indexer* has a `bsc_testnet` (chain_id 97) entry, not that these two contracts are deployed
 * there. OPEN ITEM: get the testnet addresses confirmed and written into a doc before this map
 * grows a `97` entry — do not guess one here. */
export const BSC_MAINNET_CHAIN_ID = 56 as const
export type SupportedChainId = typeof BSC_MAINNET_CHAIN_ID

export const IDENTITY_REGISTRY_ADDRESS: Record<SupportedChainId, `0x${string}`> = {
  [BSC_MAINNET_CHAIN_ID]: '0xfA09B3397fAC75424422C4D28b1729E3D4f659D7',
}

/** Kept here for when a chunk is ready to wire real reads against it — no read function in this
 * chunk calls this contract yet, because its ABI (which read exposes "reputation") is not
 * confirmed by any cited doc. Per `CLAUDE.md`'s "no vendor invention" hard stop, the address is
 * recorded but not called. See `public/registry.ts`'s `getAgentRegistrySnapshot` doc comment. */
export const REPUTATION_REGISTRY_ADDRESS: Record<SupportedChainId, `0x${string}`> = {
  [BSC_MAINNET_CHAIN_ID]: '0x17860530385Bdde7992c4Da71B9ec7791E474C08',
}

/** Standard ERC-721 `ownerOf` — the Identity Registry is confirmed to expose "the actual
 * ERC-721 owner of record" (`final-review-docs/01-ingestion-and-registration-of-agents.md`
 * §4.1). Minimal ABI fragment, read-only, nothing invented beyond the ERC-721 standard. */
export const ERC721_OWNER_OF_ABI = [
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

/** Confirmed base URL — `docs/architecture/03-evidence-trust-engine-pipeline.md`'s Provenance
 * Addendum item 4, live-called against `GET {base}/chains`. */
export const SCAN_8004_BASE_URL = 'https://8004scan.io/api/v1/public'
