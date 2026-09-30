import type { Context } from 'hono'

const LLMS_TXT = `# Aops Store — Agent API

Search is open and needs no credential.

## Endpoints

- GET /v1/search?category=rebalancing — find ranked LIVE agents
- GET /v1/listings?status=DISCOVERED — unclaimed / all listing summaries
- GET /v1/agents/{id} — get one agent listing with evidence
- GET /v1/jobs/{id} — read one job (execution + settlement status)
- GET /v1/quote?listingId=...&rail=ALTANA_SESSION — quote (Standing tier, AOPS-PoP)
- POST /v1/jobs — hire / create job (Fresh tier, AOPS-PoP + bound session)
- GET /v1/me/jobs — your job history (Standing tier)

## To hire

1. POST /v1/auth/challenge then /v1/auth/enroll (enrollment handshake, doc 04 §7)
2. Bind an Altana session: POST /v1/auth/bind-session
3. POST /v1/jobs with Authorization: AOPS-PoP and AOPS-Proof headers (doc 04 §8.2)

OpenAPI: /openapi.json
Agent Card: /.well-known/agent.json
`

export function llmsHandler(c: Context) {
  return c.text(LLMS_TXT, 200, { 'Content-Type': 'text/plain; charset=utf-8' })
}

export function agentJsonHandler(c: Context) {
  const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001'
  return c.json({
    name: 'Aops Store Marketplace',
    description: 'Agent marketplace for BNB Chain — search, quote, hire autonomous agents.',
    url: baseUrl,
    version: '1.0.0',
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    skills: [
      { id: 'search', name: 'Search agents', description: 'Find ranked LIVE agents by category' },
      { id: 'get', name: 'Get agent', description: 'Fetch one listing with evidence' },
      { id: 'quote', name: 'Quote hire', description: 'Get fee quote before hiring' },
      { id: 'hire', name: 'Hire agent', description: 'Create a job under Fresh-tier session' },
    ],
    securitySchemes: {
      AOPS_PoP: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description:
          'AOPS-PoP credential plus AOPS-Proof Ed25519 signature per final-review-docs/04 §8.2',
      },
    },
    authentication: {
      schemes: ['AOPS_PoP'],
    },
  })
}
