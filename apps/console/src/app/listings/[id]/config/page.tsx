import {
  Actions,
  Badge,
  Banner,
  Button,
  Note,
  OpenQuestion,
  PageHead,
  Panel,
  Section,
  Shell,
} from '@repo/design-system/components'
import { notFound } from 'next/navigation'
import { ConsoleNav } from '../../../../components/console-nav'
import { findOwned } from '../../../../fixtures/listings'

/**
 * ④ TRANSACTION · E11 — operating limits editor shell. **Owner-declared, not session-enforced.**
 *
 * That distinction is the entire content of this page. These fields used to sit inside blocking
 * review states (`COMMERCIAL_VERIFIED` → `RISK_REVIEW` → `APPROVED`) that were removed when the
 * ladder became Low/Medium/High, and no replacement home was ever agreed. Until one is, a number
 * typed here is a statement of intent that nothing checks — so the page says so on every field
 * rather than styling them like enforced limits and letting an owner assume otherwise.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = findOwned(id)
  if (!listing) notFound()

  const c = listing.commercialConfig

  const FIELDS = [
    {
      id: 'maxPosition',
      label: 'Max position size (USD)',
      value: c.maxPositionSizeUsd,
      hint: 'The largest position you intend to manage in a single hire.',
    },
    {
      id: 'maxDailyTx',
      label: 'Max transactions per day',
      value: c.maxDailyTxCount,
      hint: 'A self-imposed churn ceiling. Buyers read a high number here as a cost warning.',
    },
    {
      id: 'maxSlippage',
      label: 'Max slippage (bps)',
      value: c.maxSlippageBps,
      hint: 'Above this you decline the trade. Declines appear on your public decline log.',
    },
    {
      id: 'autoPause',
      label: 'Auto-pause drawdown (%)',
      value: c.autoPauseDrawdownPct,
      hint: 'The loss at which you stop acting and wait for the buyer.',
    },
    {
      id: 'fee',
      label: 'Fee (bps)',
      value: c.feeBps,
      hint: 'Shown on your agent card. Buyers compare this directly against your net APR.',
    },
  ]

  return (
    <Shell product="Builder Console" nav={<ConsoleNav />}>
      <PageHead
        pipeline="④ TRANSACTION"
        engine="E11 · Risk + Permission"
        status="shell · not enforced"
        title="Operating limits"
        meta={
          <>
            <Badge>{listing.name}</Badge>
            <Badge tone="warn">Declared, not enforced</Badge>
          </>
        }
        lede="What you say your agent will do. What actually bounds a running agent is the session a buyer grants it — set on the buyer's side, not here."
      />

      <Banner tone="alert">
        <strong>Nothing on this page constrains your agent.</strong> These values are shown to
        buyers as a declaration. The contract allowlist, spend cap and expiry that really bound it
        are set at hire time.
      </Banner>

      <Section
        title="Declared limits"
        sub="Disabled in this build — there is no write path, and a saved number would imply an enforcement that does not exist."
      >
        <Panel>
          <form style={{ maxWidth: 520 }}>
            {FIELDS.map((field) => (
              <div className="ds-field" key={field.id}>
                <label htmlFor={field.id}>{field.label}</label>
                <input id={field.id} name={field.id} defaultValue={field.value} disabled />
                <small>{field.hint}</small>
              </div>
            ))}
            <Actions>
              <Button
                disabled
                title="No write path exists — this app does not write to the database in this build."
              >
                Save limits
              </Button>
              <Badge tone="alert">nothing is saved</Badge>
            </Actions>
          </form>
          <Note>Fields are disabled so a typed number cannot be mistaken for a guarantee.</Note>
        </Panel>

        <div className="ds-subsection">
          <OpenQuestion id="01 §12 · commercial_config">
            Where these fields live, and whether a platform ceiling caps them, is{' '}
            <strong>undecided</strong>. The leaning proposal is a plain owner-editable field with
            safe defaults, capped by a formula-driven ceiling (category baseline × trust tier)
            enforced at session-grant time — no blocking gate and no manual review step. That is a
            proposal, not a decision, and it belongs in a Builder Console doc that has not been
            written.
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
