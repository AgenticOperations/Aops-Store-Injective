import {
  Badge,
  Banner,
  EmptyState,
  PageHead,
  Panel,
  Prose,
  Scroller,
  Section,
  Shell,
} from '@repo/design-system/components'
import { ConsoleNav } from '../../components/console-nav'

type Dispute = {
  id: string
  hireId: string
  listingName: string
  raisedAt: string
  state: 'OPEN' | 'RESOLVED'
  claim: string
}

/**
 * Read-only by construction (`plan` Chunk 3). E13 owns release, refund and dispute, and it is one of
 * only two engines that can lose someone money — so this surface displays and does nothing.
 */
const FIXTURE_DISPUTES: Dispute[] = [
  {
    id: 'dsp-001',
    hireId: 'hire-001',
    listingName: 'Wide Band CAKE/BNB',
    raisedAt: '2026-08-31T16:20:00Z',
    state: 'OPEN',
    claim: 'Buyer states the position was left out of range for 6h during a volatile window.',
  },
]

export default function Page() {
  const open = FIXTURE_DISPUTES.filter((d) => d.state === 'OPEN')

  return (
    <Shell product="Builder Console" nav={<ConsoleNav />}>
      <PageHead
        pipeline="④ TRANSACTION"
        engine="E13 · Settlement + Dispute"
        status="read-only shell"
        title="Disputes"
        meta={<Badge tone={open.length > 0 ? 'alert' : 'neutral'}>{open.length} open</Badge>}
        lede="Raised by buyers against a specific settled job. You cannot open, close or respond to one from this build."
      />

      <Banner tone="alert">
        <strong>Read-only.</strong> E13 is not implemented. Release, refund and dispute resolution
        all move real money, and this console has no path to any of them — it does not import the
        packages that could.
      </Banner>

      <Section title="Raised against your agents">
        {FIXTURE_DISPUTES.length === 0 ? (
          <EmptyState title="No disputes" body="Nothing has been contested against your agents." />
        ) : (
          <Scroller>
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Dispute</th>
                  <th>Agent</th>
                  <th>Hire</th>
                  <th>Raised</th>
                  <th>State</th>
                  <th>Claim</th>
                </tr>
              </thead>
              <tbody>
                {FIXTURE_DISPUTES.map((dispute) => (
                  <tr key={dispute.id}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{dispute.id}</td>
                    <td>{dispute.listingName}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{dispute.hireId}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {dispute.raisedAt.slice(0, 16).replace('T', ' ')}Z
                    </td>
                    <td>
                      <Badge tone={dispute.state === 'OPEN' ? 'alert' : 'neutral'}>
                        {dispute.state}
                      </Badge>
                    </td>
                    <td>{dispute.claim}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        )}
      </Section>

      <Section
        title="Why a dispute delays a review"
        sub="Settlement Reviews are evidence, and evidence is append-only."
      >
        <Panel>
          <Prose>
            <p>
              A Settlement Review is only created once a job reaches a genuinely final state — after
              the dispute window closes and any dispute resolves, not at first completion. A review
              posted while the outcome it rates is still contestable would be evidence about an
              unfinished result, and because evidence is append-only, it could never be taken back.
            </p>
          </Prose>
        </Panel>
      </Section>
    </Shell>
  )
}
