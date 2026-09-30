/**
 * RING 3 · IRREVERSIBLE ⚠ — money and authority
 * `@repo/settlement/transitions` — settlement status state machine (HELD terminal edges).
 *
 * Milestone plan Chunk 4b: `HELD → RELEASED | REFUNDED | DISPUTED` for `ALTANA_SESSION` and
 * `ERC8183_ESCROW` (`PLAIN`) only.
 */

import type { AuthorizationRow } from '@repo/database/schema'
import type { AuthorizationRail, EscrowVariant } from '@repo/domain/entities'
import {
  InvalidSettlementTransitionError,
  type SettlementStatus,
  UnsupportedRailError,
} from './errors'

export const SETTLEMENT_TRANSITIONS: Readonly<
  Record<SettlementStatus, readonly SettlementStatus[]>
> = {
  HELD: ['RELEASED', 'REFUNDED', 'DISPUTED'],
  RELEASED: [],
  REFUNDED: [],
  DISPUTED: [],
}

export function isValidSettlementTransition(from: SettlementStatus, to: SettlementStatus): boolean {
  return SETTLEMENT_TRANSITIONS[from].includes(to)
}

export function assertSettlementTransition(from: SettlementStatus, to: SettlementStatus): void {
  if (!isValidSettlementTransition(from, to)) {
    throw new InvalidSettlementTransitionError(from, to)
  }
}

const V1_SETTLEMENT_RAILS = new Set<AuthorizationRail>(['ALTANA_SESSION', 'ERC8183_ESCROW'])

export function assertV1SettlementRail(
  authorization: Pick<AuthorizationRow, 'rail' | 'escrowVariant'>,
  context: string,
): void {
  if (authorization.rail === 'AACP_PROGRAM' || authorization.rail === 'X402_PAYMENT') {
    throw new UnsupportedRailError(authorization.rail, context)
  }

  if (!V1_SETTLEMENT_RAILS.has(authorization.rail)) {
    throw new UnsupportedRailError(authorization.rail, context)
  }

  if (authorization.rail === 'ERC8183_ESCROW' && authorization.escrowVariant !== 'PLAIN') {
    throw new UnsupportedRailError('AACP_PROGRAM', context)
  }
}

export function assertPlainEscrowRail(
  authorization: Pick<AuthorizationRow, 'rail' | 'escrowVariant'>,
): void {
  if (authorization.rail === 'AACP_PROGRAM' || authorization.rail === 'X402_PAYMENT') {
    throw new UnsupportedRailError(authorization.rail, 'releasePlainEscrow')
  }

  if (authorization.rail !== 'ERC8183_ESCROW' || authorization.escrowVariant !== 'PLAIN') {
    throw new UnsupportedRailError(authorization.rail, 'releasePlainEscrow')
  }
}

export function assertAltanaSessionRail(
  authorization: Pick<AuthorizationRow, 'rail' | 'escrowVariant'>,
): void {
  if (authorization.rail === 'AACP_PROGRAM' || authorization.rail === 'X402_PAYMENT') {
    throw new UnsupportedRailError(authorization.rail, 'closeAltanaSession')
  }

  if (authorization.rail !== 'ALTANA_SESSION') {
    throw new UnsupportedRailError(authorization.rail, 'closeAltanaSession')
  }
}

export function isPlainEscrowVariant(variant: EscrowVariant | null): variant is 'PLAIN' {
  return variant === 'PLAIN'
}
