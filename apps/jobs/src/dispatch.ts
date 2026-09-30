/**
 * Dispatch table — maps registry task names to handlers.
 */

import type { DbClient } from '@repo/database/client'
import type { ListingLifecycleDeps } from '@repo/listings/lifecycle'
import type { PendingTaskRow } from './queue'
import {
  type ListingsTransitionPayload,
  runListingsTransition,
} from './tasks/listings-transition'
import { runRefundSweep } from './tasks/refund-sweep'
import { type EvidenceRollupPayload, runEvidenceRollup } from './tasks/rollup'

export interface TaskHandlerContext {
  db: DbClient
  listingDeps: ListingLifecycleDeps
}

export async function dispatchTask(ctx: TaskHandlerContext, task: PendingTaskRow): Promise<void> {
  switch (task.taskName) {
    case 'evidence.rollup':
      await runEvidenceRollup(ctx.db, task.payload as EvidenceRollupPayload)
      return
    case 'listings.transition': {
      const result = await runListingsTransition(
        ctx.listingDeps,
        task.payload as ListingsTransitionPayload,
      )
      if (!result.ok) {
        throw new Error(`${result.error.code}: ${result.error.message}`)
      }
      return
    }
    case 'refundSweep':
      await runRefundSweep(ctx.db)
      return
    default:
      throw new Error(`unknown task: ${task.taskName}`)
  }
}
