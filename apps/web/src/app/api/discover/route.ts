// apps/web/src/app/api/discover/route.ts
import { NextResponse } from 'next/server'
import { FIXTURE_LISTINGS } from '../../../fixtures/listings'
import { parseWithGemini } from '../../../lib/discovery/gemini-parser'
import { resolveDiscoveryQuery } from '../../../lib/discovery/resolve-query'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null
  const freeText = typeof body?.text === 'string' ? body.text.trim() : ''

  if (!freeText) {
    return NextResponse.json({ kind: 'clarify', question: 'What are you looking to do?' })
  }

  const result = await resolveDiscoveryQuery({
    freeText,
    listings: FIXTURE_LISTINGS,
    parseWithGemini,
  })

  return NextResponse.json(result)
}
