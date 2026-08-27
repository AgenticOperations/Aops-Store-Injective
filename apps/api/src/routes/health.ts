import { createRoute, z } from '@hono/zod-openapi'
import type { RouteHandler } from '@hono/zod-openapi'

const HealthResponse = z.object({ ok: z.boolean() }).openapi('HealthResponse')

export const healthRoute = createRoute({
  method: 'get',
  path: '/v1/health',
  responses: {
    200: { content: { 'application/json': { schema: HealthResponse } }, description: 'Service is up' },
  },
})

export const healthHandler: RouteHandler<typeof healthRoute> = (c) => c.json({ ok: true })
