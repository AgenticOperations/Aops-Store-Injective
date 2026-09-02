// apps/web/src/lib/discovery/gemini-parser.ts
import { type DiscoveryQuery, discoveryQuerySchema } from '@repo/discovery/query'
import type { Category } from '@repo/domain/types'

const GEMINI_TIMEOUT_MS = 6000

const RESPONSE_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    category: {
      type: 'STRING',
      enum: [
        'rebalancing',
        'grid-trading',
        'yield-optimization',
        'health-factor-monitoring',
        'unknown',
      ],
    },
    risk_tolerance: { type: 'STRING', enum: ['low', 'medium', 'high', 'unknown'] },
    budget_ceiling: { type: 'NUMBER' },
    min_trust_tier: { type: 'STRING', enum: ['Low', 'Medium', 'High', 'unknown'] },
    capability_requirements: { type: 'ARRAY', items: { type: 'STRING' } },
    availability_required: { type: 'BOOLEAN' },
  },
  required: ['category', 'capability_requirements', 'availability_required'],
}

const LLM_CATEGORY_TO_DOMAIN: Record<string, Category> = {
  rebalancing: 'rebalancing',
  'grid-trading': 'grid_trading',
  'yield-optimization': 'yield_optimization',
  'health-factor-monitoring': 'health_factor_monitoring',
}

const SYSTEM_PROMPT = `You extract a structured query from a buyer's free text about hiring an
on-chain trading agent. Only these four categories exist: rebalancing (LP range management),
grid-trading (automated grid orders), yield-optimization (routing liquidity to APR), and
health-factor-monitoring (protecting lending positions from liquidation). If the text does not
clearly and confidently map to exactly one category, set category to "unknown" — never guess.
Do not invent values for fields the text doesn't mention; use "unknown" / omit / false as
appropriate. Never include commentary, only the JSON object.`

/**
 * Returns a validated DiscoveryQuery, or null on any failure (bad key, timeout, malformed
 * output, schema mismatch) — callers must treat null exactly like "Gemini is unavailable" and
 * fall back to the keyword parser (Task 4). This function never throws.
 */
export async function parseWithGemini(freeText: string): Promise<DiscoveryQuery | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: freeText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_JSON_SCHEMA,
          },
        }),
      },
    )
    if (!response.ok) return null

    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null

    const raw = JSON.parse(text) as Record<string, unknown>
    const rawCategory = raw.category
    const domainCategory =
      rawCategory === 'unknown' || rawCategory == null
        ? null
        : (LLM_CATEGORY_TO_DOMAIN[String(rawCategory)] ?? null)

    const normalized = {
      category: domainCategory,
      risk_tolerance: raw.risk_tolerance === 'unknown' ? null : (raw.risk_tolerance ?? null),
      budget_ceiling: typeof raw.budget_ceiling === 'number' ? raw.budget_ceiling : null,
      min_trust_tier: raw.min_trust_tier === 'unknown' ? null : (raw.min_trust_tier ?? null),
      capability_requirements: raw.capability_requirements ?? [],
      availability_required: raw.availability_required ?? false,
      free_text_original: freeText,
    }

    const parsed = discoveryQuerySchema.safeParse(normalized)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
