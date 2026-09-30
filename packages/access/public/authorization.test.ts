// packages/access/public/authorization.test.ts
import { describe, expect, test } from 'bun:test'
import { BoundSessionCache, checkFreshAuthorization } from './authorization'

describe('checkFreshAuthorization — §9.3 stale-cache invariant', () => {
  test('cache says live but live check fails → reject (never false-approve)', async () => {
    const cache = new BoundSessionCache()
    const credentialId = 'cred-stale-cache-test'

    cache.set(credentialId, { isLive: true, checkedAt: Date.now() - 60_000 })

    const result = await checkFreshAuthorization({
      credentialId,
      sessionId: 'session-revoked-on-chain',
      liveCheck: async () => false,
      cache,
    })

    expect(result.approved).toBe(false)
    expect(result.source).toBe('live')

    const updated = cache.get(credentialId)
    expect(updated?.isLive).toBe(false)
  })

  test('cache says dead → fast reject without needing live approval path', async () => {
    const cache = new BoundSessionCache()
    const credentialId = 'cred-cache-reject'

    cache.set(credentialId, { isLive: false, checkedAt: Date.now() })

    let liveCalled = false
    const result = await checkFreshAuthorization({
      credentialId,
      sessionId: 'session-any',
      liveCheck: async () => {
        liveCalled = true
        return true
      },
      cache,
    })

    expect(result.approved).toBe(false)
    expect(result.source).toBe('cache_reject')
    expect(liveCalled).toBe(false)
  })

  test('live check passes → approve and refresh cache', async () => {
    const cache = new BoundSessionCache()
    const credentialId = 'cred-live-ok'

    const result = await checkFreshAuthorization({
      credentialId,
      sessionId: 'session-live',
      liveCheck: async () => true,
      cache,
    })

    expect(result.approved).toBe(true)
    expect(result.source).toBe('live')
    expect(cache.get(credentialId)?.isLive).toBe(true)
  })
})
