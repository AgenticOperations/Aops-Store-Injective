/**
 * RING 2 · OWNED STATE — buyer credentials
 * `@repo/access/job-history` — public contract. Named exports only.
 *
 * Wallet-keyed job history — `final-review-docs/04` §11.6. Joins through `authorizations`;
 * credentials are never the join key.
 */

import type { DbClient } from '@repo/database/client'
import { authorizations, jobs, listings } from '@repo/database/schema'
import type { JobStatus } from '@repo/domain/entities'
import { type SQL, and, eq } from 'drizzle-orm'
import type { Address } from 'viem'
import { z } from 'zod'

const executionStatusSchema = z.enum([
  'CONFIGURED',
  'AUTHORIZED',
  'ACTIVE',
  'RUNNING',
  'PAUSED',
  'DEGRADED',
  'ATTENTION_REQUIRED',
  'EXPIRED',
  'REVOKED',
  'ARCHIVED',
])

const settlementStatusSchema = z.enum(['HELD', 'RELEASED', 'REFUNDED', 'DISPUTED'])

export interface JobHistoryFilters {
  /** Filter on `jobs.execution_status`. */
  status?: JobStatus
  /** Filter on `jobs.settlement_status`. */
  settlementStatus?: z.infer<typeof settlementStatusSchema>
  /** Filter on `authorizations.id` — the session/authorization that funded the hire (`04` §11.6). */
  hiredVia?: string
}

export interface JobHistoryRow {
  jobId: string
  authorizationId: string
  listingId: string
  executionStatus: JobStatus
  settlementStatus: 'HELD' | 'RELEASED' | 'REFUNDED' | 'DISPUTED'
  buyerWallet: Address
  providerAgentId: string
  createdAt: Date
}

export async function getJobHistory(
  wallet: Address,
  db: DbClient,
  filters: JobHistoryFilters = {},
): Promise<JobHistoryRow[]> {
  const conditions: SQL[] = [eq(authorizations.buyerWallet, wallet)]

  if (filters.status) {
    conditions.push(eq(jobs.executionStatus, filters.status))
  }
  if (filters.settlementStatus) {
    conditions.push(eq(jobs.settlementStatus, filters.settlementStatus))
  }
  if (filters.hiredVia) {
    conditions.push(eq(authorizations.id, filters.hiredVia))
  }

  const rows = await db
    .select({
      jobId: jobs.id,
      authorizationId: jobs.authorizationId,
      listingId: jobs.listingId,
      executionStatus: jobs.executionStatus,
      settlementStatus: jobs.settlementStatus,
      buyerWallet: authorizations.buyerWallet,
      providerAgentId: listings.agentId,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .innerJoin(authorizations, eq(jobs.authorizationId, authorizations.id))
    .innerJoin(listings, eq(jobs.listingId, listings.id))
    .where(and(...conditions))

  return rows.map((row) => ({
    jobId: row.jobId,
    authorizationId: row.authorizationId,
    listingId: row.listingId,
    executionStatus: row.executionStatus as JobStatus,
    settlementStatus: row.settlementStatus,
    buyerWallet: row.buyerWallet as Address,
    providerAgentId: row.providerAgentId,
    createdAt: row.createdAt,
  }))
}

export { executionStatusSchema, settlementStatusSchema }
