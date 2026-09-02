import type { DbClient } from '@repo/database/client'
import { agentScores, listings } from '@repo/database/schema'
import type { DiscoveryCandidate } from '@repo/discovery/types'
import type { ListingStatus } from '@repo/domain/entities'
import type { Category, TrustTier } from '@repo/domain/types'
import { eq, inArray } from 'drizzle-orm'

const DEFAULT_FEE_BPS = 300
const DEFAULT_CAPABILITIES: Record<Category, string[]> = {
  rebalancing: ['lp_rebalance', 'range_management'],
  grid_trading: ['grid_orders', 'price_ladder'],
  yield_optimization: ['yield_routing', 'auto_compound'],
  health_factor_monitoring: ['hf_monitor', 'liquidation_guard'],
}

export async function loadDiscoveryCandidates(
  db: DbClient,
  opts: { statusFilter?: ListingStatus[] } = {},
): Promise<DiscoveryCandidate[]> {
  const statusFilter = opts.statusFilter ?? ['LIVE']
  const rows = await db
    .select()
    .from(listings)
    .where(inArray(listings.status, statusFilter))

  if (rows.length === 0) return []

  const agentIds = rows.map((r) => r.agentId)
  const scores = await db
    .select()
    .from(agentScores)
    .where(inArray(agentScores.agentId, agentIds))
  const scoreByAgent = new Map(scores.map((s) => [s.agentId, s]))

  return rows.map((row) => {
    const cached = scoreByAgent.get(row.agentId)
    const availability = row.status === 'LIVE' ? 1 : row.status === 'DEGRADED' ? 0.3 : 0

    return {
      id: row.id,
      category: row.category as Category,
      status: row.status,
      trustTier: (row.trustTier ?? 'Low') as TrustTier,
      capabilities: DEFAULT_CAPABILITIES[row.category as Category] ?? [],
      score: cached?.score ? Number(cached.score) * 100 : null,
      confidence: cached?.confidence ? Number(cached.confidence) : null,
      feeBps: DEFAULT_FEE_BPS,
      availability,
    }
  })
}

export async function loadListingById(db: DbClient, id: string) {
  const rows = await db.select().from(listings).where(eq(listings.id, id)).limit(1)
  return rows[0] ?? null
}

export async function loadListingByAgentId(db: DbClient, agentId: string) {
  const rows = await db.select().from(listings).where(eq(listings.agentId, agentId)).limit(1)
  return rows[0] ?? null
}
