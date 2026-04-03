import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockMaybeSingle = vi.fn()
const mockInsertSingle = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
    auth: {
      admin: {
        deleteUser: vi.fn(),
      },
    },
  })),
}))

vi.mock('@/lib/designInstaller/runDesignInstaller', () => ({
  runDesignInstaller: vi.fn(),
}))

vi.mock('@/lib/ghl/provisionLocation', () => ({
  provisionLocation: vi.fn(),
}))

vi.mock('@/lib/sync/webhookProcessor', () => ({
  processWebhookEvent: vi.fn(async () => ({ processed: true, entity: 'contact' })),
}))

function createSupabaseQuery(table: string) {
  if (table === 'ghl_connections') {
    return {
      select() { return this },
      eq() { return this },
      limit() { return this },
      maybeSingle: mockMaybeSingle,
    }
  }

  if (table === 'ghl_webhook_events') {
    return {
      insert() { return this },
      select() { return this },
      single: mockInsertSingle,
    }
  }

  return {
    select() { return this },
    eq() { return this },
    maybeSingle: vi.fn(async () => ({ data: null })),
  }
}

describe('GHL webhook auth', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFrom.mockReset()
    mockMaybeSingle.mockReset()
    mockInsertSingle.mockReset()
    mockFrom.mockImplementation((table: string) => createSupabaseQuery(table))
    mockMaybeSingle.mockResolvedValue({ data: { location_id: 'loc_123' } })
    mockInsertSingle.mockResolvedValue({ data: { id: 'evt_1' }, error: null })
  })

  it('fails closed in production when WEBHOOK_SECRET is missing', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.WEBHOOK_SECRET

    const { POST } = await import('@/app/api/webhooks/ghl/route')
    const response = await POST(new Request('https://example.com/api/webhooks/ghl', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'loc_123', type: 'contact.create' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(500)
  })

  it('rejects requests with the wrong webhook secret', async () => {
    process.env.NODE_ENV = 'development'
    process.env.WEBHOOK_SECRET = 'expected-secret'

    const { POST } = await import('@/app/api/webhooks/ghl/route')
    const response = await POST(new Request('https://example.com/api/webhooks/ghl', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'loc_123', type: 'contact.create' }),
      headers: {
        'content-type': 'application/json',
        'x-webhook-secret': 'wrong-secret',
      },
    }))

    expect(response.status).toBe(401)
  })

  it('rejects non-provisioning events for unknown locations even with valid auth', async () => {
    process.env.NODE_ENV = 'development'
    process.env.WEBHOOK_SECRET = 'expected-secret'
    mockMaybeSingle.mockResolvedValue({ data: null })

    const { POST } = await import('@/app/api/webhooks/ghl/route')
    const response = await POST(new Request('https://example.com/api/webhooks/ghl', {
      method: 'POST',
      body: JSON.stringify({ locationId: 'missing_loc', type: 'contact.create' }),
      headers: {
        'content-type': 'application/json',
        'x-webhook-secret': 'expected-secret',
      },
    }))

    expect(response.status).toBe(403)
  })
})
