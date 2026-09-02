// packages/agent-registry/public/keys.test.ts
import { describe, expect, test } from 'bun:test'
import { loadAgentRegistryKeys } from './keys'

describe('loadAgentRegistryKeys', () => {
  test('loads a valid config with the optional 8004scan key present', () => {
    const keys = loadAgentRegistryKeys({
      AGENT_REGISTRY_BSC_RPC_URL: 'https://bsc-dataseed.example.com',
      AGENT_REGISTRY_8004SCAN_API_KEY: 'test-key',
    })
    expect(keys).toEqual({
      bscRpcUrl: 'https://bsc-dataseed.example.com',
      scan8004ApiKey: 'test-key',
    })
  })

  test('loads a valid config with the optional key absent', () => {
    const keys = loadAgentRegistryKeys({
      AGENT_REGISTRY_BSC_RPC_URL: 'https://bsc-dataseed.example.com',
    })
    expect(keys).toEqual({
      bscRpcUrl: 'https://bsc-dataseed.example.com',
      scan8004ApiKey: undefined,
    })
  })

  test('fails loudly (throws) when the required RPC URL is missing', () => {
    expect(() => loadAgentRegistryKeys({})).toThrow()
  })

  test('fails loudly (throws) when the RPC URL is present but not a valid URL', () => {
    expect(() => loadAgentRegistryKeys({ AGENT_REGISTRY_BSC_RPC_URL: 'not-a-url' })).toThrow()
  })
})
