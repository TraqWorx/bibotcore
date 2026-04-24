import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ cities: [] })

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
