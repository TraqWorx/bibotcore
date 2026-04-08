import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import type { CustomDataSource } from '@/lib/widgets/types'

const GHL_BASE = 'https://services.leadconnectorhq.com'

const ENDPOINT_MAP: Record<CustomDataSource, string> = {
  contacts: '/contacts/',
  opportunities: '/opportunities/search',
  pipelines: '/opportunities/pipelines',
  users: '/users/search',
  calendars: '/calendars/',
  tasks: '/contacts/{contactId}/tasks',
  conversations: '/conversations/search',
  invoices: '/invoices/',
  tags: '/locations/{locationId}/tags',
  none: '',
}

export async function POST(req: NextRequest) {
  const { locationId, dataSource, endpoint, filters } = await req.json() as {
    locationId: string
    dataSource: CustomDataSource
    endpoint?: string
    filters?: Record<string, string>
  }

  if (!locationId || !dataSource) {
    return NextResponse.json({ error: 'locationId and dataSource required' }, { status: 400 })
  }

  // Auth check
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Static/computed widgets don't need GHL
  if (dataSource === 'none') {
    return NextResponse.json({ data: null })
  }

  // Get GHL connection for this location
  const sb = createAdminClient()
  const { data: conn } = await sb.from('ghl_connections').select('access_token, refresh_token, expires_at, company_id').eq('location_id', locationId).single()
  if (!conn?.access_token) {
    return NextResponse.json({ error: 'No GHL connection for this location' }, { status: 400 })
  }

  const token = await refreshIfNeeded(locationId, conn)
  const companyId = conn.company_id ?? process.env.GHL_COMPANY_ID

  // Build URL
  let path = endpoint ?? ENDPOINT_MAP[dataSource] ?? ''
  path = path.replace('{locationId}', locationId)

  const url = new URL(`${GHL_BASE}${path}`)
  // Add locationId/location_id based on endpoint
  if (dataSource === 'contacts') {
    url.searchParams.set('locationId', locationId)
    url.searchParams.set('limit', '100')
  } else if (dataSource === 'opportunities') {
    url.searchParams.set('location_id', locationId)
  } else if (dataSource === 'users' && companyId) {
    url.searchParams.set('companyId', companyId)
    url.searchParams.set('locationId', locationId)
    url.searchParams.set('limit', '100')
  } else if (dataSource === 'pipelines') {
    url.searchParams.set('locationId', locationId)
  } else if (dataSource === 'calendars') {
    url.searchParams.set('locationId', locationId)
  } else if (dataSource === 'conversations') {
    url.searchParams.set('locationId', locationId)
  } else if (dataSource === 'invoices') {
    url.searchParams.set('locationId', locationId)
    url.searchParams.set('limit', '100')
  }

  // Apply user filters
  for (const [k, v] of Object.entries(filters ?? {})) {
    url.searchParams.set(k, v)
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: '2021-07-28',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[widgets/data] GHL ${dataSource} error:`, res.status, text)
      return NextResponse.json({ error: `GHL API error: ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[widgets/data] fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
