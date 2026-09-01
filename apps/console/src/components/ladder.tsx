// apps/console/src/components/ladder.tsx
import type { ListingStatus } from '../fixtures/listings'

const LADDER: ListingStatus[] = [
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

export function Ladder({ status }: { status: ListingStatus }) {
  const currentIndex = LADDER.indexOf(status)
  return (
    <ol className="ds-ladder" aria-label="Registration ladder">
      {LADDER.map((step, index) => (
        <li
          key={step}
          className={index < currentIndex ? 'is-done' : index === currentIndex ? 'is-current' : ''}
          aria-current={index === currentIndex ? 'step' : undefined}
        >
          {LABEL[step]}
        </li>
      ))}
    </ol>
  )
}
