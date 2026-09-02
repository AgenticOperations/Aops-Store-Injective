/**
 * RING 3 · IRREVERSIBLE ⚠ — money and authority
 * `@repo/settlement/escrow` — public contract. Named exports only.
 *
 * Settlement state machine and transition logic for `ALTANA_SESSION` and `ERC8183_ESCROW`
 * (`PLAIN`) rails. Simulate by default (`architecture/00` §6.1).
 */

import type { DbClient } from '@repo/database/client'
import { type JobRow, jobs } from '@repo/database/schema'
import { asc, eq } from 'drizzle-orm'
import {
  BroadcastNetworkRequiredError,
  InvalidScopeError,
  InvalidSettlementStateError,
  JobNotFoundError,
} from './errors'
import { getSettlementFeeBps, getSettlementPerformanceFeeBps } from './keys'
import {
  assertAltanaSessionRail,
  assertPlainEscrowRail,
  assertSettlementTransition,
  assertV1SettlementRail,
} from './transitions'

export type SettlementActionMode = 'simulate' | 'broadcast'

export type SettlementNetwork = 'tbsc' | 'bsc'

export interface SettlementActionParams {
  /** Ring 3 §6.1 — simulate is the default; broadcast must be requested explicitly. */
  mode?: SettlementActionMode
  /** Required when `mode` is `broadcast` — explicit network assertion, testnet until promoted. */
  network?: SettlementNetwork
}

export interface ReleasePlainEscrowParams extends SettlementActionParams {
  /** Override configured flat fee bps (300–500). Defaults to `SETTLEMENT_FEE_BPS`. */
  feeBps?: number
}

export interface CloseAltanaSessionParams extends SettlementActionParams {
  /** Independently measured net PnL at session close — may be negative (high-water-mark: no fee on loss). */
  measuredNetPnL: string
}

export interface RefundSweepParams {
  /** Refund every `HELD` job whose `createdAt` is strictly before this instant. */
  olderThan?: Date
  /** Custom stuck predicate — when provided, takes precedence over `olderThan`. */
  isStuck?: (job: JobRow) => boolean
}

export interface SettlementTransitionResult {
  jobId: string
  settlementStatus: JobRow['settlementStatus']
  mode: SettlementActionMode
  network?: SettlementNetwork
}

export interface ReleasePlainEscrowResult extends SettlementTransitionResult {
  feeBps: number
  feeChargedAmount: string
  fundedAmount: string
  netToAgent: string
}

export interface CloseAltanaSessionResult extends SettlementTransitionResult {
  measuredNetPnL: string
  measuredPerformanceFee: string
}

export interface RefundSweepResult {
  refundedJobIds: string[]
  skippedJobIds: string[]
}

interface StoredErc8183Scope {
  escrowContract?: string
  fundedAmount?: string
  disputeWindowSeconds?: number
  escrowVariant?: string
}

function resolveActionMode(params: SettlementActionParams): SettlementActionMode {
  return params.mode ?? 'simulate'
}

function assertBroadcastNetwork(params: SettlementActionParams): SettlementNetwork | undefined {
  const mode = resolveActionMode(params)
  if (mode === 'simulate') return undefined
  if (!params.network) throw new BroadcastNetworkRequiredError()
  return params.network
}

function parseFundedAmount(scope: unknown): bigint {
  if (!scope || typeof scope !== 'object') {
    throw new InvalidScopeError('ERC8183_ESCROW scope is missing or not an object')
  }

  const raw = (scope as StoredErc8183Scope).fundedAmount
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new InvalidScopeError('ERC8183_ESCROW scope.fundedAmount must be a decimal string')
  }

  try {
    return BigInt(raw)
  } catch {
    throw new InvalidScopeError('ERC8183_ESCROW scope.fundedAmount is not a valid integer string')
  }
}

/** Computes flat fee from funded amount × bps / 10_000. */
export function computeFlatFee(fundedAmount: bigint, feeBps: number): bigint {
  return (fundedAmount * BigInt(feeBps)) / 10_000n
}

/**
 * Performance fee: bps of net-positive PnL only. High-water-mark at close — never charged on a loss.
 * Display/compute only; no fund movement.
 */
export function computePerformanceFee(measuredNetPnL: bigint, performanceFeeBps: number): bigint {
  if (measuredNetPnL <= 0n) return 0n
  return (measuredNetPnL * BigInt(performanceFeeBps)) / 10_000n
}

function parseMeasuredNetPnL(value: string): bigint {
  try {
    return BigInt(value)
  } catch {
    throw new InvalidScopeError('measuredNetPnL must be a signed integer string')
  }
}

function assertHeld(status: JobRow['settlementStatus']): void {
  if (status !== 'HELD') {
    throw new InvalidSettlementStateError('HELD', status)
  }
}

async function loadJobWithAuthorization(db: DbClient, jobId: string) {
  const row = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
    with: { authorization: true },
  })

  if (!row) throw new JobNotFoundError(jobId)
  return row
}

/**
 * `ERC8183_ESCROW` (`PLAIN`) release — deduct flat fee, record on job row, transition HELD→RELEASED.
 */
export async function releasePlainEscrow(
  jobId: string,
  db: DbClient,
  params: ReleasePlainEscrowParams = {},
): Promise<ReleasePlainEscrowResult> {
  const row = await loadJobWithAuthorization(db, jobId)
  assertHeld(row.settlementStatus)
  assertPlainEscrowRail(row.authorization)

  const feeBps = params.feeBps ?? getSettlementFeeBps()
  if (feeBps < 300 || feeBps > 500) {
    throw new InvalidScopeError('feeBps must be between 300 and 500 (3–5%)')
  }

  const fundedAmount = parseFundedAmount(row.authorization.scope)
  const feeChargedAmount = computeFlatFee(fundedAmount, feeBps)
  const netToAgent = fundedAmount - feeChargedAmount

  assertSettlementTransition('HELD', 'RELEASED')
  const mode = resolveActionMode(params)
  const network = assertBroadcastNetwork(params)

  // v1: on-chain ERC-8183 release is not wired — simulate records DB state; broadcast is asserted only.
  await db
    .update(jobs)
    .set({
      settlementStatus: 'RELEASED',
      feeBps,
      feeChargedAmount: feeChargedAmount.toString(),
    })
    .where(eq(jobs.id, jobId))

  return {
    jobId,
    settlementStatus: 'RELEASED',
    mode,
    ...(network !== undefined ? { network } : {}),
    feeBps,
    feeChargedAmount: feeChargedAmount.toString(),
    fundedAmount: fundedAmount.toString(),
    netToAgent: netToAgent.toString(),
  }
}

/**
 * `ALTANA_SESSION` close — compute stated performance fee from independently measured net PnL,
 * record `measuredPerformanceFee`, transition HELD→RELEASED. No fund movement / skim.
 */
export async function closeAltanaSession(
  jobId: string,
  db: DbClient,
  params: CloseAltanaSessionParams,
): Promise<CloseAltanaSessionResult> {
  const row = await loadJobWithAuthorization(db, jobId)
  assertHeld(row.settlementStatus)
  assertAltanaSessionRail(row.authorization)

  const measuredNetPnL = parseMeasuredNetPnL(params.measuredNetPnL)
  const performanceFeeBps = getSettlementPerformanceFeeBps()
  const measuredPerformanceFee = computePerformanceFee(measuredNetPnL, performanceFeeBps)

  assertSettlementTransition('HELD', 'RELEASED')
  const mode = resolveActionMode(params)
  const network = assertBroadcastNetwork(params)

  await db
    .update(jobs)
    .set({
      settlementStatus: 'RELEASED',
      measuredPerformanceFee: measuredPerformanceFee.toString(),
    })
    .where(eq(jobs.id, jobId))

  return {
    jobId,
    settlementStatus: 'RELEASED',
    mode,
    ...(network !== undefined ? { network } : {}),
    measuredNetPnL: measuredNetPnL.toString(),
    measuredPerformanceFee: measuredPerformanceFee.toString(),
  }
}

/** HELD→DISPUTED — lands in manual review queue. No auto-resolution path exists. */
export async function disputeJob(jobId: string, db: DbClient): Promise<SettlementTransitionResult> {
  const row = await loadJobWithAuthorization(db, jobId)
  assertHeld(row.settlementStatus)
  assertV1SettlementRail(row.authorization, 'disputeJob')

  assertSettlementTransition('HELD', 'DISPUTED')

  await db.update(jobs).set({ settlementStatus: 'DISPUTED' }).where(eq(jobs.id, jobId))

  return {
    jobId,
    settlementStatus: 'DISPUTED',
    mode: 'simulate',
  }
}

/** HELD→REFUNDED — for `apps/jobs` refund sweep and manual refunds. */
export async function refundJob(
  jobId: string,
  db: DbClient,
  params: SettlementActionParams = {},
): Promise<SettlementTransitionResult> {
  const row = await loadJobWithAuthorization(db, jobId)
  assertHeld(row.settlementStatus)
  assertV1SettlementRail(row.authorization, 'refundJob')

  assertSettlementTransition('HELD', 'REFUNDED')
  const mode = resolveActionMode(params)
  const network = assertBroadcastNetwork(params)

  await db.update(jobs).set({ settlementStatus: 'REFUNDED' }).where(eq(jobs.id, jobId))

  return {
    jobId,
    settlementStatus: 'REFUNDED',
    mode,
    ...(network !== undefined ? { network } : {}),
  }
}

/** Manual review queue read — disputed jobs only; no resolution function is exported. */
export async function listDisputedJobs(db: DbClient): Promise<JobRow[]> {
  return db
    .select()
    .from(jobs)
    .where(eq(jobs.settlementStatus, 'DISPUTED'))
    .orderBy(asc(jobs.createdAt))
}

/**
 * Finds stuck `HELD` jobs and refunds each. Scheduling belongs to `apps/jobs`; this holds
 * transition logic only.
 */
export async function refundSweep(
  db: DbClient,
  params: RefundSweepParams = {},
): Promise<RefundSweepResult> {
  const heldJobs = await db.query.jobs.findMany({
    where: eq(jobs.settlementStatus, 'HELD'),
    with: { authorization: true },
  })

  const refundedJobIds: string[] = []
  const skippedJobIds: string[] = []

  for (const job of heldJobs) {
    const stuck =
      params.isStuck?.(job) ??
      (params.olderThan !== undefined ? job.createdAt < params.olderThan : false)

    if (!stuck) {
      skippedJobIds.push(job.id)
      continue
    }

    try {
      assertV1SettlementRail(job.authorization, 'refundSweep')
      await refundJob(job.id, db)
      refundedJobIds.push(job.id)
    } catch {
      skippedJobIds.push(job.id)
    }
  }

  return { refundedJobIds, skippedJobIds }
}

export {
  assertSettlementTransition,
  isValidSettlementTransition,
  SETTLEMENT_TRANSITIONS,
} from './transitions'
export type { SettlementStatus } from './errors'
