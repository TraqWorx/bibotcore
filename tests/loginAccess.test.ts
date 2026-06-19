import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFrom = vi.fn()
const mockGetUserById = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
    auth: { admin: { getUserById: mockGetUserById } },
  })),
}))

// Chainable query builder whose terminal awaited value is `result`.
function query(result: unknown) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'not', 'limit']) {
    builder[method] = () => builder
  }
  // Awaiting the builder resolves to the result (Supabase builders are thenable).
  builder.then = (resolve: (v: unknown) => void) => resolve(result)
  return builder
}

describe('checkLoginAllowed', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFrom.mockReset()
    mockGetUserById.mockReset()
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.GHL_AGENCY_TOKEN = 'agency-token'
    process.env.GHL_COMPANY_ID = 'company-123'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ users: [] }) })))
  })

  it('allows a known profile (admin/agency)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return query({ data: [{ id: 'u1', role: 'admin', agency_id: 'a1' }] })
      throw new Error(`unexpected table ${table}`)
    })
    mockGetUserById.mockResolvedValue({ data: { user: { banned_until: null } } })

    const { checkLoginAllowed } = await import('@/app/login/_actions')
    expect(await checkLoginAllowed('Info@Bibotcrm.it')).toEqual({ allowed: true })
  })

  it('blocks a deactivated (banned) account', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return query({ data: [{ id: 'u1', role: 'admin', agency_id: 'a1' }] })
      throw new Error(`unexpected table ${table}`)
    })
    const future = new Date(Date.now() + 60_000).toISOString()
    mockGetUserById.mockResolvedValue({ data: { user: { banned_until: future } } })

    const { checkLoginAllowed } = await import('@/app/login/_actions')
    const res = await checkLoginAllowed('info@bibotcrm.it')
    expect(res).toEqual({ error: expect.stringContaining('deactivated') })
  })

  it('allows a known GHL company-level user when no profile exists', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return query({ data: [] })
      if (table === 'ghl_connections') return query({ data: [] })
      throw new Error(`unexpected table ${table}`)
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ users: [{ email: 'x@y.com' }] }) })))

    const { checkLoginAllowed } = await import('@/app/login/_actions')
    expect(await checkLoginAllowed('x@y.com')).toEqual({ allowed: true })
  })

  it('rejects an unknown email as invite-only', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return query({ data: [] })
      if (table === 'ghl_connections') return query({ data: [] })
      throw new Error(`unexpected table ${table}`)
    })

    const { checkLoginAllowed } = await import('@/app/login/_actions')
    const res = await checkLoginAllowed('stranger@nowhere.com')
    expect(res).toEqual({ error: expect.stringContaining('invite-only') })
  })

  it('requires an email', async () => {
    const { checkLoginAllowed } = await import('@/app/login/_actions')
    expect(await checkLoginAllowed('   ')).toEqual({ error: 'Email is required' })
  })
})
