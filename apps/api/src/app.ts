import { OpenAPIHono } from '@hono/zod-openapi'
import { requireTier } from './middleware/auth'
import { agentJsonHandler, llmsHandler } from './routes/discovery-meta'
import { getByQueryHandler, getByQueryRoute, getHandler, getRoute } from './routes/get'
import { healthHandler, healthRoute } from './routes/health'
import { hireHandler, hireRoute } from './routes/hire'
import { meJobsHandler, meJobsRoute } from './routes/me-jobs'
import { quoteHandler, quoteRoute } from './routes/quote'
import { searchHandler, searchRoute } from './routes/search'
import type { ApiEnv } from './types/env'

export const app = new OpenAPIHono<ApiEnv>()

app.openapi(healthRoute, healthHandler)
app.openapi(searchRoute, searchHandler)
app.openapi(getRoute, getHandler)
app.openapi(getByQueryRoute, getByQueryHandler)

app.use('/v1/quote', requireTier('Standing'))
app.openapi(quoteRoute, quoteHandler)

app.use('/v1/me/jobs', requireTier('Standing'))
app.openapi(meJobsRoute, meJobsHandler)

app.use('/v1/jobs', requireTier('Fresh'))
app.openapi(hireRoute, hireHandler)

app.get('/llms.txt', llmsHandler)
app.get('/.well-known/agent.json', agentJsonHandler)

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'Aops Store — Agent API', version: '1' },
})
