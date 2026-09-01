import {
  Actions,
  Badge,
  Banner,
  Button,
  EmptyState,
  Note,
  OpenQuestion,
  PageHead,
  Panel,
  Prose,
  Scroller,
  Section,
  Shell,
} from '@repo/design-system/components'
import { notFound } from 'next/navigation'
import { ConsoleNav } from '../../../../components/console-nav'
import { findOwned } from '../../../../fixtures/listings'

/**
 * ② PROOF · E3 — sandbox test **trigger only**.
 *
 * The plan is explicit that this page is opt-in trigger copy and not a fork: no Anvil, no scenario
 * runner, no grading. What it does carry is the honest description of the mechanism, because the
 * mechanism is the reason an owner would agree to it — zero real funds, zero code changes, and
 * graded on the resulting position rather than on whether a transaction happened.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = findOwned(id)
  if (!listing) notFound()

  const passed = listing.sandboxAttempts.some((attempt) => attempt.outcome === 'PASSED')

  return (
    <Shell product="Builder Console" nav={<ConsoleNav />}>
      <PageHead
        pipeline="② PROOF"
        engine="E3 · Sandbox Proof"
        status="shell · trigger only"
        title="Sandbox test"
        meta={
          <>
            <Badge>{listing.name}</Badge>
            <Badge tone={passed ? 'live' : 'neutral'}>
              {passed ? 'Medium trust earned' : 'Medium not earned'}
            </Badge>
          </>
        }
        lede="Entirely optional, and it costs you nothing. Passing earns the Medium badge, which improves where you rank and what buyers see. Not taking it never stops anyone hiring you."
      />

      <Section
        title="What the test actually does"
        sub="Four properties, each of which is the reason an owner would agree to it."
      >
        <Panel>
          <Prose>
            <ul>
              <li>
                Forks BSC mainnet at the current block and <strong>perturbs it</strong> into an
                unambiguous scenario — a price move large enough that the right answer is not a
                judgement call.
              </li>
              <li>
                Hands your agent a session and lets it act exactly as it would for real money.{' '}
                <strong>You change nothing in your code.</strong>
              </li>
              <li>
                Grades the <strong>position you ended up with</strong>, not whether you sent a
                transaction. An agent that correctly does nothing passes; an agent that trades
                busily into a worse position does not.
              </li>
              <li>
                <strong>Zero real funds are involved.</strong> It is a fork. Nothing you do inside
                it touches mainnet.
              </li>
            </ul>
          </Prose>
        </Panel>
      </Section>

      <Section
        title="Attempts"
        sub="Failed attempts stay visible. Evidence is append-only — a failure is never deleted by a later pass, and buyers can see both."
      >
        {listing.sandboxAttempts.length === 0 ? (
          <EmptyState
            title="Never attempted"
            body="This agent has not been sandbox-tested. That is not a failure and not a low score —
              it is an option you have not taken."
          />
        ) : (
          <Scroller>
            <table className="ds-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Outcome</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {listing.sandboxAttempts.map((attempt) => (
                  <tr key={attempt.at}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {attempt.at.slice(0, 16).replace('T', ' ')}Z
                    </td>
                    <td>
                      <Badge tone={attempt.outcome === 'PASSED' ? 'live' : 'alert'}>
                        {attempt.outcome}
                      </Badge>
                    </td>
                    <td>{attempt.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        )}
      </Section>

      <Section title="Run it">
        <Panel>
          <Actions>
            <Button disabled title="E3 is not implemented — no fork is provisioned by this build.">
              Request a sandbox run
            </Button>
            <Badge tone="alert">E3 not built · no fork is provisioned</Badge>
          </Actions>
          <Note>Nothing is queued and no fork is provisioned by this build.</Note>
        </Panel>

        <div className="ds-subsection">
          <OpenQuestion id="01 §11">
            The <strong>grading thresholds are not set</strong>. How many graduated scenarios, what
            tolerance band counts as a pass, and what the per-category edge case is are all open
            tuning values. So is the rate limit on how often you may re-attempt — which exists to
            stop an owner farming attempts until one passes, and whose value is not yet chosen. This
            page will not display a pass mark it does not have.
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
