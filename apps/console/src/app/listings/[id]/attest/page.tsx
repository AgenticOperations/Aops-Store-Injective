import {
  Actions,
  Badge,
  Banner,
  Button,
  Grid,
  Note,
  OpenQuestion,
  PageHead,
  Panel,
  Section,
  Shell,
} from '@repo/design-system/components'
import { notFound } from 'next/navigation'
import { ConsoleNav } from '../../../../components/console-nav'
import { fetchOwnedListing } from '../../../../lib/listing-view'

/**
 * ② PROOF · E4 — attestation, **labelled as an open product call** per the plan.
 *
 * Two things on this page are decided and one is not, and the page has to keep them apart:
 *
 * *Decided:* the marketplace never funds a real capital-bearing test job, for any agent, under any
 * circumstance. High trust is earned either organically (a real buyer's job) or by the owner funding
 * their own showcase with their own money. That hard rule is what stops High trust from being
 * something we can manufacture on an agent's behalf.
 *
 * *Not decided:* the self-dealing guard currently checks the evaluator against identities the
 * **marketplace** controls, not identities the **owner** controls — so on the owner-funded path an
 * owner who also runs an evaluator could certify their own execution. That is a live gap in the
 * strongest signal on the platform, and it is rendered on the page rather than hidden.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = await fetchOwnedListing(id)
  if (!listing) notFound()

  const hasMedium = listing.sandboxAttempts.some((attempt) => attempt.outcome === 'PASSED')

  return (
    <Shell product="Builder Console" nav={<ConsoleNav />}>
      <PageHead
        pipeline="② PROOF"
        engine="E4 · Attestation"
        status="shell · open product call"
        title="Independent attestation"
        meta={
          <>
            <Badge>{listing.name}</Badge>
            <Badge tone={listing.hasIndependentAttestation ? 'live' : 'neutral'}>
              {listing.hasIndependentAttestation ? 'High trust earned' : 'High not earned'}
            </Badge>
          </>
        }
        lede="The strongest signal on the platform: a real job, on mainnet, graded by a staked evaluator who is not us."
      />

      {!hasMedium && (
        <Banner tone="warn">
          <strong>Medium comes first.</strong> The free sandbox test exists so that nobody spends an
          evaluator's time — or your own capital — on an agent that has not cleared a fork.{' '}
          <a href={`/listings/${listing.id}/sandbox`}>Take the sandbox test</a> first.
        </Banner>
      )}

      <Section
        title="Two ways to earn it"
        sub="They differ only in who pays. The evaluation itself is identical, and independent either way."
      >
        <Grid cols={2}>
          <Panel>
            <h3>Organic</h3>
            <Badge>a real buyer pays</Badge>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-muted)' }}>
              Someone hires you for real money. The job is wrapped so an independent staked
              evaluator grades it. You do nothing except the work.
            </p>
          </Panel>
          <Panel>
            <h3>Owner-funded showcase</h3>
            <Badge tone="survey">you pay</Badge>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-muted)' }}>
              You fund a real mainnet job with your own capital. We orchestrate it and the evaluator
              check, and contribute zero tokens.
            </p>
          </Panel>
        </Grid>

        <div className="ds-subsection">
          <Banner tone="survey">
            <strong>We never fund a capital-bearing test job for anyone.</strong> Not for
            third-party agents, not for our own. If we paid for the evidence, the evidence would be
            about our money rather than about your agent — and an owner risking their own capital is
            a far more convincing signal than anything we could manufacture.
          </Banner>
        </div>
      </Section>

      <Section title="Start">
        <Panel>
          <Actions>
            <Button disabled title="E4 is an open product call — there is nothing to start yet.">
              Fund a showcase job
            </Button>
            <Badge tone="alert">E4 not built</Badge>
          </Actions>
          <Note>Two design questions below have to be answered before this path can ship.</Note>
        </Panel>

        <div className="ds-subsection" style={{ display: 'grid', gap: 'var(--s3)' }}>
          <OpenQuestion id="01 §12 · self-dealing">
            On the owner-funded path <strong>you</strong> are the client, not us. The existing
            self-dealing guard checks the evaluator against identities the <em>marketplace</em>{' '}
            controls — nothing currently checks it against identities the <em>owner</em> controls.
            An owner who also registers an evaluator identity could certify their own execution
            undetected. This is a real gap in the strongest trust signal on the platform, and the
            owner-funded path should not ship before the guard is extended.
          </OpenQuestion>
          <OpenQuestion id="01 §12 · L6 benchmark">
            Whether the TermiX Agent Advantage Report (a paired managed-vs-unmanaged benchmark, L6)
            counts as a route to High trust is undecided. §7 does not currently name it as an
            accepted evidence source, and merging it in silently is not an option we are taking.
          </OpenQuestion>
        </div>

        <div className="ds-subsection">
          <Actions>
            <Button href={`/listings/${listing.id}`} variant="ghost">
              Back to {listing.name}
            </Button>
          </Actions>
        </div>
      </Section>
    </Shell>
  )
}
