/**
 * Tests for `@repo/custody/sessions` — grant → execute → revoke cycle and Ring 3 guards.
 */
import { describe, expect, test } from 'bun:test'
import type { Address, Hex } from 'viem'
import { createFixtureAltanaClient } from '#private/altana-client'
import { execute, grantSession, readKeystoreEntry, revokeSession } from './sessions'

const WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address
const VENUS = '0x00000000000000000000000000000000000000a1' as Address
const USDT = '0x00000000000000000000000000000000000000b1' as Address
const TESTNET_KEYS = { network: 'bsc_testnet' as const, allowMainnetBroadcast: false }
const MAINNET_KEYS = { network: 'bsc_mainnet' as const, allowMainnetBroadcast: false }
const MAINNET_ALLOWED_KEYS = { network: 'bsc_mainnet' as const, allowMainnetBroadcast: true }

describe('custody sessions — simulate mode (default)', () => {
  test('full grant → execute → revoke cycle without broadcasting', async () => {
    const client = createFixtureAltanaClient()
    const expiry = new Date(Date.now() + 86_400_000)

    const granted = await grantSession({
      client,
      allowedCalls: [VENUS],
      spend: [{ limit: 50n, period: 'day', token: USDT }],
      expiry,
      authorizedWallet: WALLET,
    })

    expect(granted.ok).toBe(true)
    if (!granted.ok) return
    expect(granted.data.mode).toBe('simulate')
    expect(granted.data.txHash).toBeUndefined()

    const keystore = await readKeystoreEntry({
      client,
      sessionId: granted.data.sessionId,
    })
    expect(keystore.ok).toBe(true)
    if (!keystore.ok || !keystore.data) return
    expect(keystore.data.state).toBe('valid')
    expect(keystore.data.authorizedWallet.toLowerCase()).toBe(WALLET.toLowerCase())

    const executed = await execute({
      client,
      sessionId: granted.data.sessionId,
      target: VENUS,
      calldata: '0xdeadbeef' as Hex,
    })
    expect(executed.ok).toBe(true)
    if (!executed.ok) return
    expect(executed.data.mode).toBe('simulate')
    expect(executed.data.txHash).toBeUndefined()

    const revoked = await revokeSession({
      client,
      sessionId: granted.data.sessionId,
    })
    expect(revoked.ok).toBe(true)
    if (!revoked.ok) return
    expect(revoked.data.mode).toBe('simulate')

    const afterRevoke = await readKeystoreEntry({
      client,
      sessionId: granted.data.sessionId,
    })
    expect(afterRevoke.ok).toBe(true)
    if (!afterRevoke.ok || !afterRevoke.data) return
    expect(afterRevoke.data.state).toBe('revoked')
  })

  test('omitted mode defaults to simulate', async () => {
    const client = createFixtureAltanaClient()
    const granted = await grantSession({
      client,
      allowedCalls: [VENUS],
      spend: [{ limit: 1n, period: 'hour', token: USDT }],
      expiry: new Date(Date.now() + 3_600_000),
      authorizedWallet: WALLET,
    })
    expect(granted.ok).toBe(true)
    if (!granted.ok) return
    expect(granted.data.mode).toBe('simulate')
  })
})

describe('custody sessions — broadcast guards', () => {
  test('broadcast without assertNetwork is rejected', async () => {
    const client = createFixtureAltanaClient()
    const result = await grantSession({
      client,
      allowedCalls: [VENUS],
      spend: [{ limit: 1n, period: 'day', token: USDT }],
      expiry: new Date(Date.now() + 86_400_000),
      authorizedWallet: WALLET,
      mode: 'broadcast',
      keys: TESTNET_KEYS,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('BROADCAST_REQUIRES_NETWORK_ASSERTION')
  })

  test('mainnet broadcast blocked without CUSTODY_ALLOW_MAINNET_BROADCAST', async () => {
    const client = createFixtureAltanaClient()
    const result = await grantSession({
      client,
      allowedCalls: [VENUS],
      spend: [{ limit: 1n, period: 'day', token: USDT }],
      expiry: new Date(Date.now() + 86_400_000),
      authorizedWallet: WALLET,
      mode: 'broadcast',
      assertNetwork: 'bsc_mainnet',
      keys: MAINNET_KEYS,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('MAINNET_BROADCAST_BLOCKED')
  })

  test('testnet broadcast succeeds with matching assertNetwork', async () => {
    const client = createFixtureAltanaClient()
    const result = await grantSession({
      client,
      allowedCalls: [VENUS],
      spend: [{ limit: 1n, period: 'day', token: USDT }],
      expiry: new Date(Date.now() + 86_400_000),
      authorizedWallet: WALLET,
      mode: 'broadcast',
      assertNetwork: 'bsc_testnet',
      keys: TESTNET_KEYS,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.mode).toBe('broadcast')
    expect(result.data.txHash).toBeDefined()
  })

  test('mainnet broadcast allowed when env flag is set', async () => {
    const client = createFixtureAltanaClient()
    const result = await grantSession({
      client,
      allowedCalls: [VENUS],
      spend: [{ limit: 1n, period: 'day', token: USDT }],
      expiry: new Date(Date.now() + 86_400_000),
      authorizedWallet: WALLET,
      mode: 'broadcast',
      assertNetwork: 'bsc_mainnet',
      keys: MAINNET_ALLOWED_KEYS,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.mode).toBe('broadcast')
  })

  test('execute rejects disallowed target', async () => {
    const client = createFixtureAltanaClient()
    const granted = await grantSession({
      client,
      allowedCalls: [VENUS],
      spend: [{ limit: 1n, period: 'day', token: USDT }],
      expiry: new Date(Date.now() + 86_400_000),
      authorizedWallet: WALLET,
    })
    expect(granted.ok).toBe(true)
    if (!granted.ok) return

    const blocked = '0x00000000000000000000000000000000000000ff' as Address
    const result = await execute({
      client,
      sessionId: granted.data.sessionId,
      target: blocked,
      calldata: '0x' as Hex,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('EXECUTE_REVERTED')
  })
})

describe('vendor facts', () => {
  test('open items are flagged, not marked confirmed', async () => {
    const { ALTANA_VENDOR_FACTS } = await import('./vendor-facts')
    expect(ALTANA_VENDOR_FACTS.PER_PERIOD_CAP_ATOMICITY.status).toBe('open')
    expect(ALTANA_VENDOR_FACTS.SESSION_KEY_ROTATION.status).toBe('open')
    expect(ALTANA_VENDOR_FACTS.SPEND_CAP_REFILLS_PER_PERIOD.status).toBe('resolved')
  })
})
