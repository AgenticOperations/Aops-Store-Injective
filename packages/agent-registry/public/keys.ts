/**
 * RING 1 · OBSERVATION — read-only, output is a cache
 * `@repo/agent-registry/keys` — environment contract.
 *
 * Validates this package's own variables at startup and fails LOUDLY if any are
 * missing (00 §3.7). Nothing outside this file may read `process.env`.
 * A misconfigured money-tier package must fail at boot, not at signing time.
 *
 * This is a read-only Ring 1 package, not money-tier, but the same discipline applies: a
 * missing RPC URL should fail the composing app's boot, not surface as a confusing runtime
 * error the first time a claim is checked.
 */
import { z } from 'zod'

const EnvSchema = z.object({
  /** BSC mainnet RPC URL — used to build a real `PublicClient` via
   * `createIdentityRegistryClient(http(bscRpcUrl))` (see `public/registry.ts`). */
  AGENT_REGISTRY_BSC_RPC_URL: z.string().url(),
  /** Optional 8004scan Pro key. Anonymous calls work (rate-limited, ~10/min) if this is
   * absent — `docs/build/2026-09-02-v1-milestone-plan-kc.md` Chunk 2a brief. Not currently
   * wired into request headers: the auth scheme (header name/format) for a Pro key is not
   * confirmed by any cited doc, so it is validated here but not yet used — an open item, not
   * silently guessed. */
  AGENT_REGISTRY_8004SCAN_API_KEY: z.string().min(1).optional(),
})

export interface AgentRegistryKeys {
  bscRpcUrl: string
  scan8004ApiKey: string | undefined
}

/**
 * Reads and validates this package's own environment variables. Fails loudly (throws) if
 * anything required is missing or malformed — call this once, at process startup, from the
 * composing app, not per-request. Accepts an explicit `env` for testability; defaults to
 * `process.env`.
 */
export function loadAgentRegistryKeys(
  env: Record<string, string | undefined> = process.env,
): AgentRegistryKeys {
  const parsed = EnvSchema.safeParse(env)
  if (!parsed.success) {
    throw new Error(
      `@repo/agent-registry: invalid or missing environment variables — ${parsed.error.message}`,
    )
  }
  return {
    bscRpcUrl: parsed.data.AGENT_REGISTRY_BSC_RPC_URL,
    scan8004ApiKey: parsed.data.AGENT_REGISTRY_8004SCAN_API_KEY,
  }
}
