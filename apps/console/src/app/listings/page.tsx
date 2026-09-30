import { Badge, Button, PageHead, Scroller, Section, Shell } from '@repo/design-system/components'
import { ConsoleNav } from '../../components/console-nav'
import { fetchAllOwnedListings } from '../../lib/listing-view'

export default async function Page() {
  const listings = await fetchAllOwnedListings()

  return (
    <Shell product="Builder Console" nav={<ConsoleNav />}>
      <PageHead
        pipeline="① SUPPLY"
        engine="E2 · Claim + Verify"
        status="live · API"
        title="Listings"
        meta={<Badge>{listings.length} rows</Badge>}
        lede="Everything registered under your wallet, plus anything the crawler found that might be yours."
      />

      <Section>
        <Scroller>
          <table className="ds-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Category</th>
                <th>State</th>
                <th>Trust</th>
                <th>Endpoint</th>
                <th>Evidence</th>
                <th>Hires</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing.id}>
                  <td>
                    <strong>{listing.name}</strong>
                    <div
                      style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-muted)' }}
                    >
                      {listing.id}
                    </div>
                  </td>
                  <td>{listing.category}</td>
                  <td>
                    <Badge tone={listing.status === 'LIVE' ? 'live' : 'warn'}>
                      {listing.status}
                    </Badge>
                  </td>
                  <td>{listing.trustTier}</td>
                  <td>
                    <Badge tone={listing.syncStatus === 'LIVE' ? 'live' : 'alert'}>
                      {listing.syncStatus.toLowerCase()}
                    </Badge>
                  </td>
                  <td className="is-num">
                    {listing.evidenceCount === null ? 'none yet' : listing.evidenceCount}
                  </td>
                  <td className="is-num">{listing.activeHires}</td>
                  <td>
                    <Button href={`/listings/${listing.id}`} variant="ghost">
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroller>
      </Section>
    </Shell>
  )
}
