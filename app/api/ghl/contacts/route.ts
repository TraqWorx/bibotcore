import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'


export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) {
    return NextResponse.json({ error: 'Missing locationId' }, { status: 400 })
  }

  const access = await getLocationAccess(req, locationId)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createAdminClient()
  const { data: connection } = await supabase
    .from('ghl_connections')
    .select('access_token')
    .eq('location_id', locationId)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'GHL connection not found' }, { status: 404 })
  }

  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=5`,
      {
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'Version': '2021-04-15',
          'Content-Type': 'application/json',
        },
      }
    )

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}