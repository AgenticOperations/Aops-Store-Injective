import {
  Actions,
  Badge,
  Banner,
  Button,
  ChipRow,
  PageHead,
  Scroller,
  Section,
} from '@repo/design-system/components'
import { SiteShell } from '../../components/site-shell'

import type { Listing } from '../../fixtures/listings'
import { DOMAIN_CATEGORIES, domainCategoryToHyphen } from '../../lib/api'
import { resolveComparison } from '../../lib/compare'

/** A row of the comparison table: one label, one reader per agent. */
type Row = {
  label: string
  read: (listing: Listing) => string
  /** Rendered in the caution colour — the cost side of a pair, never the flattering half alone. */
  caution?: boolean
}

const SHARED_ROWS: Row[] = [
  { label: 'Trust tier', read: (l) => `${l.trustTier}` },
  { label: 'Endpoint', read: (l) => l.syncStatus.toLowerCase() },
  { label: 'Fee (owner-declared)', read: (l) => `${l.feeBps} bps` },
  { label: 'Score', read: (l) => (l.score === null ? 'no track record yet' : `${l.score.value}`) },
  {
    label: 'Confidence',
    read: (l) =>
      l.score === null ? '—' : `${Math.round(l.score.confidence * 100)}% (n=${l.score.sampleSize})`,
  },
  {
    label: 'Evidence rows',
    read: (l) => (l.evidenceCount === null ? 'none yet' : `${l.evidenceCount}`),
  },
]

const REBALANCING_ROWS: Row[] = [
  { label: 'Pool', read: (l) => (l.kpis ? `${l.kpis.pool} ${l.kpis.feeTier}` : '—') },
  { label: 'Window', read: (l) => l.kpis?.window ?? '—' },
  { label: 'Band width', read: (l) => (l.kpis ? `${l.kpis.bandWidthBps} bps` : '—') },
  { label: 'Trigger', read: (l) => (l.kpis ? `${l.kpis.triggerThresholdBps} bps` : '—') },
  { label: 'Time in range', read: (l) => (l.kpis ? `${l.kpis.timeInRangePct}%` : '—') },
  { label: 'Net APR', read: (l) => (l.kpis ? `${l.kpis.netAprPct}%` : '—') },
  {
    label: 'Divergence vs HODL',
    read: (l) => (l.kpis ? `${l.kpis.divergenceLossVsHodlPct}%` : '—'),
    caution: true,
  },
  { label: 'Rebalances / wk', read: (l) => (l.kpis ? l.kpis.rebalancesPerWeek.toFixed(1) : '—') },
  { label: 'Fill rate', read: (l) => (l.kpis ? `${l.kpis.fillRatePct}%` : '—') },
  {
    label: 'Cost per rebalance',
    read: (l) => (l.kpis ? `$${l.kpis.costPerRebalanceUsd.toFixed(2)}` : '—'),
    caution: true,
  },
  { label: 'Sample size', read: (l) => (l.kpis ? `n=${l.kpis.sampleSize}` : '—') },
]

/**
 * ③ DEMAND · E10 — trust UI Layer 4 (`architecture/05` §5.2) and `03` §9.2.
 *
 * The page does no category checking of its own. It calls `resolveComparison`, and a cross-category
 * request comes back as a failure branch that has no `listings` field to render — the enforcement
 * is in the resolver's return type, which is what "enforced at the query layer, not just hidden in
 * the UI" has to mean to be worth anything.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const params = await searchParams
  const result = await resolveComparison(params.ids)

  return (
    <SiteShell>
      <PageHead
        pipeline="③ DEMAND"
        engine="E10 · Compare"
        status="live · API"
        title="Compare agents"
        meta={
          result.ok ? (
            <>
              <Badge>{result.category}</Badge>
              <Badge>{result.listings.length} agents</Badge>
            </>
          ) : (
            <Badge tone="alert">{result.reason}</Badge>
          )
        }
        lede="Agents are only ever compared within one category, because the categories are measured on different things."
      />

      {!result.ok ? (
        <>
          <Banner tone={result.reason === 'cross-category' ? 'alert' : 'warn'}>
            <strong>
              {result.reason === 'cross-category'
                ? 'These agents cannot be compared.'
                : 'Nothing to compare yet.'}
            </strong>{' '}
            {result.detail}
          </Banner>

          {result.reason === 'cross-category' && (
            <Section title="Why this is a rule, not a limitation">
              <div className="ds-prose">
                <p>
                  Agents in different categories are measured on different things — a rebalancer's
                  time-in-range and a health-factor monitor's liquidation count are not two values
                  of one quantity. A table that put them in adjacent columns would look
                  authoritative and mean nothing.
                </p>
              </div>
            </Section>
          )}

          <Section
            title="Pick a category to compare within"
            sub="Open a category, then use the compare action on the results."
          >
            <ChipRow>
              {DOMAIN_CATEGORIES.map((category) => (
                <a
                  key={category}
                  href={`/?category=${domainCategoryToHyphen(category)}`}
                  className="ds-chip"
                >
                  {domainCategoryToHyphen(category)}
                </a>
              ))}
            </ChipRow>
          </Section>
        </>
      ) : (
        <>
          {result.caveat && (
            <Banner tone="alert">
              <strong>Not directly comparable.</strong> {result.caveat}
            </Banner>
          )}

          <Section
            title="Side by side"
            sub={`${result.listings.length} agents in ${result.category}, on the same measures with the same windows shown.`}
          >
            <Scroller>
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Measure</th>
                    {result.listings.map((listing) => (
                      <th key={listing.id}>
                        <a href={`/agents/${listing.id}`}>{listing.name}</a>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...SHARED_ROWS,
                    ...(result.category === 'rebalancing' ? REBALANCING_ROWS : []),
                  ].map((row) => (
                    <tr key={row.label}>
                      <td style={{ color: 'var(--ink-muted)' }}>{row.label}</td>
                      {result.listings.map((listing) => (
                        <td
                          key={listing.id}
                          className="is-num"
                          style={row.caution ? { color: 'var(--alert)' } : undefined}
                        >
                          {row.read(listing)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroller>
          </Section>

          <Section
            title="Regime segmentation"
            sub="§9.2 requires these numbers split by market regime. The classifier is E5's work and is not built."
            action={<Badge tone="warn">Not built</Badge>}
          >
            <Banner tone="warn">
              A wide band wins in a trending market and loses in a ranging one, and a single blended
              figure hides exactly the difference a buyer is choosing between. This scaffold shows
              the blended figures above and says so, rather than segmenting on a classifier that
              does not exist yet.
            </Banner>
          </Section>

          <Section title="Next">
            <Actions>
              {result.listings.map((listing) => (
                <Button key={listing.id} href={`/agents/${listing.id}/preview`} variant="ghost">
                  Preview {listing.name}
                </Button>
              ))}
            </Actions>
          </Section>
        </>
      )}
    </SiteShell>
  )
}
