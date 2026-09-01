import {
  Actions,
  Badge,
  Banner,
  Button,
  DefList,
  Note,
  PageHead,
  Panel,
  Prose,
  Section,
  Shell,
} from '@repo/design-system/components'
import { notFound } from 'next/navigation'
import { ConsoleNav } from '../../../../components/console-nav'
import { Ladder } from '../../../../components/ladder'
import { findOwned } from '../../../../fixtures/listings'

/**
 * ① SUPPLY · E2 — Claim + Verify (`final-review-docs/01` §4.1–4.4).
 *
 * The console **constructs the typed-data payload; the wallet signs it.** That split is the whole
 * security property of this page: an EIP-712 typed-data signature is checked against the ERC-721
 * owner of record, and a raw-message sign is specifically not used because it is replayable. This
 * app holds no key and can produce no signature, so the button below is disabled rather than fake.
 *
 * There is deliberately no race-condition handling here. Simultaneous claim attempts are harmless —
 * only a genuinely valid signature passes the next gate, so a losing attempt costs nothing.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = findOwned(id)
  if (!listing) notFound()

  const alreadyClaimed = listing.status !== 'DISCOVERED'

  return (
    <Shell product="Builder Console" nav={<ConsoleNav />}>
      <PageHead
        pipeline="① SUPPLY"
        engine="E2 · Claim + Verify"
        status="shell · no signing"
        title={`Claim ${listing.name}`}
        meta={<Badge tone={alreadyClaimed ? 'live' : 'warn'}>{listing.status}</Badge>}
        lede="Prove you control the wallet that owns this agent on chain, and it goes live the same day."
      />

      <Section title="Where this agent is">
        <Ladder status={listing.status} />
        {alreadyClaimed ? (
          <Banner tone="survey">
            <strong>Already claimed.</strong> This agent is {listing.status} and the owner of record
            is {listing.ownerAddress}. Re-claiming is not possible and is not needed.
          </Banner>
        ) : (
          <Banner tone="survey">
            <strong>We have no way to contact you, so you have to find us.</strong> ERC-8004 has no
            contact field — there is no email address in an agent registration, anywhere in the
            spec. That is why your agent is sitting in a public unclaimed directory instead of in an
            inbox.
          </Banner>
        )}
      </Section>

      <Section
        title="What proving ownership involves"
        sub="Three steps, none of which we can do on your behalf."
      >
        <Panel>
          <Prose>
            <ol>
              <li>
                <strong>Sign typed data with the owner wallet.</strong> Your wallet signs an EIP-712
                structured payload — not a raw message. We check the signature against the current
                ERC-721 owner of record in the Identity Registry. If you are not that address,
                nothing you sign will pass.
              </li>
              <li>
                <strong>We probe your real endpoint.</strong> Not the manifest — the actual service
                in your <code>services[]</code> array. An IPFS-pinned manifest proves the file
                exists; only a live probe proves the agent is running.
              </li>
              <li>
                <strong>You go LIVE at Low trust, immediately.</strong> Hireable for real money that
                day, with no track record. Nothing further is required of you.
              </li>
            </ol>
          </Prose>
        </Panel>
        <Note>
          No on-chain anchor yet? An Agent Studio registration proves control with a domain TXT
          record instead. Same destination, different proof.
        </Note>
      </Section>

      <Section title="Sign" sub="The payload your wallet would be handed.">
        <Panel>
          <DefList
            rows={[
              {
                label: 'Agent id',
                value: <span style={{ fontFamily: 'var(--mono)' }}>{listing.id}</span>,
              },
              {
                label: 'Owner of record',
                value: <span style={{ fontFamily: 'var(--mono)' }}>{listing.ownerAddress}</span>,
              },
              {
                label: 'Payload type',
                value: <span style={{ fontFamily: 'var(--mono)' }}>EIP-712 typed data</span>,
              },
              {
                label: 'Challenge expiry',
                value: 'Not yet decided — an open tuning item, not a design gap.',
              },
            ]}
          />
          <Actions>
            <Button
              disabled
              title="This console holds no key and constructs no signature in this build."
            >
              Sign claim with wallet
            </Button>
            <Badge tone="alert">nothing is signed</Badge>
          </Actions>
          <Note>
            When this is wired, the console builds the typed-data payload and hands it to your
            wallet. The signature happens in your wallet, never here.
          </Note>
        </Panel>

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
