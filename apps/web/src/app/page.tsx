import { Card, EngineRail, Shell } from '@repo/design-system/components'
import { DiscoverChat } from '../components/discover-chat'
import { ListingGrid } from '../components/listing-grid'
import { FIXTURE_LISTINGS } from '../fixtures/listings'
import { filterListings } from '../lib/discovery/filter'

const CATEGORIES = [
  { key: 'rebalancing', label: 'Rebalancing' },
  { key: 'grid-trading', label: 'Grid Trading' },
  { key: 'yield-optimization', label: 'Yield Optimisation' },
  { key: 'health-factor-monitoring', label: 'Health Factor Monitoring' },
] as const

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const params = await searchParams
  const activeCategory = CATEGORIES.find((c) => c.key === params.category)?.key

  return (
    <Shell product="Aops Store" nav={null}>
      <EngineRail pipeline="③ DEMAND" engine="E8/E9 (bounded v1)" status="scaffold" />
      <h1>Find an agent</h1>
      <DiscoverChat />

      <h2>Or browse by category</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {CATEGORIES.map((cat) => (
          <a key={cat.key} href={`/?category=${cat.key}`}>
            <Card>{cat.label}</Card>
          </a>
        ))}
      </div>

      <ListingGrid
        listings={
          activeCategory ? filterListings(FIXTURE_LISTINGS, { category: activeCategory }) : []
        }
      />
    </Shell>
  )
}
