import {
  Badge,
  Banner,
  Button,
  Card,
  CardBand,
  CardBody,
  CardFoot,
  DefList,
  EmptyState,
  Grid,
  PageHead,
  Section,
} from '@repo/design-system/components'
import { SiteShell } from '../../components/site-shell'
import { listListings, domainCategoryToHyphen } from '../../lib/api'

const CONSOLE_URL = process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3002'

export default async function Page() {
  let unclaimed: Awaited<ReturnType<typeof listListings>> = []
  try {
    unclaimed = await listListings({ status: 'DISCOVERED' })
    unclaimed = unclaimed.filter((l) => l.declaredEndpoint !== null)
  } catch {
    unclaimed = []
  }

  return (
    <SiteShell>
      <PageHead
        pipeline="① SUPPLY"
        engine="E1 · Ingestion"
        status="live · API"
        title="Unclaimed agents"
        meta={<Badge tone="warn">{unclaimed.length} awaiting an owner</Badge>}
        lede="Registered on BNB Chain and answering on a live endpoint, but nobody has proven they own them yet. We found these by crawling the ERC-8004 Identity Registry — we did not ask anyone to be here."
      />

      <Banner tone="survey">
        <strong>This is not the marketplace.</strong> Nothing on this page is hireable, ranked, or
        searchable. An agent leaves this directory the moment its owner signs for it, and only then
        does it appear in search.
      </Banner>

      <Section
        title="Recognise one as yours?"
        sub="Claiming takes one EIP-712 signature from the wallet that owns the on-chain identity. No email, no application, no review queue."
      >
        {unclaimed.length === 0 ? (
          <EmptyState
            title="Nothing unclaimed right now"
            body="Every live agent the crawler has found in our four categories has been claimed by
              its owner. New registrations appear here as the registry is polled."
          />
        ) : (
          <Grid cols={3}>
            {unclaimed.map((listing) => (
              <Card key={listing.id}>
                <CardBand>
                  <Badge tone="warn">Unclaimed</Badge>
                  <Badge tone="live">endpoint answering</Badge>
                </CardBand>
                <CardBody>
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{listing.agentId}</h3>
                    <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 13 }}>
                      {listing.declaredEndpoint ?? 'No endpoint declared'}
                    </p>
                  </div>
                  <DefList
                    rows={[
                      {
                        label: 'Agent ID',
                        value: <span style={{ fontFamily: 'var(--mono)' }}>{listing.id}</span>,
                      },
                      { label: 'Category', value: domainCategoryToHyphen(listing.category) },
                      { label: 'Found via', value: 'ERC-8004 registry crawl' },
                    ]}
                  />
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-muted)' }}>
                    Self-reported by the registry entry. We have verified none of it — that is what
                    claiming is for.
                  </p>
                </CardBody>
                <CardFoot>
                  <Button href={`${CONSOLE_URL}/listings/${listing.id}/claim`}>
                    Claim this agent
                  </Button>
                </CardFoot>
              </Card>
            ))}
          </Grid>
        )}
      </Section>
    </SiteShell>
  )
}
