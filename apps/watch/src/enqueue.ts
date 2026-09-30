/**
 * Shared pending-task enqueue — watch detects, jobs executes.
 */

import type { DbClient } from '@repo/database/client'
import { pendingTasks } from '@repo/database/schema'

export type ListingTransitionAction = 'markDegraded' | 'markLive'

export interface ListingTransitionPayload {
  listingId: string
  action: ListingTransitionAction
}

export interface EnqueueTaskParams {
  taskName: string
  idempotencyKey: string
  payload: ListingTransitionPayload | Record<string, unknown>
}

/** Inserts a row into `pending_tasks`, silently skipping duplicate idempotency keys. */
export async function enqueueTask(db: DbClient, params: EnqueueTaskParams): Promise<boolean> {
  const rows = await db
    .insert(pendingTasks)
    .values({
      taskName: params.taskName,
      idempotencyKey: params.idempotencyKey,
      payload: params.payload,
    })
    .onConflictDoNothing({ target: pendingTasks.idempotencyKey })
    .returning({ id: pendingTasks.id })

  return rows.length > 0
}
