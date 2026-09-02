// packages/domain/public/state-machines.test.ts
import { describe, expect, test } from 'bun:test'
import type { CredentialStatus, JobStatus, ListingStatus } from './entities'
import {
  ACCOUNT_TRANSITIONS,
  CREDENTIAL_TRANSITIONS,
  INITIAL_TRUST_TIER_ON_LIVE,
  JOB_TRANSITIONS,
  LISTING_TRANSITIONS,
  TRUST_TIER_TRANSITIONS,
  isValidTransition,
  transition,
} from './state-machines'

describe('LISTING_TRANSITIONS', () => {
  test('walks the full DISCOVERED -> LIVE ladder in order', () => {
    const ladder: ListingStatus[] = [
      'DISCOVERED',
      'CLAIMED',
      'OWNERSHIP_VERIFIED',
      'ENDPOINT_VERIFIED',
      'LIVE',
    ]
    let current = ladder[0] as ListingStatus
    for (const next of ladder.slice(1)) {
      current = transition(LISTING_TRANSITIONS, current, next as ListingStatus)
    }
    expect(current).toBe('LIVE')
  })

  test('cannot skip a rung — DISCOVERED straight to LIVE is rejected', () => {
    expect(isValidTransition(LISTING_TRANSITIONS, 'DISCOVERED', 'LIVE')).toBe(false)
    expect(() => transition(LISTING_TRANSITIONS, 'DISCOVERED', 'LIVE')).toThrow()
  })

  test('LIVE and DEGRADED recover symmetrically', () => {
    expect(isValidTransition(LISTING_TRANSITIONS, 'LIVE', 'DEGRADED')).toBe(true)
    expect(isValidTransition(LISTING_TRANSITIONS, 'DEGRADED', 'LIVE')).toBe(true)
  })

  test('SUSPENDED and REVOKED are reachable from every non-terminal state', () => {
    const nonTerminal: ListingStatus[] = [
      'DISCOVERED',
      'CLAIMED',
      'OWNERSHIP_VERIFIED',
      'ENDPOINT_VERIFIED',
      'LIVE',
      'DEGRADED',
    ]
    for (const status of nonTerminal) {
      expect(isValidTransition(LISTING_TRANSITIONS, status, 'SUSPENDED')).toBe(true)
      expect(isValidTransition(LISTING_TRANSITIONS, status, 'REVOKED')).toBe(true)
    }
  })

  test('REVOKED is terminal', () => {
    expect(LISTING_TRANSITIONS.REVOKED).toEqual([])
  })
})

describe('TRUST_TIER_TRANSITIONS', () => {
  test('tier only ever climbs one rung at a time', () => {
    expect(isValidTransition(TRUST_TIER_TRANSITIONS, 'Low', 'Medium')).toBe(true)
    expect(isValidTransition(TRUST_TIER_TRANSITIONS, 'Medium', 'High')).toBe(true)
    expect(isValidTransition(TRUST_TIER_TRANSITIONS, 'Low', 'High')).toBe(false)
  })

  test('High is terminal', () => {
    expect(TRUST_TIER_TRANSITIONS.High).toEqual([])
  })

  test('a listing reaching LIVE starts at Low, never Medium/High', () => {
    expect(INITIAL_TRUST_TIER_ON_LIVE).toBe('Low')
  })
})

describe('ACCOUNT_TRANSITIONS', () => {
  test('UNFUNDED becomes FUNDED on first settled escrow / x402 payment', () => {
    expect(isValidTransition(ACCOUNT_TRANSITIONS, 'UNFUNDED', 'FUNDED')).toBe(true)
  })

  test('RESTRICTED clears back to FUNDED once feedback is filed', () => {
    expect(isValidTransition(ACCOUNT_TRANSITIONS, 'RESTRICTED', 'FUNDED')).toBe(true)
  })

  test('every non-terminal state can reach SUSPENDED', () => {
    expect(isValidTransition(ACCOUNT_TRANSITIONS, 'UNFUNDED', 'SUSPENDED')).toBe(true)
    expect(isValidTransition(ACCOUNT_TRANSITIONS, 'FUNDED', 'SUSPENDED')).toBe(true)
    expect(isValidTransition(ACCOUNT_TRANSITIONS, 'RESTRICTED', 'SUSPENDED')).toBe(true)
  })

  test('SUSPENDED is terminal', () => {
    expect(ACCOUNT_TRANSITIONS.SUSPENDED).toEqual([])
  })
})

describe('CREDENTIAL_TRANSITIONS', () => {
  test('walks PENDING -> ACTIVE -> ROTATING -> EXPIRED', () => {
    let current: CredentialStatus = 'PENDING'
    for (const next of ['ACTIVE', 'ROTATING', 'EXPIRED'] as const) {
      current = transition(CREDENTIAL_TRANSITIONS, current, next)
    }
    expect(current).toBe('EXPIRED')
  })

  test('ACTIVE and ROTATING can both be revoked directly', () => {
    expect(isValidTransition(CREDENTIAL_TRANSITIONS, 'ACTIVE', 'REVOKED')).toBe(true)
    expect(isValidTransition(CREDENTIAL_TRANSITIONS, 'ROTATING', 'REVOKED')).toBe(true)
  })

  test('EXPIRED and REVOKED are terminal', () => {
    expect(CREDENTIAL_TRANSITIONS.EXPIRED).toEqual([])
    expect(CREDENTIAL_TRANSITIONS.REVOKED).toEqual([])
  })
})

describe('JOB_TRANSITIONS', () => {
  test('walks the setup chain into RUNNING', () => {
    let current: JobStatus = 'CONFIGURED'
    for (const next of ['AUTHORIZED', 'ACTIVE', 'RUNNING'] as const) {
      current = transition(JOB_TRANSITIONS, current, next)
    }
    expect(current).toBe('RUNNING')
  })

  test('renewal reactivates an EXPIRED job to RUNNING under a new Authorization (architecture/01 §1.3)', () => {
    expect(isValidTransition(JOB_TRANSITIONS, 'EXPIRED', 'RUNNING')).toBe(true)
  })

  test('REVOKED cascades to ARCHIVED, never back to RUNNING', () => {
    expect(isValidTransition(JOB_TRANSITIONS, 'REVOKED', 'ARCHIVED')).toBe(true)
    expect(isValidTransition(JOB_TRANSITIONS, 'REVOKED', 'RUNNING')).toBe(false)
  })

  test('ARCHIVED is terminal', () => {
    expect(JOB_TRANSITIONS.ARCHIVED).toEqual([])
  })
})
