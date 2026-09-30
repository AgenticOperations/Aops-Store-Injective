import type { CredentialNet } from '@repo/access/token'
import { readKeystoreEntry } from '@repo/custody/sessions'
import { createDbClient } from '@repo/database/client'
import { getDatabaseUrl } from '@repo/database/keys'
import type { DbClient } from '@repo/database/client'
import { createSimulateAltanaClient, type SimulateAltanaClient } from './custody/simulate-client'

export interface ApiContext {
  db: DbClient
  deploymentNet: CredentialNet
  apiBaseUrl: string
  altanaClient: SimulateAltanaClient
}

let cached: Omit<ApiContext, 'db'> & { db?: DbClient } | null = null
let simulateClient: SimulateAltanaClient | null = null

function getSimulateClient(): SimulateAltanaClient {
  simulateClient ??= createSimulateAltanaClient()
  return simulateClient
}

function getDb(): DbClient {
  if (cached?.db) return cached.db
  const { db } = createDbClient(getDatabaseUrl())
  if (cached) {
    cached.db = db
  }
  return db
}

export function getApiContext(): ApiContext {
  if (!cached) {
    const deploymentNet = (process.env.ACCESS_NET === 'bsc' ? 'bsc' : 'tbsc') as CredentialNet
    const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001'
    cached = { deploymentNet, apiBaseUrl, altanaClient: getSimulateClient() }
  }

  return {
    db: getDb(),
    deploymentNet: cached.deploymentNet,
    apiBaseUrl: cached.apiBaseUrl,
    altanaClient: cached.altanaClient,
  }
}

export async function liveSessionCheck(_credentialId: string, sessionId: string): Promise<boolean> {
  const { altanaClient } = getApiContext()
  const entry = await readKeystoreEntry({ sessionId, client: altanaClient })
  if (!entry.ok) return false
  return entry.data?.state === 'valid'
}

/** Test-only — reset cached context between cases. */
export function __resetApiContextForTests(): void {
  cached = null
  simulateClient = null
}
