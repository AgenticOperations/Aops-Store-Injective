/**
 * Pending-task queue — watch detects, jobs executes. Idempotent by `idempotency_key`.
 */

import type { DbClient } from '@repo/database/client'
import { pendingTasks } from '@repo/database/schema'
import { eq, inArray } from 'drizzle-orm'

export type PendingTaskRow = typeof pendingTasks.$inferSelect

export interface EnqueueTaskInput {
  taskName: string
  idempotencyKey: string
  payload?: Record<string, unknown>
}

export interface EnqueueTaskResult {
  enqueued: boolean
  id?: string
}

/** INSERT ON CONFLICT DO NOTHING on `idempotency_key`. */
export async function enqueueTask(
  db: DbClient,
  task: EnqueueTaskInput,
): Promise<EnqueueTaskResult> {
  const inserted = await db
    .insert(pendingTasks)
    .values({
      taskName: task.taskName,
      idempotencyKey: task.idempotencyKey,
      payload: task.payload ?? {},
    })
    .onConflictDoNothing({ target: pendingTasks.idempotencyKey })
    .returning({ id: pendingTasks.id })

  if (inserted.length === 0) return { enqueued: false }
  const id = inserted[0]?.id
  if (!id) return { enqueued: false }
  return { enqueued: true, id }
}

/** SELECT pending rows and mark them `processing` — safe for concurrent workers via SKIP LOCKED. */
export async function claimPendingTasks(db: DbClient, limit: number): Promise<PendingTaskRow[]> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(pendingTasks)
      .where(eq(pendingTasks.status, 'pending'))
      .orderBy(pendingTasks.createdAt)
      .limit(limit)
      .for('update', { skipLocked: true })

    if (rows.length === 0) return []

    const ids = rows.map((row) => row.id)
    await tx.update(pendingTasks).set({ status: 'processing' }).where(inArray(pendingTasks.id, ids))

    return rows.map((row) => ({ ...row, status: 'processing' as const }))
  })
}

export async function completeTask(db: DbClient, id: string): Promise<void> {
  await db
    .update(pendingTasks)
    .set({ status: 'completed', processedAt: new Date() })
    .where(eq(pendingTasks.id, id))
}

/** Return a claimed task to the queue for retry after backoff. */
export async function releaseTask(db: DbClient, id: string): Promise<void> {
  await db.update(pendingTasks).set({ status: 'pending' }).where(eq(pendingTasks.id, id))
}
