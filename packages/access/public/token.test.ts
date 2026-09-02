// packages/access/public/token.test.ts
import { describe, expect, test } from 'bun:test'
import { hashSecret, mintCredentialToken, parseToken } from './token'

describe('mintCredentialToken / parseToken', () => {
  test('round-trips tier, net, kid, secret, and crc', async () => {
    const minted = await mintCredentialToken({ tier: 'svc', net: 'tbsc' })
    expect(minted.token.startsWith('aops_svc_tbsc_')).toBe(true)

    const parsed = parseToken(minted.token)
    expect('error' in parsed).toBe(false)
    if ('error' in parsed) return

    expect(parsed.tier).toBe('svc')
    expect(parsed.net).toBe('tbsc')
    expect(parsed.kid).toBe(minted.kid)
    expect(parsed.secret).toBe(minted.secret)

    const digest = await hashSecret(minted.secret)
    expect(digest).toBe(minted.secretHash)
    expect(digest).toHaveLength(64)
  })

  test('detects crc tampering', async () => {
    const minted = await mintCredentialToken({ tier: 'dlg', net: 'bsc' })
    const parsed = parseToken(minted.token)
    expect('error' in parsed).toBe(false)
    if ('error' in parsed) return

    const tamperedSecret = `${parsed.secret.slice(0, -1)}X`
    const tampered = minted.token.replace(parsed.secret, tamperedSecret)
    const tamperedParsed = parseToken(tampered)
    expect('error' in tamperedParsed).toBe(true)
    if ('error' in tamperedParsed) expect(tamperedParsed.error).toBe('CRC_MISMATCH')
  })
})
