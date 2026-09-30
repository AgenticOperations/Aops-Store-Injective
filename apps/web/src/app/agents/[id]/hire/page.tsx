import {
  Actions,
  Badge,
  Banner,
  Button,
  ChipRow,
  Note,
  OpenQuestion,
  PageHead,
  Panel,
  Scroller,
  Section,

  Stat,
  StatGrid,
} from '@repo/design-system/components'
import { notFound } from 'next/navigation'
import { SiteShell } from '../../../../components/site-shell'

import { fetchListingView } from '../../../../lib/listing-view'
import type { TrustTier } from '../../../../fixtures/listings'

const TIER_RANK: Record<TrustTier, number> = { Low: 0, Medium: 1, High: 2 }
const TIERS: TrustTier[] = ['Low', 'Medium', 'High']

/**
 * ④ TRANSACTION · E11 — **NOT WIRED.**
 *
 * This page renders the session a buyer would grant and then stops. There is no wallet connect, no
 * `grantSession`, and no button that pretends to sign — a control that looks like it signs and does
 * not is worse than an obviously dead one, because the buyer cannot tell which parts of the page
 * they are allowed to believe.
 *
 * Two things it does render honestly:
 *   - **The gate.** The buyer's own stated minimum tier is the only hiring gate in the system
 *     (`final-review-docs/01` §5.1). When it fails, §5.3's failure path requires the required and
 *     current tier shown side by side, not a generic error.
 *   - **The open question.** Where `commercial_config` and the capital ceiling live is an undecided
 *     architectural gap (`01` §12). Hard stop 6 says render the question rather than pick a default.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ minTier?: string }>
}) {
  const { id } = await params
  const { minTier } = await searchParams
  const listing = await fetchListingView(id)
  if (!listing) notFound()

  const buyerMinimum = TIERS.find((tier) => tier === minTier) ?? 'Low'
  const gatePasses = TIER_RANK[listing.trustTier] >= TIER_RANK[buyerMinimum]
  const notClaimed = listing.status !== 'LIVE'

  return (
    <SiteShell>
      <PageHead
        pipeline="④ TRANSACTION"
        engine="E11 · Risk + Permission"
        status="NOT WIRED"
        title={`Hire ${listing.name}`}
        meta={
          <>
            <Badge tone="alert">E11 not wired</Badge>
            <Badge>{listing.trustTier} trust</Badge>
            <Badge>{listing.category}</Badge>
          </>
        }
        lede="Everything below shows what the authorisation would contain. Nothing on this page can move funds, and no control here signs anything."
      />

      {notClaimed && (
        <Banner tone="alert">
          <strong>{listing.name} has no proven owner.</strong> It is still {listing.status} in the{' '}
          <a href="/unclaimed">unclaimed directory</a>. Even with E11 wired, there would be nobody
          to authorise.
        </Banner>
      )}

      <Section
        title="Your trust floor"
        sub="The only thing that can block a hire. The platform never refuses on your behalf because an agent's tier is low — that is your call."
      >
        <ChipRow>
          {TIERS.map((tier) => (
            <a
              key={tier}
              href={`/agents/${listing.id}/hire?minTier=${tier}`}
              className={tier === buyerMinimum ? 'ds-chip is-active' : 'ds-chip'}
            >
              Minimum: {tier}
            </a>
          ))}
        </ChipRow>

        <div className="ds-subsection">
          <StatGrid boxed>
            <Stat label="You require" value={buyerMinimum} window="this session" />
            <Stat
              label="This agent has"
              value={listing.trustTier}
              window="current"
              caution={!gatePasses}
            />
          </StatGrid>
        </div>

        <div className="ds-subsection">
          {gatePasses ? (
            <Banner tone="survey">
              Gate passes — {listing.trustTier} meets your {buyerMinimum} floor.
            </Banner>
          ) : (
            <Banner tone="alert">
              <strong>Gate fails.</strong> You require {buyerMinimum}; this agent is{' '}
              {listing.trustTier}. On the live system the session grant is not offered at all in
              this state — you would not see a button that then errors. Lower your floor, or pick a{' '}
              <a href={`/?category=${listing.category}`}>different {listing.category} agent</a>.
            </Banner>
          )}
        </div>
      </Section>

      <Section
        title="The session you would grant"
        sub={
          '"This agent cannot withdraw your principal" is true because the session forbids it, not because the agent’s code is polite.'
        }
      >
        <Scroller>
          <table className="ds-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Value</th>
                <th>What it prevents</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Contract allowlist</td>
                <td>{listing.capabilities.join(', ')}</td>
                <td>
                  Any call to a contract not on this list reverts, whatever the agent intends.
                </td>
              </tr>
              <tr>
                <td>Spend cap</td>
                <td className="is-num">500 USDC</td>
                <td>The most this session can move in total, across every call it makes.</td>
              </tr>
              <tr>
                <td>Expiry</td>
                <td className="is-num">72 hours</td>
                <td>
                  The session stops working on its own. Forgetting to revoke is not a failure mode.
                </td>
              </tr>
              <tr>
                <td>Revocation</td>
                <td>One transaction, any time</td>
                <td>You do not need the agent's cooperation to end this.</td>
              </tr>
            </tbody>
          </table>
        </Scroller>

        <div className="ds-subsection">
          <Banner tone="survey">
            <strong>Simulate by default, testnet until promoted.</strong> Every capital-touching
            action runs in simulate mode against testnet first — for every agent, at every tier,
            identically. A High-trust agent's hundredth job goes through the same door as a
            Low-trust agent's first.
          </Banner>
        </div>
      </Section>

      <Section title="Grant">
        <Panel>
          <Actions>
            <Button
              disabled
              title="E11 is not implemented — no session can be granted from this build."
            >
              Grant session
            </Button>
            <Badge tone="alert">nothing is signed</Badge>
          </Actions>
          <Note>
            There is deliberately no "Connect wallet" button on this page. Asking for a wallet
            connection that cannot lead to a grant would collect a permission we have no use for.
          </Note>
        </Panel>

        <div className="ds-subsection">
          <OpenQuestion id="01 §12">
            Where <code>commercial_config</code> lives is undecided. Max position size, max daily
            transaction count, max slippage and the auto-pause threshold used to be set inside
            blocking review states that no longer exist, and no replacement home has been agreed.
            The leaning proposal — an owner-editable field capped by a formula-driven platform
            ceiling enforced at session-grant time — is <strong>not confirmed</strong>. So this page
            shows a spend cap and shows you that the number above it is not yet governed by
            anything.
          </OpenQuestion>
        </div>

        <div className="ds-subsection">
          <Actions>
            <Button href={`/agents/${listing.id}/preview`} variant="ghost">
              See what it would decide first
            </Button>
            <Button href={`/agents/${listing.id}`} variant="ghost">
              Back to evidence
            </Button>
          </Actions>
        </div>
      </Section>
    </SiteShell>
  )
}
