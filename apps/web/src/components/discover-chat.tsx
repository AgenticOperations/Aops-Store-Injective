'use client'

import { Badge, Banner, Button, ChipRow } from '@repo/design-system/components'
import { useState } from 'react'
import type { Listing } from '../fixtures/listings'
import { ListingGrid } from './listing-grid'

type DiscoverResponse =
  | { kind: 'results'; listings: Listing[]; resolvedVia: 'gemini' | 'keyword'; freeText: string }
  | { kind: 'clarify'; question: string }

const NETWORK_ERROR_MESSAGE = "Couldn't reach the search. Check your connection and try again."

/** Real sentences a buyer would actually type, one per mandated category. */
const EXAMPLES = [
  'protect my Venus position from liquidation',
  'keep my CAKE/BNB position in range',
  'run a grid on BNB/USDT',
  'find the best stablecoin yield',
]

/**
 * Bounded chat surface (Decision 0004). This box is an alternate INPUT to the same filter the
 * category grid calls — it never replaces the grid, which stays visible and usable whether or not
 * this box is touched at all.
 */
export function DiscoverChat() {
  const [text, setText] = useState('')
  const [response, setResponse] = useState<DiscoverResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(query: string) {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query }),
      })
      if (!res.ok) throw new Error('non-200 response')
      const data = (await res.json()) as DiscoverResponse
      setResponse(data)
    } catch {
      // Clear any stale results so the error banner isn't sitting above results from a different
      // query. The category grid below stays usable regardless — this box failing never dead-ends
      // the page.
      setResponse(null)
      setError(NETWORK_ERROR_MESSAGE)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--s4)' }}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit(text)
        }}
        className="ds-searchbar"
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Describe what you need in your own words…"
          aria-label="Describe what you need"
          className="ds-input"
        />
        <Button type="submit" disabled={loading}>
          {loading ? 'Thinking…' : 'Find an agent'}
        </Button>
      </form>

      <ChipRow>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="ds-chip"
            onClick={() => {
              setText(example)
              void submit(example)
            }}
          >
            {example}
          </button>
        ))}
      </ChipRow>

      {error && <Banner tone="alert">{error}</Banner>}

      {response?.kind === 'clarify' && (
        <Banner tone="survey">
          <strong>One question first.</strong> {response.question}
        </Banner>
      )}

      {response?.kind === 'results' && (
        <div style={{ display: 'grid', gap: 'var(--s3)', textAlign: 'left' }}>
          <ChipRow>
            <Badge>showing results for</Badge>
            <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>“{response.freeText}”</span>
          </ChipRow>
          <ListingGrid listings={response.listings} />
        </div>
      )}
    </div>
  )
}
