// apps/web/src/components/listing-card.tsx
import {
  Badge,
  Button,
  Card,
  CardBand,
  CardBody,
  CardFoot,
  ScoreMeter,
  Stat,
} from '@repo/design-system/components'
import type { Listing } from '../fixtures/listings'

const TRUST_TONE = { Low: 'neutral', Medium: 'live', High: 'live' } as const

/**
 * Detail Layer 1 (`architecture/05` §5.2), laid out in the card's three zones.
 *
 * The zones are not styling — they separate three different kinds of claim that were previously
 * running together in one stack:
 *   **Band**  — what this agent *is* right now (trust tier, endpoint health). No performance claim.
 *   **Body**  — what we measured, always with its window and sample size attached.
 *   **Foot**  — labels and actions, behind a dashed rule so they never read as a measurement.
 *
 * `divergence_loss_vs_hodl` sits in the same grid cell size as net APR by contract: §7.2 treats
 * them as a pair, and a card showing the flattering half alone is the failure this set guards.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const { kpis } = listing
  return (
    <Card>
      <CardBand>
        <Badge tone={TRUST_TONE[listing.trustTier]}>{listing.trustTier} trust</Badge>
        <Badge tone={listing.syncStatus === 'LIVE' ? 'live' : 'alert'}>
          {listing.syncStatus === 'LIVE' ? 'endpoint live' : 'endpoint degraded'}
        </Badge>
      </CardBand>

      <CardBody>
        <div>
          <h3 style={{ marginBottom: 4 }}>{listing.name}</h3>
          <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 13, lineHeight: 1.5 }}>
            {listing.summary}
          </p>
        </div>

        {listing.score === null ? (
          <div>
            <Badge tone="warn">No track record yet</Badge>
            <p style={{ margin: '6px 0 0', color: 'var(--ink-muted)', fontSize: 13 }}>
              Hireable now. Nothing measured, so there is no score — an absence, not a low result.
            </p>
          </div>
        ) : (
          <ScoreMeter
            value={listing.score.value}
            confidence={listing.score.confidence}
            sampleSize={listing.score.sampleSize}
            window={kpis?.window ?? 'all-time'}
          />
        )}

        {kpis && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--s4)',
            }}
          >
            <Stat label="Time in range" value={`${kpis.timeInRangePct}%`} window={kpis.window} />
            <Stat
              label="Rebalances / wk"
              value={kpis.rebalancesPerWeek.toFixed(1)}
              window={kpis.window}
            />
            <Stat label="Net APR" value={`${kpis.netAprPct}%`} window={kpis.window} />
            <Stat
              label="Divergence vs HODL"
              value={`${kpis.divergenceLossVsHodlPct}%`}
              window={kpis.window}
              caution
            />
          </div>
        )}
      </CardBody>

      <CardFoot>
        <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap', flex: '1 1 auto' }}>
          <Badge>fee {listing.feeBps} bps</Badge>
          {kpis && <Badge>{kpis.pool}</Badge>}
        </div>
        <div style={{ display: 'flex', gap: 'var(--s2)', flexShrink: 0 }}>
          <Button href={`/agents/${listing.id}`}>Evidence</Button>
          <Button href={`/agents/${listing.id}/preview`} variant="ghost">
            Preview
          </Button>
        </div>
      </CardFoot>
    </Card>
  )
}
