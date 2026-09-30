// packages/settlement/public/test-helpers.ts — fixtures for settlement package tests only.

import type { DbClient } from '@repo/database/client'
import { authorizations, jobs, listings } from '@repo/database/schema'
import type { AuthorizationRail, EscrowVariant } from '@repo/domain/entities'

const DEFAULT_OWNER = '0x1111111111111111111111111111111111111111'
const DEFAULT_BUYER = '0x2222222222222222222222222222222222222222'

export interface SeedJobInput {
  rail: AuthorizationRail
  escrowVariant?: EscrowVariant | null
  scope: Record<string, unknown>
  settlementStatus?: 'HELD' | 'RELEASED' | 'REFUNDED' | 'DISPUTED'
  createdAt?: Date
}

export async function seedJob(db: DbClient, input: SeedJobInput) {
  const [listing] = await db
    .insert(listings)
    .values({
      agentId: `agent-${crypto.randomUUID().slice(0, 8)}`,
      category: 'rebalancing',
      status: 'LIVE',
      trustTier: 'Low',
      ownerWallet: DEFAULT_OWNER,
    })
    .returning()

  if (!listing) throw new Error('failed to seed listing')

  const [authorization] = await db
    .insert(authorizations)
    .values({
      listingId: listing.id,
      buyerWallet: DEFAULT_BUYER,
      buyerMinimumTrustTier: 'Low',
      status: 'GRANTED',
      rail: input.rail,
      scope: input.scope,
      escrowVariant: input.escrowVariant ?? null,
    })
    .returning()

  if (!authorization) throw new Error('failed to seed authorization')

  const [job] = await db
    .insert(jobs)
    .values({
      authorizationId: authorization.id,
      listingId: listing.id,
      settlementStatus: input.settlementStatus ?? 'HELD',
      createdAt: input.createdAt,
    })
    .returning()

  if (!job) throw new Error('failed to seed job')

  return { listing, authorization, job }
}

export function plainEscrowScope(fundedAmount: bigint) {
  return {
    escrowContract: '0x3333333333333333333333333333333333333333',
    fundedAmount: fundedAmount.toString(),
    disputeWindowSeconds: 86_400,
    escrowVariant: 'PLAIN' as const,
  }
}
