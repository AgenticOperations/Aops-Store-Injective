// apps/web/src/app/api/discover/route.ts
import { resolveDiscoveryQuery } from '@repo/discovery/query'
import { NextResponse } from 'next/server'
import { FIXTURE_LISTINGS } from '../../../fixtures/listings'
import { fixtureToCandidate } from '../../../lib/discovery/adapter'
import { parseWithGemini } from '../../../lib/discovery/gemini-parser'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null
  const freeText = typeof body?.text === 'string' ? body.text.trim() : ''

  if (!freeText) {
    return NextResponse.json({ kind: 'clarify', question: 'What are you looking to do?' })
  }

  const candidates = FIXTURE_LISTINGS.map(fixtureToCandidate)
  const result = await resolveDiscoveryQuery({
    freeText,
    candidates,
    parseWithGemini,
  })

  if (result.kind === 'results') {
    const ids = new Set(result.candidates.map((c) => c.id))
    const listings = FIXTURE_LISTINGS.filter((listing) => ids.has(listing.id))
    return NextResponse.json({ ...result, listings })
  }

  return NextResponse.json(result)
}
