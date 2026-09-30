import {
  Actions,
  Badge,
  Banner,
  Button,
  Card,
  CardBand,
  CardBody,
  CardFoot,
  Grid,
  Note,
  PageHead,
  Section,
  Shell,
  Stat,
  StatGrid,
} from '@repo/design-system/components'
import { ConsoleNav } from '../components/console-nav'
import { fetchAllOwnedListings } from '../lib/listing-view'

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'

export default async function Page() {
  const owned = await fetchAllOwnedListings()
  const live = owned.filter((l) => l.status === 'LIVE')
  const degraded = owned.filter((l) => l.syncStatus === 'DEGRADED')
  const unclaimed = owned.filter((l) => l.status === 'DISCOVERED')

  return (
    <Shell product="Builder Console" nav={<ConsoleNav />}>
      <PageHead
        pipeline="① SUPPLY · ⑤ OPERATE"
        engine="E2 · Claim · E14a · Liveness"
        status="live · API"
        title="Your agents"
        lede="This console constructs — it never signs. Claims are signed by your wallet, and anything that touches capital is carried out by a worker, not by this page."
      />

      <Section title="At a glance">
        <StatGrid boxed>
          <Stat label="Live listings" value={String(live.length)} window="now" />
          <Stat
            label="Active hires"
            value={String(live.reduce((n, l) => n + l.activeHires, 0))}
            window="now"
          />
          <Stat
            label="Degraded endpoints"
            value={String(degraded.length)}
            window="now"
            caution={degraded.length > 0}
          />
          <Stat label="Unclaimed" value={String(unclaimed.length)} window="now" />
        </StatGrid>

        {degraded.length > 0 && (
          <div className="ds-subsection">
            <Banner tone="alert">
              <strong>{degraded.length} endpoint not answering.</strong> A degraded agent stays
              listed and stays hireable — buyers see the degraded badge and decide for themselves.
              It recovers on its own once the endpoint responds again; nothing here needs your
              action to reverse it.
            </Banner>
          </div>
        )}

        {unclaimed.length > 0 && (
          <div className="ds-subsection">
            <Banner tone="survey">
              <strong>{unclaimed.length} agent found on chain but unclaimed.</strong> We crawled it
              from the ERC-8004 registry. If it is yours, one signature proves it and it goes live
              the same day — no application, no review queue.
            </Banner>
          </div>
        )}
      </Section>

      <Section
        title="Listings"
        sub="Everything registered under your wallet, plus anything the crawler found that might be yours."
        action={
          <Button href="/listings" variant="ghost">
            Open the full table
          </Button>
        }
      >
        {owned.length === 0 ? (
          <Banner tone="warn">
            No listings in the database yet. Self-register an agent or wait for the crawler to
            populate DISCOVERED rows.
          </Banner>
        ) : (
          <Grid cols={2}>
            {owned.map((listing) => (
              <Card key={listing.id}>
                <CardBand>
                  <Badge tone={listing.status === 'LIVE' ? 'live' : 'warn'}>{listing.status}</Badge>
                  <span style={{ display: 'flex', gap: 'var(--s2)' }}>
                    {listing.syncStatus === 'DEGRADED' && <Badge tone="alert">Degraded</Badge>}
                    <Badge>{listing.trustTier} trust</Badge>
                  </span>
                </CardBand>
                <CardBody>
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{listing.name}</h3>
                    <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 13 }}>
                      {listing.category}
                    </p>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                    {listing.evidenceCount === null
                      ? 'No evidence rows yet'
                      : `${listing.evidenceCount} evidence rows`}{' '}
                    · {listing.activeHires} active {listing.activeHires === 1 ? 'hire' : 'hires'}
                  </div>
                </CardBody>
                <CardFoot>
                  <Button href={`/listings/${listing.id}`}>Manage</Button>
                  {listing.status === 'LIVE' && (
                    <Button href={`${WEB_URL}/agents/${listing.id}`} variant="ghost">
                      Buyer view
                    </Button>
                  )}
                </CardFoot>
              </Card>
            ))}
          </Grid>
        )}
      </Section>
    </Shell>
  )
}
