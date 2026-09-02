// apps/web/src/app/api/discover/route.ts
import { resolveDiscoveryQuery } from '@repo/discovery/query'
import { NextResponse } from 'next/server'
import { loadLiveDiscoveryCandidates } from '../../../lib/api'
import { apiToListingView } from '../../../lib/listing-view'
import { parseWithGemini } from '../../../lib/discovery/gemini-parser'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null
  const freeText = typeof body?.text === 'string' ? body.text.trim() : ''

  if (!freeText) {
    return NextResponse.json({ kind: 'clarify', question: 'What are you looking to do?' })
  }

  let candidates
  try {
    candidates = await loadLiveDiscoveryCandidates()
  } catch {
    return NextResponse.json({
      kind: 'clarify',
      question: 'The marketplace API is unavailable — try browsing by category instead.',
    })
  }

  const result = await resolveDiscoveryQuery({
    freeText,
    candidates,
    parseWithGemini,
  })

  if (result.kind === 'results') {
    const { getListing } = await import('../../../lib/api')
    const details = await Promise.all(result.candidates.map((c) => getListing(c.id)))
    const listings = details
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .map((d) => apiToListingView(d))
    return NextResponse.json({ ...result, listings })
  }

  return NextResponse.json(result)
}
