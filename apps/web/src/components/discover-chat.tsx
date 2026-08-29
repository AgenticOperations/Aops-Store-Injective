// apps/web/src/components/discover-chat.tsx
'use client'

import { Banner, Button } from '@repo/design-system/components'
import { useState } from 'react'
import type { Listing } from '../fixtures/listings'
import { ListingGrid } from './listing-grid'

type DiscoverResponse =
  | { kind: 'results'; listings: Listing[]; resolvedVia: 'gemini' | 'keyword'; freeText: string }
  | { kind: 'clarify'; question: string }

const NETWORK_ERROR_MESSAGE = "Couldn't reach the search. Check your connection and try again."

/**
 * Bounded chat surface (Decision 0004). This box is an alternate INPUT to the same filter the
 * category grid below it calls — it never replaces the grid, which stays visible and usable
 * whether or not this box is touched at all.
 */
export function DiscoverChat() {
  const [text, setText] = useState('')
  const [response, setResponse] = useState<DiscoverResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('non-200 response')
      const data = (await res.json()) as DiscoverResponse
      setResponse(data)
    } catch {
      // Clear any stale results so the error banner isn't sitting above results from a
      // different query. The category grid below stays usable regardless — this box failing
      // never dead-ends the page.
      setResponse(null)
      setError(NETWORK_ERROR_MESSAGE)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12, marginBottom: 32 }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. protect my Venus position from liquidation"
          className="ds-input"
          style={{
            flex: 1,
            padding: '10px 12px',
            background: 'var(--paper-2)',
            color: 'var(--ink)',
            border: '1px solid var(--rule)',
            borderRadius: 2,
            fontSize: 14,
          }}
        />
        <Button type="submit" disabled={loading}>
          {loading ? 'Thinking…' : 'Find an agent'}
        </Button>
      </form>

      {error && <Banner tone="alert">{error}</Banner>}

      {response?.kind === 'clarify' && (
        <p style={{ margin: 0, color: 'var(--ink-muted)' }}>{response.question}</p>
      )}

      {response?.kind === 'results' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)' }}>
            Showing results for: "{response.freeText}"
          </p>
          <ListingGrid listings={response.listings} />
        </div>
      )}
    </div>
  )
}
