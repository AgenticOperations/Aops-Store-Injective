import { describe, expect, test } from 'bun:test'
import { createPublicClient, custom, decodeFunctionData, encodeFunctionResult } from 'viem'
import { bsc } from 'viem/chains'
import { POOL_ABI } from '#private/pancake-v3'
import { PriceReadError, getOraclePrice } from './prices'

// Real, live-verified values — WBNB/USDT 0.05% pool, `final-review-docs/03` §3.3.
const POOL_ADDRESS = '0x36696169C63e42cd08ce11f5deeBbCeBae652050' as const
const TOKEN0 = '0x55d398326f99059fF775485246999027B3197955' as const // USDT
const TOKEN1 = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as const // WBNB
const SQRT_PRICE_X96 = 2962883964387659324874893034n
const TICK = -65727

function makeFixtureClient(handlers: Record<string, (data: `0x${string}`) => `0x${string}`>) {
  return createPublicClient({
    chain: bsc,
    transport: custom({
      request: async ({ method, params }) => {
        if (method !== 'eth_call') {
          throw new Error(`fixture transport: unexpected RPC method ${method}`)
        }
        const [{ to, data }] = params as [{ to: `0x${string}`; data: `0x${string}` }]
        const handler = handlers[to.toLowerCase()]
        if (!handler) throw new Error(`fixture transport: no handler for address ${to}`)
        return handler(data)
      },
    }),
  })
}

function poolHandler(
  overrides: { sqrtPriceX96?: bigint } = {},
): (data: `0x${string}`) => `0x${string}` {
  return (data) => {
    const { functionName } = decodeFunctionData({ abi: POOL_ABI, data })
    switch (functionName) {
      case 'slot0':
        return encodeFunctionResult({
          abi: POOL_ABI,
          functionName: 'slot0',
          result: [overrides.sqrtPriceX96 ?? SQRT_PRICE_X96, TICK, 900, 900, 900, 0, true],
        })
      case 'token0':
        return encodeFunctionResult({ abi: POOL_ABI, functionName: 'token0', result: TOKEN0 })
      case 'token1':
        return encodeFunctionResult({ abi: POOL_ABI, functionName: 'token1', result: TOKEN1 })
      default:
        throw new Error(`fixture: unhandled pool function ${functionName}`)
    }
  }
}

describe('getOraclePrice', () => {
  test('matches `03` §3.3s worked example (sqrtPriceX96 -> ~0.0013985246)', async () => {
    const client = makeFixtureClient({ [POOL_ADDRESS.toLowerCase()]: poolHandler() })
    const price = await getOraclePrice(client, POOL_ADDRESS)
    expect(price.tick).toBe(TICK)
    expect(price.sqrtPriceX96).toBe(SQRT_PRICE_X96)
    expect(price.price1Per0Raw).toBeCloseTo(0.0013985246, 6)
  })

  test('an undecodable slot0 response is rejected, not silently swallowed', async () => {
    const client = makeFixtureClient({ [POOL_ADDRESS.toLowerCase()]: () => '0x1234' })
    await expect(getOraclePrice(client, POOL_ADDRESS)).rejects.toThrow(PriceReadError)
  })

  test('a zero sqrtPriceX96 is rejected — not a real pool state', async () => {
    const client = makeFixtureClient({
      [POOL_ADDRESS.toLowerCase()]: poolHandler({ sqrtPriceX96: 0n }),
    })
    await expect(getOraclePrice(client, POOL_ADDRESS)).rejects.toThrow(PriceReadError)
  })
})
