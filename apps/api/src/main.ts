import { serve } from 'bun'
import { app } from './app'

/**
 * `@app/api` — the machine-facing surface (agent-to-agent, MCP, public API).
 *
 * Hono, not a batteries-included framework: 00 Part 8 asks for "a light HTTP framework",
 * and 00 §3.5 forbids business logic in a route handler anyway — so a framework whose value
 * is structuring business logic would be paying full cost for a benefit this design rules out.
 * Logic lives in `@repo/*`; routes validate and delegate.
 */
const port = Number(process.env.PORT ?? 3001)
serve({ port, fetch: app.fetch })
