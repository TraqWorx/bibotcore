import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerify = vi.fn()
const mockSubscription = vi.fn()

vi.mock('@/lib/auth/verifyEmbedToken', () => ({
  verifyEmbedToken: (...args: unknown[]) => mockVerify(...args),
}))

vi.mock('@/lib/supabase-server', () => ({
  createAdminClient: () => {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: () => Promise.resolve({ data: mockSubscription() }),
    }
    return { from: () => q }
  },
}))

import { embedFiltersAllowed, getEmbedTokenGrant } from '@/lib/auth/embedTokenAccess'

const BIBOT = 'e7b3d0d8-5682-44d5-87c1-c449e6814f15'

function request(token?: string) {
  return new NextRequest('https://example.com/api/widgets/data', {
    headers: token ? { 'x-embed-token': token } : {},
  })
}

const dashboard = [
  { type: 'custom', options: { customConfig: { dataSource: 'contacts', filters: { tags: 'vip' } } } },
  { type: 'custom', options: { customConfig: { tabs: [{ label: 'A', dataSource: 'opportunities' }] } } },
]

describe('getEmbedTokenGrant', () => {
  beforeEach(() => {
    mockVerify.mockReset()
    mockSubscription.mockReset()
  })

  it('grants nothing without a token header', async () => {
    expect(await getEmbedTokenGrant(request(), 'loc_1')).toBeNull()
    expect(mockVerify).not.toHaveBeenCalled()
  })

  it('grants nothing when the token does not match the location', async () => {
    mockVerify.mockResolvedValue(null)
    expect(await getEmbedTokenGrant(request('wrong'), 'loc_1')).toBeNull()
    expect(mockVerify).toHaveBeenCalledWith('loc_1', 'wrong')
  })

  it('limits a valid token to the data sources its dashboard uses, without the team list', async () => {
    mockVerify.mockResolvedValue({ agency_id: BIBOT, config: dashboard })
    const grant = await getEmbedTokenGrant(request('good'), 'loc_1')
    expect([...grant!.dataSources].sort()).toEqual(['contacts', 'none', 'opportunities'])
    expect(grant!.dataSources.has('users')).toBe(false)
  })

  it('refuses tokens for non-Bibot locations without an active subscription', async () => {
    mockVerify.mockResolvedValue({ agency_id: 'other', config: dashboard })
    mockSubscription.mockReturnValue(null)
    expect(await getEmbedTokenGrant(request('good'), 'loc_1')).toBeNull()
    mockSubscription.mockReturnValue({ status: 'active' })
    expect(await getEmbedTokenGrant(request('good'), 'loc_1')).not.toBeNull()
  })
})

describe('embedFiltersAllowed', () => {
  it('accepts only the filters a saved widget uses', async () => {
    mockVerify.mockResolvedValue({ agency_id: BIBOT, config: dashboard })
    const grant = (await getEmbedTokenGrant(request('good'), 'loc_1'))!
    expect(embedFiltersAllowed(grant, 'contacts', { tags: 'vip' })).toBe(true)
    expect(embedFiltersAllowed(grant, 'contacts', { tags: 'vip', query: 'gmail' })).toBe(false)
    expect(embedFiltersAllowed(grant, 'contacts', {})).toBe(false)
    expect(embedFiltersAllowed(grant, 'opportunities', undefined)).toBe(true)
    expect(embedFiltersAllowed(grant, 'opportunities', { startAfterId: 'x' })).toBe(false)
  })
})
