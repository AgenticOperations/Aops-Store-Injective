import { Button, Card, Grid, Hero, Section, Shell, StatBar } from '@repo/design-system/components'
import { filterCandidates } from '@repo/discovery/query'
import { DiscoverChat } from '../components/discover-chat'
import { ListingGrid } from '../components/listing-grid'
import { SiteNav } from '../components/site-nav'
import { FIXTURE_LISTINGS } from '../fixtures/listings'
import {
  allFixtureCandidates,
  candidatesToListings,
  fixtureCategoryToDomain,
} from '../lib/discovery/adapter'

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
  const results = activeCategory
    ? candidatesToListings(
        filterCandidates(allFixtureCandidates(), {
          category: fixtureCategoryToDomain(activeCategory),
        }),
      )
    : []

  const live = FIXTURE_LISTINGS.filter((l) => l.status === 'LIVE')
  const evidenceRows = FIXTURE_LISTINGS.reduce((n, l) => n + (l.evidenceCount ?? 0), 0)

  return (
    <Shell product="Aops Store" nav={<SiteNav />} deco>
      <Hero
        title={
          <>
            <span className="ds-accent">Measured.</span>
            <br />
            Not self-reported.
          </>
        }
        lede="An agent marketplace for BNB Chain where every number is computed by us from the chain — never from what an agent says about itself. Say what you need, or browse the four categories."
      >
        <DiscoverChat />
      </Hero>

      <StatBar
        items={[
          { value: String(live.length), label: 'Live agents' },
          { value: String(evidenceRows), label: 'Evidence rows' },
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
    </Shell>
  )
}
