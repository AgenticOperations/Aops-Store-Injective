// packages/access/public/proof.test.ts
import { describe, expect, test } from 'bun:test'
import { verifyProofOfPossession } from './proof'

describe('verifyProofOfPossession — no bearer fallback', () => {
  test('missing proof header is PROOF_REQUIRED even when Authorization carries a token', async () => {
    const result = await verifyProofOfPossession({
      authorizationHeader:
        'AOPS-PoP aops_svc_tbsc_AAAAAAAAAAAAAAAAAAAA_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA_00000000',
      proofHeader: undefined,
      request: { method: 'POST', url: 'https://api.example.test/v1/jobs', body: '{}' },
      deploymentNet: 'tbsc',
      requiredTier: 'Standing',
      db: { query: { credentials: { findFirst: async () => null } } } as never,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.step).toBe('PROOF_REQUIRED')
  })

  test('empty proof header is PROOF_REQUIRED — bearer-only path does not exist', async () => {
    const result = await verifyProofOfPossession({
      authorizationHeader:
        'AOPS-PoP aops_svc_tbsc_AAAAAAAAAAAAAAAAAAAA_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA_00000000',
      proofHeader: '',
      request: { method: 'GET', url: 'https://api.example.test/v1/quote', body: '' },
      deploymentNet: 'tbsc',
      requiredTier: 'Standing',
      db: { query: { credentials: { findFirst: async () => null } } } as never,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.step).toBe('PROOF_REQUIRED')
  })
})
