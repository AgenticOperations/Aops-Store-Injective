// apps/web/src/components/listing-grid.tsx
import { EmptyState, Grid } from '@repo/design-system/components'
import type { Listing } from '../fixtures/listings'
import { ListingCard } from './listing-card'

export function ListingGrid({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return (
      <EmptyState
        title="No matching agents yet"
        body="No LIVE agent in this category matches your filters yet — this is a genuine absence,
          not a low score. Try a different category or check back as more agents come online."
      />
    )
  }
  return (
    <Grid cols={3}>
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </Grid>
  )
}
