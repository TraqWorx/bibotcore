import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createAuthClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

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

describe('tenant role helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    mockGetUser.mockReset()
    mockFrom.mockReset()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user_1' } } })
  })

  it('does not elevate platform admins for locations outside their agency', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createQueryResult({ role: 'admin', agency_id: 'agency_1' })
      if (table === 'profile_locations') return createQueryResult(null)
      if (table === 'locations') return createQueryResult({ agency_id: 'agency_2' })
      throw new Error(`Unexpected table ${table}`)
    })

    const { getUserRoles, hasMinimumRole, requireLocationRole } = await import('@/lib/auth/checkRole')
    const roles = await getUserRoles('loc_1')

    expect(roles).toMatchObject({
      userId: 'user_1',
      platformRole: 'admin',
      locationRole: null,
    })
    expect(hasMinimumRole(roles!, 'viewer')).toBe(false)
    await expect(requireLocationRole('loc_1', 'location_admin')).rejects.toThrow('Insufficient permissions')
  })

  it('allows platform admins only for locations in their agency', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createQueryResult({ role: 'admin', agency_id: 'agency_1' })
      if (table === 'profile_locations') return createQueryResult(null)
      if (table === 'locations') return createQueryResult({ agency_id: 'agency_1' })
      throw new Error(`Unexpected table ${table}`)
    })

    const { getUserRoles, hasMinimumRole } = await import('@/lib/auth/checkRole')
    const roles = await getUserRoles('loc_1')

    expect(roles).toMatchObject({
      userId: 'user_1',
      platformRole: 'admin',
      locationRole: null,
    })
    expect(hasMinimumRole(roles!, 'location_admin')).toBe(true)
  })
})
