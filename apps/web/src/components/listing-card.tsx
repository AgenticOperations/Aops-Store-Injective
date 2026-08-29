// apps/web/src/components/listing-card.tsx
import { Badge, Card, Stat } from '@repo/design-system/components'
import type { Listing } from '../fixtures/listings'

const TRUST_TONE = { Low: 'neutral', Medium: 'live', High: 'live' } as const

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong>{listing.name}</strong>
        <Badge tone={TRUST_TONE[listing.trustTier]}>{listing.trustTier} trust</Badge>
      </div>
      <p style={{ margin: 0, color: 'var(--ink-muted)' }}>{listing.summary}</p>
      {listing.evidenceCount === null ? (
        <Badge tone="warn">No track record yet</Badge>
      ) : (
        <Stat label="Evidence" value={String(listing.evidenceCount)} window="all-time" />
      )}
    </Card>
  )
}
