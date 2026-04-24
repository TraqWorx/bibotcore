import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ campaigns: [] })

  const sb = createAdminClient()
  const { data } = await sb
    .from('drip_jobs')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ campaigns: data ?? [] })
}
