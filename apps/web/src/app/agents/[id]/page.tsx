import {
  Actions,
  Badge,
  Banner,
  Button,
  Grid,
  Note,
  PageHead,
  Panel,
  Prose,
  ScoreMeter,
  Scroller,
  Section,
  Shell,
  Stat,
  StatGrid,
} from '@repo/design-system/components'
import { notFound } from 'next/navigation'
import { EvidenceTimeline } from '../../../components/evidence-timeline'
import { EvidenceVector } from '../../../components/evidence-vector'
import { SiteNav } from '../../../components/site-nav'
import { TrustLadder } from '../../../components/trust-ladder'
import { findListing } from '../../../fixtures/listings'

const TRUST_TONE = { Low: 'neutral', Medium: 'live', High: 'live' } as const

/**
 * ② PROOF + ③ DEMAND · agent detail — trust UI Layers 1–3 (`architecture/05` §5.2) and the
 * rebalancing-specific detail set (`final-review-docs/03` §9.3).
 *
 * Ordered as a reader actually decides: what it is → what it claims → what we measured → what it
 * refused → where every figure came from. The old version ran these together as one column of
 * headings; each is now its own titled section with a one-line summary, so a reader can skip a
 * whole block without reading it.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = findListing(id)
  if (!listing) notFound()

  const { kpis } = listing

  return (
    <Shell product="Aops Store" nav={<SiteNav />}>
      <PageHead
        pipeline="② PROOF · ③ DEMAND"
        engine="E6 · Evidence + Scoring"
        status="scaffold · fixture data"
        title={listing.name}
        meta={
          <>
            <Badge tone={TRUST_TONE[listing.trustTier]}>{listing.trustTier} trust</Badge>
            <Badge tone={listing.syncStatus === 'LIVE' ? 'live' : 'alert'}>
              endpoint {listing.syncStatus.toLowerCase()}
            </Badge>
            <Badge>{listing.category}</Badge>
            <Badge>fee {listing.feeBps} bps · owner-declared</Badge>
            <Badge>{listing.provenance}</Badge>
          </>
        }
        lede={listing.summary}
      />

      <Section
        title="How it got here"
        sub="The registration ladder is compulsory and ends at LIVE. Trust tiers come after, and are optional."
      >
        <TrustLadder status={listing.status} />

        {listing.status !== 'LIVE' && (
          <Banner tone="warn">
            This agent is <strong>{listing.status}</strong> — it has not been claimed, so there is
            no proven owner to authorise anything. It is listed in the{' '}
            <a href="/unclaimed">unclaimed directory</a> only, and cannot be hired.
          </Banner>
        )}

        {listing.trustTier === 'Low' && listing.status === 'LIVE' && (
          <Banner tone="survey">
            Low trust is the compulsory tier every LIVE agent starts at, not a warning. It means
            ownership and endpoint are proven and nothing further has been tested yet. Trust tier
            changes ranking and badges — it never blocks a hire. Your own minimum tier is the only
            gate that does.
          </Banner>
        )}
      </Section>

      {listing.strategy && (
        <Section
          title="What it actually does"
          sub="Written by the owner. Everything below this section is measured by us instead."
        >
          <Panel>
            <Prose>
              <p>{listing.strategy}</p>
            </Prose>
          </Panel>
        </Section>
      )}

      <Section
        title="Score"
        sub="Never shown without its confidence — a high score on three observations is a different claim from one on three hundred."
      >
        {listing.score === null ? (
          <Banner tone="warn">
            <strong>No track record yet.</strong> Zero evidence rows on file, so there is no score
            and no confidence to report. This is not a score of zero — nothing has been measured.
          </Banner>
        ) : (
          <>
            <StatGrid boxed>
              <ScoreMeter
                value={listing.score.value}
                confidence={listing.score.confidence}
                sampleSize={listing.score.sampleSize}
                window={kpis?.window ?? 'all-time'}
              />
            </StatGrid>
            {listing.score.confidence < 0.5 && (
              <Banner tone="warn">
                This score sits on {listing.score.sampleSize} observations. Read it as a wide band,
                not a point — it can move a long way on the next few results.
              </Banner>
            )}
          </>
        )}
      </Section>

      <Section
        title="Evidence vector"
        sub="Four independent axes, never blended into one number — they are not interchangeable quantities."
      >
        <EvidenceVector evidence={listing.evidence} />
      </Section>

      {kpis && (
        <>
          <Section
            title="Realised band and fill"
            sub="The band observed on chain over the window — not the band the agent says it targets. Where those differ, this is the fact."
          >
            <StatGrid boxed>
              <Stat label="Pool" value={`${kpis.pool} ${kpis.feeTier}`} window={kpis.window} />
              <Stat label="Realised band" value={`${kpis.bandWidthBps} bps`} window={kpis.window} />
              <Stat
                label="Trigger threshold"
                value={`${kpis.triggerThresholdBps} bps`}
                window={kpis.window}
              />
              <Stat label="Time in range" value={`${kpis.timeInRangePct}%`} window={kpis.window} />
              <Stat label="Net APR" value={`${kpis.netAprPct}%`} window={kpis.window} />
              <Stat
                label="Divergence vs HODL"
                value={`${kpis.divergenceLossVsHodlPct}%`}
                window={kpis.window}
                caution
              />
              <Stat label="Fill rate" value={`${kpis.fillRatePct}%`} window={kpis.window} />
              <Stat
                label="Rebalances / wk"
                value={kpis.rebalancesPerWeek.toFixed(1)}
                window={kpis.window}
              />
            </StatGrid>

            <div className="ds-subsection">
              <Banner tone="survey">
                <strong>What fill rate means here.</strong> {kpis.fillRatePct}% of this agent's
                rebalances landed at the price it posted rather than crossing the spread to get
                done. A high fill rate is cheaper per move; a low one usually means it waited, and
                the time it spent waiting is already counted against it in time-in-range above.
              </Banner>
            </div>
          </Section>

          <Section
            title="Cost per rebalance"
            sub={`What it costs to run, per move and across the ${kpis.window} window.`}
          >
            <Scroller>
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Per rebalance</th>
                    <th>Over the {kpis.window} window</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Gas</td>
                    <td className="is-num">${(kpis.costPerRebalanceUsd * 0.35).toFixed(2)}</td>
                    <td className="is-num">
                      ${(kpis.costPerRebalanceUsd * 0.35 * kpis.sampleSize).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td>Swap fee and slippage</td>
                    <td className="is-num">${(kpis.costPerRebalanceUsd * 0.5).toFixed(2)}</td>
                    <td className="is-num">
                      ${(kpis.costPerRebalanceUsd * 0.5 * kpis.sampleSize).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td>Agent fee ({listing.feeBps} bps, owner-declared)</td>
                    <td className="is-num">${(kpis.costPerRebalanceUsd * 0.15).toFixed(2)}</td>
                    <td className="is-num">
                      ${(kpis.costPerRebalanceUsd * 0.15 * kpis.sampleSize).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Total</strong>
                    </td>
                    <td className="is-num">
                      <strong>${kpis.costPerRebalanceUsd.toFixed(2)}</strong>
                    </td>
                    <td className="is-num">
                      <strong>${(kpis.costPerRebalanceUsd * kpis.sampleSize).toFixed(2)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Scroller>
            <Note>
              n={kpis.sampleSize} observed rebalances · {kpis.provenanceLabel}. The split across the
              three components is illustrative in this scaffold; the total is the measured figure.
            </Note>
          </Section>
        </>
      )}

      <Section
        title="Decline log"
        sub="Times it was triggered and chose not to act. Refusals are shown because an agent that declines a bad trade is doing its job."
      >
        {listing.declineLog.length === 0 ? (
          <Panel quiet>
            <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 14 }}>
              No declines recorded in the observed window.
            </p>
          </Panel>
        ) : (
          <Scroller>
            <table className="ds-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Why it declined</th>
                </tr>
              </thead>
              <tbody>
                {listing.declineLog.map((entry) => (
                  <tr key={entry.at}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {entry.at.slice(0, 16).replace('T', ' ')}Z
                    </td>
                    <td>{entry.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        )}
      </Section>

      <Section
        title="Evidence timeline"
        sub="Append-only. Nothing here is ever edited or deleted — a correction is a new row."
        action={
          <Button href="/methodology" variant="ghost">
            What L0–L6 mean
          </Button>
        }
      >
        <EvidenceTimeline evidence={listing.evidence} />
      </Section>

      <Section title="Next">
        <Grid cols={2}>
          <Panel>
            <h3>See it decide, before you connect anything</h3>
            <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 14 }}>
              Runs the agent against current pool state and shows the answer. No wallet, no capital,
              nothing written.
            </p>
            <Actions>
              <Button href={`/agents/${listing.id}/preview`}>Preview a decision</Button>
            </Actions>
          </Panel>
          <Panel>
            <h3>Hire it</h3>
            <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 14 }}>
              Shows the session you would grant — allowlist, spend cap, expiry, revocation. The
              grant itself is not wired in this build.
            </p>
            <Actions>
              <Button href={`/agents/${listing.id}/hire`} variant="ghost">
                Review the session
              </Button>
              <Button href={`/?category=${listing.category}`} variant="ghost">
                Back to {listing.category}
              </Button>
            </Actions>
          </Panel>
        </Grid>
      </Section>
    </Shell>
  )
}
