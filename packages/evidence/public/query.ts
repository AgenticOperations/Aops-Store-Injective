/**
 * RING 2 · OWNED STATE — our database
 * `@repo/evidence/query` — public contract. Named exports only.
 *
 * Append-only evidence writes and queries. Never mutates a row. CANNOT import scoring/ (00 §6.2).
 */

import type { DbClient } from '@repo/database/client'
import { type EvidenceRow, evidence } from '@repo/database/schema'
import { eq } from 'drizzle-orm'

/** Read-side tagged union — mirrors Chunk 1's empty-state rule without importing `@repo/scoring`. */
export type EvidenceQueryResult = { kind: 'no_evidence' } | { kind: 'found'; rows: EvidenceRow[] }

/** Returns all evidence rows for `agentId`, or the distinct zero-evidence state when none exist. */
export async function getEvidenceForAgent(
  db: DbClient,
  agentId: string,
): Promise<EvidenceQueryResult> {
  const rows = await db.select().from(evidence).where(eq(evidence.agentId, agentId))
  if (rows.length === 0) return { kind: 'no_evidence' }
  return { kind: 'found', rows }
}
