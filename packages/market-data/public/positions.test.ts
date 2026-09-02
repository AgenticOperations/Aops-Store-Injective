import { describe, expect, test } from 'bun:test'
import {
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeFunctionResult,
  getAddress,
} from 'viem'
import { bsc } from 'viem/chains'
import {
  MASTER_CHEF_V3_ABI,
  MASTER_CHEF_V3_ADDRESS_MAINNET,
  NPM_ABI,
  NPM_ADDRESS,
} from '#private/pancake-v3'
import { PositionReadError, getPosition, getStakedPositionInfo } from './positions'

const TOKEN_ID = 7250688n // one of `03` §3.5's live-sampled tokenIds
const TOKEN0 = '0x55d398326f99059fF775485246999027B3197955' as const // USDT
const TOKEN1 = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as const // WBNB
// `getAddress` checksums this so viem's arg-encoding accepts it — the literal value is
// arbitrary (a stand-in EOA), only its checksummed form and correct 20-byte length matter.
const UNSTAKED_OWNER = getAddress(`0x${'11'.repeat(19)}1d`)

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

function npmHandler(
  overrides: { owner?: `0x${string}`; tickLower?: number; tickUpper?: number } = {},
): (data: `0x${string}`) => `0x${string}` {
  return (data) => {
    const { functionName } = decodeFunctionData({ abi: NPM_ABI, data })
    switch (functionName) {
      case 'positions':
        return encodeFunctionResult({
          abi: NPM_ABI,
          functionName: 'positions',
          result: [
            0n,
            '0x0000000000000000000000000000000000000000',
            TOKEN0,
            TOKEN1,
            500,
            overrides.tickLower ?? -65800,
            overrides.tickUpper ?? -65700,
            123456789000000000000n,
            111111111111111111n,
            222222222222222222n,
            1000000000000000n,
            2000000000000000n,
          ],
        })
      case 'ownerOf':
        return encodeFunctionResult({
          abi: NPM_ABI,
          functionName: 'ownerOf',
          result: overrides.owner ?? UNSTAKED_OWNER,
        })
      default:
        throw new Error(`fixture: unhandled NPM function ${functionName}`)
    }
  }
}

function masterChefHandler(
  overrides: { liquidity?: bigint; pendingCake?: bigint } = {},
): (data: `0x${string}`) => `0x${string}` {
  return (data) => {
    const { functionName } = decodeFunctionData({ abi: MASTER_CHEF_V3_ABI, data })
    switch (functionName) {
      case 'userPositionInfos':
        return encodeFunctionResult({
          abi: MASTER_CHEF_V3_ABI,
          functionName: 'userPositionInfos',
          result: [
            overrides.liquidity ?? 123456789000000000000n,
            50000000000000000n,
            -65800,
            -65700,
            333333333333333333n,
            999999999999999n, // reward — unused; pendingCake is the authoritative live value
            UNSTAKED_OWNER,
            5n,
            2000000000000000000n,
          ],
        })
      case 'pendingCake':
        return encodeFunctionResult({
          abi: MASTER_CHEF_V3_ABI,
          functionName: 'pendingCake',
          result: overrides.pendingCake ?? 4200000000000000000n,
        })
      default:
        throw new Error(`fixture: unhandled MasterChefV3 function ${functionName}`)
    }
  }
}

describe('getPosition', () => {
  test('a well-formed, unstaked NPM position parses into the correct typed PositionState', async () => {
    const client = makeFixtureClient({ [NPM_ADDRESS.mainnet.toLowerCase()]: npmHandler() })
    const position = await getPosition(client, 'mainnet', TOKEN_ID)
    expect(position.tokenId).toBe(TOKEN_ID)
    expect(position.token0.toLowerCase()).toBe(TOKEN0.toLowerCase())
    expect(position.token1.toLowerCase()).toBe(TOKEN1.toLowerCase())
    expect(position.tickLower).toBe(-65800)
    expect(position.tickUpper).toBe(-65700)
    expect(position.isStakedInMasterChef).toBe(false)
  })

  test('a position owned by MasterChefV3 is flagged staked — `03` §3.7', async () => {
    const client = makeFixtureClient({
      [NPM_ADDRESS.mainnet.toLowerCase()]: npmHandler({ owner: MASTER_CHEF_V3_ADDRESS_MAINNET }),
    })
    const position = await getPosition(client, 'mainnet', TOKEN_ID)
    expect(position.isStakedInMasterChef).toBe(true)
  })

  test('a malformed position (tickUpper <= tickLower) is rejected at the boundary, not propagated', async () => {
    const client = makeFixtureClient({
      [NPM_ADDRESS.mainnet.toLowerCase()]: npmHandler({ tickLower: 100, tickUpper: 100 }),
    })
    await expect(getPosition(client, 'mainnet', TOKEN_ID)).rejects.toThrow(PositionReadError)
  })
})

describe('getStakedPositionInfo', () => {
  test('a well-formed staked position parses correctly; pendingCake is authoritative', async () => {
    const client = makeFixtureClient({
      [MASTER_CHEF_V3_ADDRESS_MAINNET.toLowerCase()]: masterChefHandler(),
    })
    const staked = await getStakedPositionInfo(client, TOKEN_ID)
    expect(staked.liquidity).toBe(123456789000000000000n)
    expect(staked.pendingRewardCakeAmount).toBe(4200000000000000000n)
  })

  test('a stale, emptied-but-still-staked position parses without error — `03` §3.7', async () => {
    const client = makeFixtureClient({
      [MASTER_CHEF_V3_ADDRESS_MAINNET.toLowerCase()]: masterChefHandler({
        liquidity: 0n,
        pendingCake: 0n,
      }),
    })
    const staked = await getStakedPositionInfo(client, TOKEN_ID)
    expect(staked.liquidity).toBe(0n)
    expect(staked.pendingRewardCakeAmount).toBe(0n)
  })

  test('an undecodable MasterChefV3 response is rejected, not silently swallowed', async () => {
    const client = makeFixtureClient({
      [MASTER_CHEF_V3_ADDRESS_MAINNET.toLowerCase()]: () => '0x1234',
    })
    await expect(getStakedPositionInfo(client, TOKEN_ID)).rejects.toThrow(PositionReadError)
  })
})
