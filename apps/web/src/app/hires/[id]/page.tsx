import {
  Actions,
  Badge,
  Banner,
  Button,
  DefList,
  Note,
  PageHead,
  Panel,
  Section,
  Shell,
  Stat,
  StatGrid,
} from '@repo/design-system/components'
import { notFound } from 'next/navigation'
import { SiteNav } from '../../../components/site-nav'
import { findHire } from '../../../fixtures/hires'
import { findListing } from '../../../fixtures/listings'

/**
 * ④ TRANSACTION · E12 — the active-agent console (`final-review-docs/03` §9.6).
 *
 * §9.6 asks for a **visible revoke that works in one transaction**. Ring 3 is not connected in this
 * scaffold, so the control is rendered disabled with the reason attached rather than omitted: a
 * buyer looking at this page needs to know the control exists and where it will be, and a page that
 * hides it until it works teaches them there is no way out.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hire = findHire(id)
  if (!hire) notFound()

  const listing = findListing(hire.listingId)
  const { position } = hire
  const capUsedPct = Math.round((hire.spentUsdc / hire.spendCapUsdc) * 100)

  return (
    <Shell product="Aops Store" nav={<SiteNav />}>
      <PageHead
        pipeline="④ TRANSACTION"
        engine="E12 · Hiring + Job"
        status="scaffold · read-only"
        title={listing?.name ?? hire.listingId}
        meta={
          <>
            <Badge tone="live">{hire.state}</Badge>
            <Badge>hire {hire.id}</Badge>
            <Badge>expires {hire.expiresAt.slice(0, 10)}</Badge>
          </>
        }
        lede="A session in flight — what the agent is doing, what it is allowed to do, and how to stop it."
      />

      <Banner tone="alert">
        <strong>This hire was not created by a real authorisation.</strong> E11 and E13 are not
        wired, so the session below is fixture data. No funds are at risk and nothing on this page
        reflects an on-chain position.
      </Banner>

      <Section
        title="Position right now"
        sub={
          position === null
            ? 'This agent watches rather than holds, so there is no position to display.'
            : 'Measured continuously from our own observation, not from the agent’s report.'
        }
      >
        {position === null ? (
          <Panel quiet>
            <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 14 }}>
              It has taken no action, which is the correct outcome so far.
            </p>
          </Panel>
        ) : (
          <>
            <StatGrid boxed>
              <Stat label="Pool" value={position.pool} window="live" />
              <Stat label="Current price" value={position.currentPrice} window="live" />
              <Stat
                label="Band"
                value={`${position.bandLower} – ${position.bandUpper}`}
                window="live"
              />
              <Stat
                label="Distance to trigger"
                value={`${position.distanceToTriggerBps} bps`}
                window="live"
              />
              <Stat
                label="Time in range so far"
                value={`${position.timeInRangePctSoFar}%`}
                window={position.observedFor}
              />
              <Stat
                label="Rebalances so far"
                value={String(position.rebalancesSoFar)}
                window={position.observedFor}
              />
              <Stat
                label="Cost to date"
                value={`$${position.costToDateUsd.toFixed(2)}`}
                window={position.observedFor}
                caution
              />
            </StatGrid>
            <Note>
              Measured over {position.observedFor} of this hire, not over the agent's all-time
              history — those are different numbers and this page shows the shorter one.
            </Note>
          </>
        )}
      </Section>

      <Section
        title="What this session allows"
        sub="Anything outside this list reverts. The agent cannot withdraw your principal because the session does not permit it."
      >
        <Panel>
          <DefList
            rows={[
              {
                label: 'Spend cap',
                value: `$${hire.spentUsdc.toFixed(2)} of $${hire.spendCapUsdc.toFixed(2)} used (${capUsedPct}%)`,
              },
              { label: 'Contracts', value: hire.allowlist.join(', ') },
              { label: 'Granted', value: `${hire.grantedAt.slice(0, 16).replace('T', ' ')}Z` },
              { label: 'Expires', value: `${hire.expiresAt.slice(0, 16).replace('T', ' ')}Z` },
            ]}
          />
        </Panel>
      </Section>

      <Section
        title="End this session"
        sub="One transaction on the live system, needing no cooperation from the agent."
      >
        <Panel>
          <Actions>
            <Button
              disabled
              title="Ring 3 not connected — @repo/custody is not imported by this app."
            >
              Revoke now
            </Button>
            <Badge tone="alert">Ring 3 not connected</Badge>
          </Actions>
          <Note>
            Shown here, disabled, because you should be able to see where the exit is before you
            need it — not because this build can perform it.
          </Note>
        </Panel>
      </Section>

      <Section
        title="Settlement and disputes"
        sub="Release, refund and dispute all live in E13, which is not implemented."
      >
        <Banner tone="warn">
          A settled hire would produce a Settlement Review — evidence bound to this specific job,
          authored by the buyer on it, and never a free-standing form.
        </Banner>
        <div className="ds-subsection">
          <Actions>
            {listing && (
              <Button href={`/agents/${listing.id}`} variant="ghost">
                View this agent's evidence
              </Button>
            )}
            <Button href="/" variant="ghost">
              Back to search
            </Button>
          </Actions>
        </div>
      </Section>
    </Shell>
  )
}
