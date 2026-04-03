import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

vi.mock('@/lib/supabase-server', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

function buildRequest() {
  return new NextRequest('https://example.com/api/dashboard?locationId=loc_123')
}

function createQueryResult(data: unknown) {
  return {
    select() {
      return this
    },
    eq() {
      return this
    },
    single: vi.fn(async () => ({ data })),
    maybeSingle: vi.fn(async () => ({ data })),
  }
}

describe('getLocationAccess', () => {
  beforeEach(() => {
    vi.resetModules()
    mockGetUser.mockReset()
    mockFrom.mockReset()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
  })

  it('returns unauthenticated when there is no active user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { getLocationAccess } = await import('@/lib/auth/assertLocationAccess')
    const result = await getLocationAccess(buildRequest(), 'loc_123')

    expect(result).toEqual({ status: 'unauthenticated' })
  })

  it('allows super admins without a location membership row', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user_1', email: 'admin@example.com' } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createQueryResult({ role: 'super_admin' })
      if (table === 'profile_locations') return createQueryResult(null)
      if (table === 'installs') return createQueryResult(null)
      throw new Error(`Unexpected table ${table}`)
    })

    const { getLocationAccess } = await import('@/lib/auth/assertLocationAccess')
    const result = await getLocationAccess(buildRequest(), 'loc_123')

    expect(result).toEqual({
      status: 'authorized',
      userId: 'user_1',
      email: 'admin@example.com',
      isSuperAdmin: true,
    })
  })

  it('falls back to installs access when profile_locations is empty', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user_2', email: 'member@example.com' } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createQueryResult({ role: 'team_member' })
      if (table === 'profile_locations') return createQueryResult(null)
      if (table === 'installs') return createQueryResult({ location_id: 'loc_123' })
      throw new Error(`Unexpected table ${table}`)
    })

    const { getLocationAccess } = await import('@/lib/auth/assertLocationAccess')
    const result = await getLocationAccess(buildRequest(), 'loc_123')

    expect(result).toEqual({
      status: 'authorized',
      userId: 'user_2',
      email: 'member@example.com',
      isSuperAdmin: false,
    })
  })

  it('returns forbidden when the user has no matching access path', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user_3', email: 'viewer@example.com' } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createQueryResult({ role: 'viewer' })
      if (table === 'profile_locations') return createQueryResult(null)
      if (table === 'installs') return createQueryResult(null)
      throw new Error(`Unexpected table ${table}`)
    })

    const { getLocationAccess } = await import('@/lib/auth/assertLocationAccess')
    const result = await getLocationAccess(buildRequest(), 'loc_123')

    expect(result).toEqual({ status: 'forbidden' })
  })
})
