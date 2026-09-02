// packages/domain/public/guards.test.ts
import { describe, expect, test } from 'bun:test'
import { privateKeyToAccount } from 'viem/accounts'
import {
  accessTierSatisfies,
  computeAccessTier,
  passesHiringGate,
  verifyClaimSignature,
} from './guards'

// Freshly generated throwaway keys, fixed as string literals for deterministic fixtures — no
// real funds, never used outside this test.
const SIGNER_PRIVATE_KEY =
  '0xead08b3eb71273915a50506c312fc1d8411661e8bb592eaaff46dacb7a1b6a04' as const
const OTHER_PRIVATE_KEY =
  '0x2cf0e07e90d36199d7d5d01c6ad76479aebc3a4343d419eb5c23b2a50f0194a1' as const

const domain = { name: 'AgentOps Marketplace', version: '1', chainId: 97 } as const
const types = {
  Claim: [
    { name: 'intent', type: 'string' },
    { name: 'agentId', type: 'string' },
    { name: 'wallet', type: 'address' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

const NONCE = `0x${'00'.repeat(32)}` as const

describe('verifyClaimSignature', () => {
  test('recovers the signer and matches when the signature is genuinely valid', async () => {
    const account = privateKeyToAccount(SIGNER_PRIVATE_KEY)
    const message = { intent: 'claim', agentId: 'agent-001', wallet: account.address, nonce: NONCE }
    const signature = await account.signTypedData({ domain, types, primaryType: 'Claim', message })

    const result = await verifyClaimSignature({
      domain,
      types,
      primaryType: 'Claim',
      message,
      signature,
      onChainOwner: account.address,
    })
    expect(result).toBe(true)
  })

  test('fails when the recovered signer does not match the claimed on-chain owner', async () => {
    const signer = privateKeyToAccount(SIGNER_PRIVATE_KEY)
    const someoneElse = privateKeyToAccount(OTHER_PRIVATE_KEY)
    const message = { intent: 'claim', agentId: 'agent-001', wallet: signer.address, nonce: NONCE }
    const signature = await signer.signTypedData({ domain, types, primaryType: 'Claim', message })

    const result = await verifyClaimSignature({
      domain,
      types,
      primaryType: 'Claim',
      message,
      signature,
      onChainOwner: someoneElse.address,
    })
    expect(result).toBe(false)
  })

  test('fails when the signed payload is tampered with after signing', async () => {
    const account = privateKeyToAccount(SIGNER_PRIVATE_KEY)
    const signedMessage = {
      intent: 'claim',
      agentId: 'agent-001',
      wallet: account.address,
      nonce: NONCE,
    }
    const signature = await account.signTypedData({
      domain,
      types,
      primaryType: 'Claim',
      message: signedMessage,
    })

    const tamperedMessage = { ...signedMessage, agentId: 'agent-002' }
    const result = await verifyClaimSignature({
      domain,
      types,
      primaryType: 'Claim',
      message: tamperedMessage,
      signature,
      onChainOwner: account.address,
    })
    expect(result).toBe(false)
  })
})

describe('computeAccessTier', () => {
  test('an unenrolled caller (no Account) is Public', () => {
    expect(computeAccessTier({ accountStatus: null, hasLiveBoundSessionCoveringCall: false })).toBe(
      'Public',
    )
  })

  test('a SUSPENDED account is Public even with a live session', () => {
    expect(
      computeAccessTier({ accountStatus: 'SUSPENDED', hasLiveBoundSessionCoveringCall: true }),
    ).toBe('Public')
  })

  test('any enrolled, non-suspended account without a live session is Standing', () => {
    for (const status of ['UNFUNDED', 'FUNDED', 'RESTRICTED'] as const) {
      expect(
        computeAccessTier({ accountStatus: status, hasLiveBoundSessionCoveringCall: false }),
      ).toBe('Standing')
    }
  })

  test('a live bound session covering the call upgrades to Fresh', () => {
    expect(
      computeAccessTier({ accountStatus: 'FUNDED', hasLiveBoundSessionCoveringCall: true }),
    ).toBe('Fresh')
  })
})

describe('accessTierSatisfies', () => {
  test('Fresh satisfies every requirement', () => {
    expect(accessTierSatisfies('Fresh', 'Public')).toBe(true)
    expect(accessTierSatisfies('Fresh', 'Standing')).toBe(true)
    expect(accessTierSatisfies('Fresh', 'Fresh')).toBe(true)
  })

  test('Standing does not satisfy a Fresh requirement', () => {
    expect(accessTierSatisfies('Standing', 'Fresh')).toBe(false)
  })

  test('Public does not satisfy Standing or Fresh', () => {
    expect(accessTierSatisfies('Public', 'Standing')).toBe(false)
    expect(accessTierSatisfies('Public', 'Fresh')).toBe(false)
  })
})

describe('passesHiringGate', () => {
  test('a listing that has never reached LIVE (null trust tier) never passes', () => {
    expect(passesHiringGate({ listingTrustTier: null, buyerMinimumTrustTier: 'Low' })).toBe(false)
  })

  test('a Low-trust listing passes a Low-minimum buyer', () => {
    expect(passesHiringGate({ listingTrustTier: 'Low', buyerMinimumTrustTier: 'Low' })).toBe(true)
  })

  test('a Low-trust listing fails a Medium-minimum buyer', () => {
    expect(passesHiringGate({ listingTrustTier: 'Low', buyerMinimumTrustTier: 'Medium' })).toBe(
      false,
    )
  })

  test('a High-trust listing passes every buyer minimum', () => {
    for (const buyerMinimumTrustTier of ['Low', 'Medium', 'High'] as const) {
      expect(passesHiringGate({ listingTrustTier: 'High', buyerMinimumTrustTier })).toBe(true)
    }
  })
})
