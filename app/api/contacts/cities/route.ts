import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ cities: [] })

  const access = await getLocationAccess(req, locationId)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = createAdminClient()
  const { data } = await sb
    .from('cached_contacts')
    .select('city')
    .eq('location_id', locationId)
    .not('city', 'is', null)
    .neq('city', '')

  const cities = [...new Set((data ?? []).map((d) => d.city as string))].sort()
  return NextResponse.json({ cities })
}
