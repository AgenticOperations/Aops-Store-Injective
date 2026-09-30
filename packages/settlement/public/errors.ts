/**
 * RING 3 · IRREVERSIBLE ⚠ — money and authority
 * `@repo/settlement` — typed settlement errors.
 */

import type { AuthorizationRail } from '@repo/domain/entities'

export type SettlementStatus = 'HELD' | 'RELEASED' | 'REFUNDED' | 'DISPUTED'

export class SettlementError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'SettlementError'
    this.code = code
  }
}

export class JobNotFoundError extends SettlementError {
  constructor(jobId: string) {
    super('JOB_NOT_FOUND', `@repo/settlement: job ${jobId} not found`)
    this.name = 'JobNotFoundError'
  }
}

export class InvalidSettlementTransitionError extends SettlementError {
  constructor(from: SettlementStatus, to: SettlementStatus) {
    super(
      'INVALID_SETTLEMENT_TRANSITION',
      `@repo/settlement: invalid settlement transition ${from} -> ${to}`,
    )
    this.name = 'InvalidSettlementTransitionError'
  }
}

export class InvalidSettlementStateError extends SettlementError {
  constructor(expected: SettlementStatus, actual: SettlementStatus) {
    super(
      'INVALID_SETTLEMENT_STATE',
      `@repo/settlement: expected settlement status ${expected}, got ${actual}`,
    )
    this.name = 'InvalidSettlementStateError'
  }
}

/** v1 settlement owns `ALTANA_SESSION` and `ERC8183_ESCROW` (`PLAIN`) only. */
export class UnsupportedRailError extends SettlementError {
  readonly rail: AuthorizationRail

  constructor(rail: AuthorizationRail, context: string) {
    super('UNSUPPORTED_RAIL', `@repo/settlement: rail ${rail} is out of v1 scope for ${context}`)
    this.name = 'UnsupportedRailError'
    this.rail = rail
  }
}

export class BroadcastNetworkRequiredError extends SettlementError {
  constructor() {
    super(
      'BROADCAST_NETWORK_REQUIRED',
      '@repo/settlement: broadcast mode requires an explicit network assertion (tbsc | bsc)',
    )
    this.name = 'BroadcastNetworkRequiredError'
  }
}

export class InvalidScopeError extends SettlementError {
  constructor(message: string) {
    super('INVALID_SCOPE', `@repo/settlement: ${message}`)
    this.name = 'InvalidScopeError'
  }
}
