/**
 * Settlement unit tests — pure transitions, fee math, rail guards (no database required).
 */

import { describe, expect, test } from 'bun:test'
import type { AuthorizationRow } from '@repo/database/schema'
import { InvalidSettlementTransitionError, UnsupportedRailError } from './errors'
import { computeFlatFee, computePerformanceFee } from './escrow'
import {
  __resetSettlementConfigCacheForTests,
  getSettlementFeeBps,
  getSettlementPerformanceFeeBps,
  validateSettlementConfig,
} from './keys'
import {
  SETTLEMENT_TRANSITIONS,
  assertAltanaSessionRail,
  assertPlainEscrowRail,
  assertSettlementTransition,
  isValidSettlementTransition,
} from './transitions'

describe('settlement state machine', () => {
  test('HELD may transition to RELEASED, REFUNDED, or DISPUTED only', () => {
    expect(SETTLEMENT_TRANSITIONS.HELD).toEqual(['RELEASED', 'REFUNDED', 'DISPUTED'])
    expect(isValidSettlementTransition('HELD', 'RELEASED')).toBe(true)
    expect(isValidSettlementTransition('HELD', 'REFUNDED')).toBe(true)
    expect(isValidSettlementTransition('HELD', 'DISPUTED')).toBe(true)
  })

  test('terminal states have no outgoing transitions', () => {
    for (const terminal of ['RELEASED', 'REFUNDED', 'DISPUTED'] as const) {
      expect(SETTLEMENT_TRANSITIONS[terminal]).toEqual([])
      expect(isValidSettlementTransition(terminal, 'HELD')).toBe(false)
    }
  })

  test('invalid transition throws typed error', () => {
    expect(() => assertSettlementTransition('RELEASED', 'REFUNDED')).toThrow(
      InvalidSettlementTransitionError,
    )
  })
})

describe('fee computation', () => {
  test('PLAIN flat fee deducts configured bps from funded amount', () => {
    const funded = 1_000_000n
    const feeBps = 400
    expect(computeFlatFee(funded, feeBps)).toBe(40_000n)
  })

  test('ALTANA performance fee applies only to net-positive PnL', () => {
    expect(computePerformanceFee(1000n, 1000)).toBe(100n)
    expect(computePerformanceFee(0n, 1000)).toBe(0n)
    expect(computePerformanceFee(-500n, 1000)).toBe(0n)
  })

  test('default env fee bps are within milestone plan bounds', () => {
    expect(getSettlementFeeBps()).toBeGreaterThanOrEqual(300)
    expect(getSettlementFeeBps()).toBeLessThanOrEqual(500)
    expect(getSettlementPerformanceFeeBps()).toBe(1000)
  })
})

describe('rail guards', () => {
  const plainAuth = {
    rail: 'ERC8183_ESCROW',
    escrowVariant: 'PLAIN',
  } satisfies Pick<AuthorizationRow, 'rail' | 'escrowVariant'>

  const altanaAuth = {
    rail: 'ALTANA_SESSION',
    escrowVariant: null,
  } satisfies Pick<AuthorizationRow, 'rail' | 'escrowVariant'>

  test('AACP_PROGRAM and X402_PAYMENT are rejected', () => {
    for (const rail of ['AACP_PROGRAM', 'X402_PAYMENT'] as const) {
      expect(() => assertPlainEscrowRail({ rail, escrowVariant: null })).toThrow(
        UnsupportedRailError,
      )
      expect(() => assertAltanaSessionRail({ rail, escrowVariant: null })).toThrow(
        UnsupportedRailError,
      )
    }
  })

  test('PLAIN release requires ERC8183_ESCROW PLAIN variant', () => {
    expect(() => assertPlainEscrowRail(plainAuth)).not.toThrow()
    expect(() => assertPlainEscrowRail(altanaAuth)).toThrow(UnsupportedRailError)
  })

  test('ALTANA close requires ALTANA_SESSION rail', () => {
    expect(() => assertAltanaSessionRail(altanaAuth)).not.toThrow()
    expect(() => assertPlainEscrowRail(plainAuth)).not.toThrow()
    expect(() => assertAltanaSessionRail(plainAuth)).toThrow(UnsupportedRailError)
  })
})

describe('keys validation', () => {
  test('rejects out-of-range SETTLEMENT_FEE_BPS at boot', () => {
    const original = process.env.SETTLEMENT_FEE_BPS
    process.env.SETTLEMENT_FEE_BPS = '250'
    __resetSettlementConfigCacheForTests()
    try {
      expect(() => validateSettlementConfig()).toThrow(/invalid configuration/)
    } finally {
      if (original === undefined) process.env.SETTLEMENT_FEE_BPS = undefined
      else process.env.SETTLEMENT_FEE_BPS = original
      __resetSettlementConfigCacheForTests()
    }
  })
})
