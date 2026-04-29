import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const GHL_BASE = 'https://services.leadconnectorhq.com'
const BIBOT_AGENCY_ID = 'e7b3d0d8-5682-44d5-87c1-c449e6814f15'

interface GhlLocation {
  id: string
  name?: string
  dateAdded?: string
}

function authorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const secret = req.headers.get('authorization')?.replace('Bearer ', '') ?? req.nextUrl.searchParams.get('secret')
  return Boolean(process.env.CRON_SECRET) && secret === process.env.CRON_SECRET
}

async function run(): Promise<{ added: number; updated: number; total: number }> {
  const token = process.env.GHL_AGENCY_TOKEN
  const companyId = process.env.GHL_COMPANY_ID
  if (!token || !companyId) throw new Error('Missing GHL_AGENCY_TOKEN or GHL_COMPANY_ID')

  const res = await fetch(`${GHL_BASE}/locations/search?limit=200&companyId=${companyId}`, {
    headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`GHL locations/search failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const ghlLocations: GhlLocation[] = data?.locations ?? data?.data ?? []

  const sb = createAdminClient()

  // Existing rows so we can distinguish new vs updated.
  const { data: existing } = await sb
    .from('locations')
    .select('location_id, name')
    .eq('agency_id', BIBOT_AGENCY_ID)
  const existingByLoc = new Map((existing ?? []).map((e) => [e.location_id, e.name]))

  let added = 0
  let updated = 0

  for (const loc of ghlLocations) {
    if (!loc.id) continue
    const wasPresent = existingByLoc.has(loc.id)
    const wasName = existingByLoc.get(loc.id)
    const newName = loc.name ?? loc.id

    const payload: Record<string, unknown> = {
      location_id: loc.id,
      name: newName,
      agency_id: BIBOT_AGENCY_ID,
    }
    if (loc.dateAdded) payload.ghl_date_added = loc.dateAdded

    const { error } = await sb.from('locations').upsert(payload, { onConflict: 'location_id' })
    if (error) {
      console.error(`[sync-ghl-locations] upsert ${loc.id} failed:`, error.message)
      continue
    }
    if (!wasPresent) added++
    else if (wasName !== newName) updated++
  }

  return { added, updated, total: ghlLocations.length }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await run())
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
