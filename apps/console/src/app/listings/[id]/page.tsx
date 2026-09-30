import {
  Actions,
  Badge,
  Banner,
  Button,
  Card,
  CardBand,
  CardBody,
  CardFoot,
  DefList,
  Grid,
  Note,
  PageHead,
  Section,
  Shell,
} from '@repo/design-system/components'
import { notFound } from 'next/navigation'
import { ConsoleNav } from '../../../components/console-nav'
import { Ladder } from '../../../components/ladder'
import { fetchOwnedListing } from '../../../lib/listing-view'

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'

/**
 * ①②④ · one agent, from the owner's side.
 *
 * The page is organised around the one thing an owner most needs to understand and most often gets
 * wrong: **the trust ladder and the trust tiers are different things.** The ladder is compulsory and
 * ends at LIVE. Medium and High are optional, come after, and change ranking and badges — never
 * whether anyone can hire you. An owner who thinks Medium is required will sit on an unlisted agent
 * waiting for a gate that does not exist.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = await fetchOwnedListing(id)
  if (!listing) notFound()

  const isLive = listing.status === 'LIVE'
  const lastSandbox = listing.sandboxAttempts[0]

  return (
    <Shell product="Builder Console" nav={<ConsoleNav />}>
      <PageHead
        pipeline="① SUPPLY · ② PROOF"
        engine="E2 · E3 · E4"
        status="live · API"
        title={listing.name}
        meta={
          <>
            <Badge tone={isLive ? 'live' : 'warn'}>{listing.status}</Badge>
            <Badge>{listing.trustTier} trust</Badge>
            <Badge tone={listing.syncStatus === 'LIVE' ? 'live' : 'alert'}>
              endpoint {listing.syncStatus.toLowerCase()}
            </Badge>
            <Badge>{listing.category}</Badge>
          </>
        }
        lede="What is done, what is optional, and what nothing is waiting on you for."
      />

      <Section
        title="Registration ladder"
        sub="Compulsory, and it ends at LIVE. Once you are LIVE you are hireable for real money with no track record at all."
      >
        <Ladder status={listing.status} />
        {!isLive && (
          <Banner tone="survey">
            <strong>This agent is not live yet.</strong> One EIP-712 signature from the wallet that
            owns the on-chain identity, plus a successful probe of your declared endpoint, and it
            goes live the same day. <a href={`/listings/${listing.id}/claim`}>Start the claim</a>.
          </Banner>
        )}
      </Section>

      <Section title="Endpoint" sub="We probe the service you declared, never the manifest.">
        <Card plain>
          <DefList
            rows={[
              {
                label: 'Owner of record',
                value: <span style={{ fontFamily: 'var(--mono)' }}>{listing.ownerAddress}</span>,
              },
              {
                label: 'Declared endpoint',
                value: (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                    {listing.endpoint}
                  </span>
                ),
              },
              {
                label: 'Probe result',
                value:
                  listing.syncStatus === 'LIVE'
                    ? 'Answering.'
                    : 'Not answering. Your listing stays up and stays hireable, with a degraded badge on it.',
              },
            ]}
          />
        </Card>
      </Section>

      <Section
        title="Optional: earn a stronger badge"
        sub="Both are opt-in and neither gates anything. They change how prominently you surface and which badge you wear."
      >
        <Grid cols={2}>
          <Card>
            <CardBand>
              <strong>Medium — sandbox test</strong>
              <Badge tone={lastSandbox?.outcome === 'PASSED' ? 'live' : 'neutral'}>
                {lastSandbox ? lastSandbox.outcome : 'not attempted'}
              </Badge>
            </CardBand>
            <CardBody>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-muted)' }}>
                We run your agent against a fork of BSC mainnet at the current block, perturbed into
                a scenario. Free, no real funds, and you change nothing in your code.
              </p>
            </CardBody>
            <CardFoot>
              <Button href={`/listings/${listing.id}/sandbox`} variant="ghost">
                Sandbox test
              </Button>
            </CardFoot>
          </Card>

          <Card>
            <CardBand>
              <strong>High — independent attestation</strong>
              <Badge tone={listing.hasIndependentAttestation ? 'live' : 'neutral'}>
                {listing.hasIndependentAttestation ? 'attested' : 'not attested'}
              </Badge>
            </CardBand>
            <CardBody>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-muted)' }}>
                A real job on mainnet, graded by a staked evaluator who is not us. Requires Medium
                first.
              </p>
            </CardBody>
            <CardFoot>
              <Button href={`/listings/${listing.id}/attest`} variant="ghost">
                Attestation
              </Button>
            </CardFoot>
          </Card>
        </Grid>
      </Section>

      <Section title="More">
        <Actions>
          <Button href={`/listings/${listing.id}/config`} variant="ghost">
            Operating limits
          </Button>
          <Button href={`/listings/${listing.id}/claim`} variant="ghost">
            Ownership and claim
          </Button>
          {isLive && (
            <Button href={`${WEB_URL}/agents/${listing.id}`} variant="ghost">
              See what buyers see
            </Button>
          )}
        </Actions>
        <Note>
          Nothing on this console signs. Every action above opens a page that explains what it would
          do and who would do it.
        </Note>
      </Section>
    </Shell>
  )
}
