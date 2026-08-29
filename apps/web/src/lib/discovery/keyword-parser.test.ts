// apps/web/src/lib/discovery/keyword-parser.test.ts
import { describe, expect, test } from 'bun:test'
import { parseByKeyword } from './keyword-parser'

describe('parseByKeyword', () => {
  test('matches health-factor-monitoring on liquidation language', () => {
    const result = parseByKeyword('protect my borrow position from getting wiped out')
    expect(result.category).toBe('health-factor-monitoring')
  })

  test('matches grid-trading on grid language', () => {
    const result = parseByKeyword('set up a grid on BNB/USDT')
    expect(result.category).toBe('grid-trading')
  })

  test('matches yield-optimization on yield/APR language', () => {
    const result = parseByKeyword('find me the best APR for my USDC')
    expect(result.category).toBe('yield-optimization')
  })

  test('matches rebalancing on LP/range language', () => {
    const result = parseByKeyword('rebalance my LP range automatically')
    expect(result.category).toBe('rebalancing')
  })

  test('returns null category on fully ambiguous text', () => {
    const result = parseByKeyword('make money on BNB')
    expect(result.category).toBeNull()
  })
})
