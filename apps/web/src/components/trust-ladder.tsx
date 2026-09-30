// apps/web/src/components/trust-ladder.tsx
import type { ListingStatus } from '../fixtures/listings'

export const LADDER: ListingStatus[] = [
  'DISCOVERED',
  'CLAIMED',
  'OWNERSHIP_VERIFIED',
  'ENDPOINT_VERIFIED',
  'LIVE',
]

const LABEL: Record<ListingStatus, string> = {
  DISCOVERED: 'Discovered',
  CLAIMED: 'Claimed',
  OWNERSHIP_VERIFIED: 'Ownership verified',
  ENDPOINT_VERIFIED: 'Endpoint verified',
  LIVE: 'Live · Low trust',
}

/**
 * The DISCOVERED → LIVE ladder (`final-review-docs/01` §4), rendered as progress.
 *
 * It is shown on the buyer's detail page and not only in the builder console on purpose: the
 * single most important thing a buyer can know about a Low-trust agent is that reaching LIVE
 * required proving ownership against the on-chain owner of record and answering a live endpoint
 * probe. "Low trust" reads like a warning until you can see what it already cost to get there.
 */
export function TrustLadder({ status }: { status: ListingStatus }) {
  const currentIndex = LADDER.indexOf(status)
  return (
    <ol className="ds-ladder" aria-label="Registration ladder">
      {LADDER.map((step, index) => {
        const state = index < currentIndex ? 'is-done' : index === currentIndex ? 'is-current' : ''
        return (
          <li
            key={step}
            className={state}
            aria-current={index === currentIndex ? 'step' : undefined}
          >
            {LABEL[step]}
          </li>
        )
      })}
    </ol>
  )
}
