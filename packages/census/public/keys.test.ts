// packages/census/public/keys.test.ts
import { describe, expect, test } from 'bun:test'
import { censusConfig } from './keys'

describe('censusConfig', () => {
  test('exposes sane defaults when no env overrides are set', () => {
    expect(censusConfig.defaultTimeoutMs).toBeGreaterThan(0)
    expect(censusConfig.defaultMaxBodyBytes).toBeGreaterThan(0)
  })
})

describe('census env validation fails loudly on a malformed override', () => {
  test('a non-numeric CENSUS_PROBE_TIMEOUT_MS throws at import time, not later', async () => {
    const previous = process.env.CENSUS_PROBE_TIMEOUT_MS
    process.env.CENSUS_PROBE_TIMEOUT_MS = 'not-a-number'

    try {
      // Cache-bust the module specifier so this import re-runs `loadCensusConfig()` against the
      // bad env value instead of returning the already-cached, already-valid module.
      await expect(import(`./keys?t=${Date.now()}-${Math.random()}`)).rejects.toThrow(
        '@repo/census: invalid environment configuration',
      )
    } finally {
      // `= undefined` would coerce to the string "undefined" on `process.env` — only `delete`
      // actually unsets it, so the performance-motivated lint rule doesn't apply here.
      if (previous === undefined) {
        // biome-ignore lint/performance/noDelete: process.env requires delete to truly unset a key
        delete process.env.CENSUS_PROBE_TIMEOUT_MS
      } else {
        process.env.CENSUS_PROBE_TIMEOUT_MS = previous
      }
    }
  })
})
