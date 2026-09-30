/**
 * Scheduled refund sweep — stuck HELD jobs older than seven days.
 */

import type { DbClient } from '@repo/database/client'
import { refundSweep } from '@repo/settlement/escrow'

export const DEFAULT_REFUND_SWEEP_AGE_MS = 7 * 86_400_000

export async function runRefundSweep(
  db: DbClient,
  olderThan: Date = new Date(Date.now() - DEFAULT_REFUND_SWEEP_AGE_MS),
) {
  return refundSweep(db, { olderThan })
}
