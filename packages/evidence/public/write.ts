/**
 * RING 2 · OWNED STATE — our database
 * `@repo/evidence/write` — public contract. Named exports only.
 *
 * Append-only evidence writes and queries. Never mutates a row. CANNOT import scoring/ (00 §6.2).
 */

import type { DbClient } from '@repo/database/client'
import { type EvidenceRow, type NewEvidenceRow, evidence } from '@repo/database/schema'

/**
 * Persists one evidence row. Append-only — callers must never attempt UPDATE or DELETE; the
 * `aops_app` role's grants enforce that at the database for production writes.
 */
export async function recordEvidence(db: DbClient, row: NewEvidenceRow): Promise<EvidenceRow> {
  const [inserted] = await db.insert(evidence).values(row).returning()
  if (!inserted) throw new Error('recordEvidence: INSERT ... RETURNING returned no row')
  return inserted
}
