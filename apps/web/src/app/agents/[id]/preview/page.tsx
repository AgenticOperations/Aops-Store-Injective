import {
  Actions,
  Badge,
  Banner,
  Button,
  EmptyState,
  Note,
  PageHead,
  Panel,
  Scroller,
  Section,

  Stat,
  StatGrid,
} from '@repo/design-system/components'
import { notFound } from 'next/navigation'
import { SiteShell } from '../../../../components/site-shell'

import { findListing } from '../../../../fixtures/listings'
import { FIXTURE_PREVIEWS } from '../../../../fixtures/preview'

/**
 * ③ DEMAND · E10 — Preview / Simulate before any wallet connection (`final-review-docs/03` §9.4).
 *
 * The whole point of this route is what it does *not* do. It runs `DECIDE` and renders the answer.
 * There is no `ACT`, no `RECORD`, no wallet prompt, and no state written anywhere — which is only
 * possible because `DECIDE` is specified as pure (`architecture/04` §4.2). A buyer sees the actual
 * output of the thing they are considering paying for before they are asked for anything at all.
 *
 * A `HOLD` renders exactly as prominently as an `ACT`. An agent that correctly declines to trade is
 * demonstrating judgement, and a preview that only looked impressive when it moved would train
 * buyers to prefer the agents that churn.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = findListing(id)
  if (!listing) notFound()

  const preview = FIXTURE_PREVIEWS[id]

  return (
    <SiteShell>
      <PageHead
        pipeline="③ DEMAND"
        engine="E10 · Simulate"
        status="scaffold · fixture DECIDE output"
        title={`What ${listing.name} would do right now`}
        meta={
          preview ? (
            <>
              <Badge tone={preview.action === 'ACT' ? 'survey' : 'neutral'}>
                would {preview.action === 'ACT' ? 'act' : 'hold'}
              </Badge>
              <Badge>observed {preview.observedAt.slice(0, 16).replace('T', ' ')}Z</Badge>
            </>
          ) : null
        }
        lede="No wallet, no capital, no transaction. This asks the agent for a decision and shows you the answer. Nothing is signed, nothing is broadcast, and no record of it is written to its evidence timeline."
      />

      {!preview ? (
        <Section title="No decision available">
          <EmptyState
            title="Not asked in this scaffold"
            body="On the live system a preview is generated on demand against current pool state."
          />
        </Section>
      ) : (
        <>
          <Section
            title="What we showed it"
            sub="Our readings, not the agent's — it is answering about a state you and it can both check."
          >
            <StatGrid boxed>
              {preview.poolState.map((entry) => (
                <Stat
                  key={entry.label}
                  label={entry.label}
                  value={entry.value}
                  window="at observation"
                />
              ))}
            </StatGrid>
          </Section>

          <Section title="What it decided">
            <div
              style={{
                borderLeft: `3px solid ${
                  preview.action === 'ACT' ? 'var(--gold)' : 'var(--ink-muted)'
                }`,
              }}
            >
              <Panel>
                <h3 style={{ fontSize: '1.15rem' }}>{preview.headline}</h3>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    display: 'grid',
                    gap: 'var(--s2)',
                    fontSize: 14,
                  }}
                >
                  {preview.reasoning.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Panel>
            </div>
          </Section>

          <Section
            title="Calls it would make"
            sub={
              preview.wouldBeCalls.length === 0
                ? 'None — it decided to hold, so there is nothing to send.'
                : 'The exact contracts and methods this decision resolves to.'
            }
          >
            {preview.wouldBeCalls.length > 0 && (
              <Scroller>
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Contract</th>
                      <th>Method</th>
                      <th>What it does</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.wouldBeCalls.map((call) => (
                      <tr key={`${call.contract}-${call.method}`}>
                        <td>{call.contract}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{call.method}</td>
                        <td>{call.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scroller>
            )}
            {preview.estimatedCostUsd !== null && (
              <div className="ds-subsection">
                <StatGrid boxed>
                  <Stat
                    label="Estimated cost of this move"
                    value={`$${preview.estimatedCostUsd.toFixed(2)}`}
                    window="at observation"
                  />
                </StatGrid>
              </div>
            )}
            {preview.action === 'HOLD' && (
              <Note>
                Holding is a result, not a missing one. This agent was asked and answered.
              </Note>
            )}
          </Section>
        </>
      )}

      <Section title="Next">
        <Banner tone="survey">
          You have now seen what it decides without giving it anything. The next page shows exactly
          what a session would let it do.
        </Banner>
        <div className="ds-subsection">
          <Actions>
            <Button href={`/agents/${listing.id}/hire`}>Review the session</Button>
            <Button href={`/agents/${listing.id}`} variant="ghost">
              Back to evidence
            </Button>
          </Actions>
        </div>
      </Section>
    </SiteShell>
  )
}
