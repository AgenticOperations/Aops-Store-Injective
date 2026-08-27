import { OpenAPIHono } from '@hono/zod-openapi'
import { healthRoute, healthHandler } from './routes/health'

/**
 * One zod schema per route is simultaneously the validator, the TypeScript type, and the
 * OpenAPI entry. That is deliberate: 00 §3.4 forbids a second validation library, and the
 * agent-to-agent surface is judged on interoperability — so the spec has to be generated
 * from the code that actually runs, never hand-maintained beside it.
 */
export const app = new OpenAPIHono()

app.openapi(healthRoute, healthHandler)

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'Aops Store — Agent API', version: '1' },
})
