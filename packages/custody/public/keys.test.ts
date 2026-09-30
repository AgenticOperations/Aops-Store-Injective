/**
 * Tests for `@repo/custody/keys` — boot-time env validation.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { loadCustodyKeys } from './keys'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('loadCustodyKeys', () => {
  test('defaults to bsc_testnet with mainnet broadcast disabled', () => {
    const keys = loadCustodyKeys({})
    expect(keys.network).toBe('bsc_testnet')
    expect(keys.allowMainnetBroadcast).toBe(false)
  })

  test('accepts explicit bsc_mainnet network', () => {
    const keys = loadCustodyKeys({ CUSTODY_NETWORK: 'bsc_mainnet' })
    expect(keys.network).toBe('bsc_mainnet')
  })

  test('parses CUSTODY_ALLOW_MAINNET_BROADCAST=true', () => {
    const keys = loadCustodyKeys({
      CUSTODY_NETWORK: 'bsc_mainnet',
      CUSTODY_ALLOW_MAINNET_BROADCAST: 'true',
    })
    expect(keys.allowMainnetBroadcast).toBe(true)
  })

  test('throws on invalid CUSTODY_NETWORK', () => {
    expect(() => loadCustodyKeys({ CUSTODY_NETWORK: 'ethereum' })).toThrow(
      '@repo/custody: invalid or missing environment variables',
    )
  })
})
