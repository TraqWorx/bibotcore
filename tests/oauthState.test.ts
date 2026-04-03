import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('oauth state', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.GHL_OAUTH_STATE_SECRET = 'test-secret'
  })

  it('accepts a valid signed package-install state', async () => {
    const { createOAuthState, verifyOAuthState } = await import('@/lib/ghl/oauthState')

    const state = createOAuthState({ flow: 'package_install', packageSlug: 'starter' })
    const payload = verifyOAuthState(state)

    expect(payload).toMatchObject({
      flow: 'package_install',
      packageSlug: 'starter',
    })
    expect(payload?.nonce).toBeTruthy()
  })

  it('rejects a tampered state payload', async () => {
    const { createOAuthState, verifyOAuthState } = await import('@/lib/ghl/oauthState')

    const state = createOAuthState({ flow: 'admin_design_install', designSlug: 'simfonia' })
    const [payload, signature] = state.split('.')
    const tamperedState = `${payload}x.${signature}`

    expect(verifyOAuthState(tamperedState)).toBeNull()
  })

  it('rejects an expired state payload', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-03T00:00:00Z'))

    const { createOAuthState, verifyOAuthState } = await import('@/lib/ghl/oauthState')
    const state = createOAuthState({ flow: 'package_install', packageSlug: 'starter' })

    vi.setSystemTime(new Date('2026-04-03T00:11:00Z'))
    expect(verifyOAuthState(state)).toBeNull()

    vi.useRealTimers()
  })
})
