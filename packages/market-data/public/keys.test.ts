import { describe, expect, test } from 'bun:test'
import { createMarketDataClient, getMarketDataEnv } from './keys'

describe('getMarketDataEnv / createMarketDataClient', () => {
  // Must run before any successful call in this file — `getMarketDataEnv` only memoizes on
  // success, so a thrown attempt never poisons a later, valid one.
  test('a malformed RPC URL override fails loudly, not silently at the first eth_call', () => {
    process.env.BSC_MAINNET_RPC_URL = 'not-a-url'
    expect(() => getMarketDataEnv()).toThrow()
    process.env.BSC_MAINNET_RPC_URL = undefined
  })

  test('defaults to the public BSC endpoints `03` §3 used, and builds a client per network', () => {
    const env = getMarketDataEnv()
    expect(env.BSC_MAINNET_RPC_URL).toBe('https://bsc-dataseed.bnbchain.org')
    expect(env.BSC_TESTNET_RPC_URL).toBe('https://bsc-testnet-dataseed.bnbchain.org')

    const mainnetClient = createMarketDataClient('mainnet')
    const testnetClient = createMarketDataClient('testnet')
    expect(mainnetClient.chain?.id).toBe(56)
    expect(testnetClient.chain?.id).toBe(97)
  })
})
