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
      <p style={{ maxWidth: 560, margin: '0 0 24px', color: 'var(--ink-muted)', fontSize: 15 }}>
        Type what you need, or pick a category below — both search the same live agents.
      </p>
      <DiscoverChat />

      <h2>Or browse by category</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {CATEGORIES.map((cat) => (
          <Card key={cat.key} href={`/?category=${cat.key}`} active={cat.key === activeCategory}>
            {cat.label}
          </Card>
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
