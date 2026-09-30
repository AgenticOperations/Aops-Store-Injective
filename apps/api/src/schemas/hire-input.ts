import { z } from '@hono/zod-openapi'
import type { Address } from 'viem'

export const TrustTierSchema = z.enum(['Low', 'Medium', 'High'])
export const RailSchema = z.enum(['ALTANA_SESSION', 'ERC8183_ESCROW'])

export const ScopeSchema = z.record(z.unknown()).default({})

export const HireBodySchema = z.object({
  listingId: z.string().uuid(),
  buyerMinimumTrustTier: TrustTierSchema.default('Low'),
  rail: RailSchema,
  scope: ScopeSchema,
})

export type HireBody = z.infer<typeof HireBodySchema>

const DEFAULT_ALLOWED = '0x0000000000000000000000000000000000000001' as Address
const DEFAULT_TOKEN = '0x0000000000000000000000000000000000000000' as Address

/** Map stored scope JSON into grantSession params for ALTANA_SESSION simulate mode. */
export function altanaGrantParamsFromScope(
  scope: Record<string, unknown>,
  authorizedWallet: Address,
) {
  const contractAllowlist = Array.isArray(scope.contractAllowlist)
    ? (scope.contractAllowlist as string[])
    : [DEFAULT_ALLOWED]

  const spendCap =
    scope.spendCap && typeof scope.spendCap === 'object'
      ? (scope.spendCap as { amount?: string; token?: string })
      : undefined

  const expiryRaw = scope.expiry
  const expiry =
    typeof expiryRaw === 'string' || typeof expiryRaw === 'number'
      ? new Date(expiryRaw)
      : new Date(Date.now() + 86_400_000)

  return {
    allowedCalls: contractAllowlist as Address[],
    spend: [
      {
        limit: BigInt(spendCap?.amount ?? '1000'),
        period: 'day' as const,
        token: (spendCap?.token ?? DEFAULT_TOKEN) as Address,
      },
    ],
    expiry,
    authorizedWallet,
  }
}
