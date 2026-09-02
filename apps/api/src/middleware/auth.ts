import { verifyProofOfPossession } from '@repo/access/proof'
import type { AccessTier } from '@repo/domain/guards'
import type { Context, Next } from 'hono'
import { getApiContext, liveSessionCheck } from '../context'
import type { ApiEnv } from '../types/env'

export type AuthVariables = {
  credentialId?: string
  accountId?: string
  tier?: AccessTier
}

function unauthorized(step: string) {
  return {
    error: {
      code: 'UNAUTHORIZED',
      message: `Authentication failed at step ${step}`,
      step,
    },
  } as const
}

function requestUrl(c: Context, apiBaseUrl: string): string {
  const incoming = new URL(c.req.url)
  return `${apiBaseUrl}${incoming.pathname}${incoming.search}`
}

export function requireTier(requiredTier: AccessTier) {
  return async (c: Context<ApiEnv>, next: Next) => {
    if (!c.req.header('AOPS-Proof')) {
      return c.json(unauthorized('PROOF_REQUIRED'), 401)
    }

    const { db, deploymentNet, apiBaseUrl } = getApiContext()
    const url = requestUrl(c, apiBaseUrl)

    const body =
      c.req.method === 'GET' || c.req.method === 'HEAD' ? '' : await c.req.raw.clone().text()

    const result = await verifyProofOfPossession({
      authorizationHeader: c.req.header('Authorization'),
      proofHeader: c.req.header('AOPS-Proof'),
      request: { method: c.req.method, url, body },
      deploymentNet,
      requiredTier,
      db,
      liveSessionCheck,
    })

    if (!result.ok) {
      return c.json(unauthorized(result.step), 401)
    }

    c.set('credentialId', result.credentialId)
    c.set('accountId', result.accountId)
    c.set('tier', result.tier)
    await next()
  }
}
