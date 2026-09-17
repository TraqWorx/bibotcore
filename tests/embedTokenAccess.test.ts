import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerify = vi.fn()

vi.mock('@/lib/auth/verifyEmbedToken', () => ({
  verifyEmbedToken: (...args: unknown[]) => mockVerify(...args),
}))

import { getEmbedTokenGrant } from '@/lib/auth/embedTokenAccess'

function request(token?: string) {
  return new NextRequest('https://example.com/api/widgets/data', {
    headers: token ? { 'x-embed-token': token } : {},
  })
}

describe('getEmbedTokenGrant', () => {
  beforeEach(() => mockVerify.mockReset())

  it('grants nothing without a token header', async () => {
    expect(await getEmbedTokenGrant(request(), 'loc_1')).toBeNull()
    expect(mockVerify).not.toHaveBeenCalled()
  })

  it('grants nothing when the token does not match the location', async () => {
    mockVerify.mockResolvedValue(null)
    expect(await getEmbedTokenGrant(request('wrong'), 'loc_1')).toBeNull()
    expect(mockVerify).toHaveBeenCalledWith('loc_1', 'wrong')
  })

  it('limits a valid token to the data sources its dashboard uses', async () => {
    mockVerify.mockResolvedValue({
      config: [
        { type: 'custom', customConfig: { dataSource: 'contacts' } },
        { type: 'custom', customConfig: { tabs: [{ label: 'A', dataSource: 'opportunities' }] } },
      ],
    })
    const grant = await getEmbedTokenGrant(request('good'), 'loc_1')
    expect(grant).not.toBeNull()
    expect([...grant!.dataSources].sort()).toEqual(['contacts', 'none', 'opportunities', 'users'])
    expect(grant!.dataSources.has('conversations')).toBe(false)
  })
})
