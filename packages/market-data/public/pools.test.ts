import { describe, expect, test } from 'bun:test'
import { createPublicClient, custom, decodeFunctionData, encodeFunctionResult } from 'viem'
import { bsc } from 'viem/chains'
import { FACTORY_ABI, POOL_ABI } from '#private/pancake-v3'
import { PoolReadError, getPoolAddress, getPoolState, getTickInfo } from './pools'

// Real, live-verified values — WBNB/USDT 0.05% pool, `final-review-docs/03` §3.2, §3.3.
const POOL_ADDRESS = '0x36696169C63e42cd08ce11f5deeBbCeBae652050' as const
const FACTORY_ADDRESS = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865' as const
const TOKEN0 = '0x55d398326f99059fF775485246999027B3197955' as const // USDT
const TOKEN1 = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as const // WBNB
const SQRT_PRICE_X96 = 2962883964387659324874893034n
const TICK = -65727
const FEE = 500
const TICK_SPACING = 10 // fee=500 -> tickSpacing=10, `03` §3.2's table

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

function wellFormedPoolHandler(
  overrides: { fee?: number } = {},
): (data: `0x${string}`) => `0x${string}` {
  return (data) => {
    const { functionName } = decodeFunctionData({ abi: POOL_ABI, data })
    switch (functionName) {
      case 'slot0':
        return encodeFunctionResult({
          abi: POOL_ABI,
          functionName: 'slot0',
          result: [SQRT_PRICE_X96, TICK, 900, 900, 900, 0, true],
        })
      case 'feeGrowthGlobal0X128':
        return encodeFunctionResult({
          abi: POOL_ABI,
          functionName: 'feeGrowthGlobal0X128',
          result: 123456789012345678901234567890n,
        })
      case 'feeGrowthGlobal1X128':
        return encodeFunctionResult({
          abi: POOL_ABI,
          functionName: 'feeGrowthGlobal1X128',
          result: 987654321098765432109876543210n,
        })
      case 'liquidity':
        return encodeFunctionResult({
          abi: POOL_ABI,
          functionName: 'liquidity',
          result: 3009000000000000000000000n, // ~3.009e24 — `03` §3.3
        })
      case 'token0':
        return encodeFunctionResult({ abi: POOL_ABI, functionName: 'token0', result: TOKEN0 })
      case 'token1':
        return encodeFunctionResult({ abi: POOL_ABI, functionName: 'token1', result: TOKEN1 })
      case 'fee':
        return encodeFunctionResult({
          abi: POOL_ABI,
          functionName: 'fee',
          result: overrides.fee ?? FEE,
        })
      case 'ticks':
        return encodeFunctionResult({
          abi: POOL_ABI,
          functionName: 'ticks',
          result: [500000000000n, -12345n, 111n, 222n, 0n, 0n, 0, true],
        })
      default:
        throw new Error(`fixture: unhandled pool function ${functionName}`)
    }
  }
}

function factoryHandler(
  overrides: { tickSpacing?: number; pool?: `0x${string}` } = {},
): (data: `0x${string}`) => `0x${string}` {
  return (data) => {
    const { functionName } = decodeFunctionData({ abi: FACTORY_ABI, data })
    switch (functionName) {
      case 'feeAmountTickSpacing':
        return encodeFunctionResult({
          abi: FACTORY_ABI,
          functionName: 'feeAmountTickSpacing',
          result: overrides.tickSpacing ?? TICK_SPACING,
        })
      case 'getPool':
        return encodeFunctionResult({
          abi: FACTORY_ABI,
          functionName: 'getPool',
          result: overrides.pool ?? POOL_ADDRESS,
        })
      default:
        throw new Error(`fixture: unhandled factory function ${functionName}`)
    }
  }
}

describe('getPoolState', () => {
  test('a well-formed pool response parses into the correct typed PoolState', async () => {
    const client = makeFixtureClient({
      [POOL_ADDRESS.toLowerCase()]: wellFormedPoolHandler(),
      [FACTORY_ADDRESS.toLowerCase()]: factoryHandler(),
    })
    const state = await getPoolState(client, POOL_ADDRESS)
    expect(state.poolAddress).toBe(POOL_ADDRESS)
    expect(state.token0.toLowerCase()).toBe(TOKEN0.toLowerCase())
    expect(state.token1.toLowerCase()).toBe(TOKEN1.toLowerCase())
    expect(state.fee).toBe(500)
    expect(state.tickSpacing).toBe(10)
    expect(state.tick).toBe(TICK)
    expect(state.sqrtPriceX96).toBe(SQRT_PRICE_X96)
    expect(state.liquidity).toBe(3009000000000000000000000n)
  })

  test('a malformed pool response (fee = 0) is rejected at the boundary, not propagated', async () => {
    const client = makeFixtureClient({
      [POOL_ADDRESS.toLowerCase()]: wellFormedPoolHandler({ fee: 0 }),
      [FACTORY_ADDRESS.toLowerCase()]: factoryHandler(),
    })
    await expect(getPoolState(client, POOL_ADDRESS)).rejects.toThrow(PoolReadError)
  })

  test('an undecodable response is rejected, not silently swallowed', async () => {
    const client = makeFixtureClient({
      [POOL_ADDRESS.toLowerCase()]: () => '0x1234',
      [FACTORY_ADDRESS.toLowerCase()]: factoryHandler(),
    })
    await expect(getPoolState(client, POOL_ADDRESS)).rejects.toThrow(PoolReadError)
  })
})

describe('getTickInfo', () => {
  test('parses a well-formed ticks() response', async () => {
    const client = makeFixtureClient({ [POOL_ADDRESS.toLowerCase()]: wellFormedPoolHandler() })
    const info = await getTickInfo(client, POOL_ADDRESS, -65730)
    expect(info.tick).toBe(-65730)
    expect(info.liquidityGross).toBe(500000000000n)
    expect(info.liquidityNet).toBe(-12345n)
    expect(info.initialized).toBe(true)
  })
})

describe('getPoolAddress', () => {
  test('resolves a pool address from the factory', async () => {
    const client = makeFixtureClient({ [FACTORY_ADDRESS.toLowerCase()]: factoryHandler() })
    const address = await getPoolAddress(client, TOKEN0, TOKEN1, 500)
    expect(address.toLowerCase()).toBe(POOL_ADDRESS.toLowerCase())
  })

  test('rejects a zero-address factory response — no pool exists for that pair/fee', async () => {
    const client = makeFixtureClient({
      [FACTORY_ADDRESS.toLowerCase()]: factoryHandler({
        pool: '0x0000000000000000000000000000000000000000',
      }),
    })
    await expect(getPoolAddress(client, TOKEN0, TOKEN1, 10000)).rejects.toThrow(PoolReadError)
  })
})
