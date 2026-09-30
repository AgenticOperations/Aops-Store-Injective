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
} from '@repo/design-system/components'
import { SiteShell } from '../../../components/site-shell'
import { notFound } from 'next/navigation'

import { getJob } from '../../../lib/api'
import { fetchListingView } from '../../../lib/listing-view'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = await getJob(id)
  if (!job) notFound()

  const listing = await fetchListingView(job.listingId)

  return (
    <SiteShell>
      <PageHead
        pipeline="④ TRANSACTION"
        engine="E12 · Hiring + Job"
        status="live · API"
        title={listing?.name ?? job.providerAgentId}
        meta={
          <>
            <Badge tone="live">{job.executionStatus}</Badge>
            <Badge>hire {job.jobId.slice(0, 8)}…</Badge>
            <Badge>{job.settlementStatus}</Badge>
            <Badge>{job.rail}</Badge>
          </>
        }
        lede="A session in flight — what the agent is allowed to do, and how to stop it."
      />

      {job.settlementStatus === 'HELD' && (
        <Banner tone="survey">
          <strong>Settlement held.</strong> This job was created through the API. Live position
          readings (E14b) are not wired to this page yet — execution status and settlement state
          come from the database.
        </Banner>
      )}

      <Section
        title="Job status"
        sub="Read from the API — execution and settlement are tracked separately."
      >
        <Panel>
          <DefList
            rows={[
              { label: 'Execution', value: job.executionStatus },
              { label: 'Settlement', value: job.settlementStatus },
              { label: 'Rail', value: job.rail },
              {
                label: 'Created',
                value: `${job.createdAt.slice(0, 16).replace('T', ' ')}Z`,
              },
              ...(job.feeBps !== null
                ? [{ label: 'Fee (bps)', value: String(job.feeBps) }]
                : []),
              ...(job.feeChargedAmount !== null
                ? [{ label: 'Fee charged', value: job.feeChargedAmount }]
                : []),
              ...(job.measuredPerformanceFee !== null
                ? [
                    {
                      label: 'Performance fee (display only)',
                      value: job.measuredPerformanceFee,
                    },
                  ]
                : []),
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
              title="Revoke requires wallet signing — connect via console credential flow."
            >
              Revoke now
            </Button>
            <Badge tone="alert">Wallet signing not wired in web UI</Badge>
          </Actions>
          <Note>
            Revocation is handled through the access credential flow (doc 04 §11.5). The control is
            shown here so buyers know where the exit is.
          </Note>
        </Panel>
      </Section>

      <Section title="Next">
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
      </Section>
    </SiteShell>
  )
}
