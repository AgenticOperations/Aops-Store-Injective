import { Button, Card, Grid, Section, StatBar } from '@repo/design-system/components'
import { HomeHero } from '../components/home-hero'
import { ListingGrid } from '../components/listing-grid'
import { SiteShell } from '../components/site-shell'
import { fetchCategoryListingViews, fetchMarketStats } from '../lib/api'

const CATEGORIES = [
  {
    key: 'rebalancing',
    label: 'Rebalancing',
    blurb: 'Keeps a liquidity position centred on price so it keeps earning fees.',
  },
  {
    key: 'grid-trading',
    label: 'Grid Trading',
    blurb: 'Places a ladder of orders across a range and works the swings between them.',
  },
  {
    key: 'yield-optimization',
    label: 'Yield Optimisation',
    blurb: 'Moves supplied collateral to the best rate when the spread beats the gas.',
  },
  {
    key: 'health-factor-monitoring',
    label: 'Health Factor Monitoring',
    blurb: 'Watches a borrow position and repays from a buffer before it can be liquidated.',
  },
] as const

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const params = await searchParams
  const activeCategory = CATEGORIES.find((c) => c.key === params.category)?.key
  const activeLabel = CATEGORIES.find((c) => c.key === activeCategory)?.label

  const [results, stats] = await Promise.all([
    activeCategory ? fetchCategoryListingViews(activeCategory) : Promise.resolve([]),
    fetchMarketStats().catch(() => ({ liveCount: 0, evidenceRows: 0 })),
  ])

  return (
    <SiteShell deco>
      <HomeHero
        title={
          <>
            <span className="ds-accent">Find Agents.</span>
           
          </>
        }
        lede="Find agents. Trust the chain. Built for BNB"
      />

      <StatBar
        items={[
          { value: String(stats.liveCount), label: 'Live agents' },
          { value: String(stats.evidenceRows), label: 'Evidence rows' },
          { value: '4', label: 'Categories' },
          { value: '0', label: 'Self-reported figures' },
        ]}
      />

      <Section
        title="Browse by category"
        sub="Four categories, measured on four different things. Agents are only ever compared within one of them."
      >
        <Grid cols={4}>
          {CATEGORIES.map((cat) => (
            <Card key={cat.key} href={`/?category=${cat.key}`} active={cat.key === activeCategory}>
              <strong style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.02em' }}>
                {cat.label}
              </strong>
              <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 14 }}>{cat.blurb}</p>
            </Card>
          ))}
        </Grid>
      </Section>

      {activeCategory && (
        <Section
          title={`${activeLabel} agents`}
          sub={
            results.length === 0
              ? 'Nothing live in this category yet.'
              : `${results.length} live and hireable now. Trust tier changes where they rank — it never blocks a hire.`
          }
          action={
            results.length >= 2 ? (
              <Button href={`/compare?ids=${results.map((l) => l.id).join(',')}`} variant="ghost">
                Compare all {results.length}
              </Button>
            ) : null
          }
        >
          <ListingGrid listings={results} />
        </Section>
      )}
    </SiteShell>
  )
}
