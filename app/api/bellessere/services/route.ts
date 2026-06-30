import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'
const CAL_V = '2021-04-15'
const USR_V = '2021-07-28'
const SERVICES_TTL = 5 * 60 * 1000  // 5 minutes
const CACHE_KEY = '_servicesCache'

// L1: in-memory (warm within same instance, zero latency)
let memCache: { data: unknown; ts: number } | null = null

async function getToken(): Promise<string> {
  const sb = createAdminClient()
  const { data: conn } = await sb
    .from('ghl_connections')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .single()
  if (!conn) throw new Error('No GHL connection for Bellessere')
  return refreshIfNeeded(BELLESSERE_LOCATION_ID, conn)
}

async function authCheck(req: NextRequest) {
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

function cacheHeaders() {
  return { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' }
}

async function readDbCache(sb: ReturnType<typeof createAdminClient>) {
  const { data } = await sb
    .from('dashboard_configs')
    .select('theme')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .maybeSingle()
  const theme = (data?.theme as Record<string, unknown>) ?? {}
  return { theme, entry: theme[CACHE_KEY] as { ts: number; data: unknown } | undefined }
}

async function writeDbCache(sb: ReturnType<typeof createAdminClient>, theme: Record<string, unknown>, payload: unknown) {
  const newTheme = { ...theme, [CACHE_KEY]: { ts: Date.now(), data: payload } }
  await sb.from('dashboard_configs').upsert(
    { location_id: BELLESSERE_LOCATION_ID, theme: newTheme },
    { onConflict: 'location_id' }
  )
}

// GET — list all calendars (= services) + location users + groups
export async function GET(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const bust = req.nextUrl.searchParams.get('bust')

  // L1: in-memory
  if (!bust && memCache && Date.now() - memCache.ts < SERVICES_TTL) {
    return NextResponse.json(memCache.data, { headers: cacheHeaders() })
  }

  const sb = createAdminClient()

  // L2: Supabase DB (survives across Vercel instances)
  if (!bust) {
    const { theme, entry } = await readDbCache(sb)
    if (entry && Date.now() - entry.ts < SERVICES_TTL) {
      memCache = { data: entry.data, ts: entry.ts }
      return NextResponse.json(entry.data, { headers: cacheHeaders() })
    }
    // Cache miss — fetch from GHL and store
    const payload = await fetchFromGhl()
    memCache = { data: payload, ts: Date.now() }
    writeDbCache(sb, theme, payload).catch(() => {}) // async, don't block response
    return NextResponse.json(payload, { headers: cacheHeaders() })
  }

  // bust=1: skip cache entirely
  const payload = await fetchFromGhl()
  memCache = { data: payload, ts: Date.now() }
  const { theme } = await readDbCache(sb)
  writeDbCache(sb, theme, payload).catch(() => {})
  return NextResponse.json(payload, { headers: cacheHeaders() })
}

async function fetchFromGhl() {
  const token = await getToken()
  const [calsRes, usersRes, groupsRes] = await Promise.all([
    fetch(`${GHL}/calendars/?locationId=${BELLESSERE_LOCATION_ID}`, {
      headers: { Authorization: `Bearer ${token}`, Version: CAL_V },
    }),
    fetch(`${GHL}/users/?locationId=${BELLESSERE_LOCATION_ID}`, {
      headers: { Authorization: `Bearer ${token}`, Version: USR_V },
    }),
    fetch(`${GHL}/calendars/groups?locationId=${BELLESSERE_LOCATION_ID}`, {
      headers: { Authorization: `Bearer ${token}`, Version: CAL_V },
    }),
  ])
  const [cals, users, groups] = await Promise.all([calsRes.json(), usersRes.json(), groupsRes.json()])
  return { calendars: cals.calendars ?? [], users: users.users ?? [], groups: groups.groups ?? [] }
}

function bustCache(sb: ReturnType<typeof createAdminClient>) {
  memCache = null
  readDbCache(sb).then(({ theme }) => {
    const newTheme = { ...theme }
    delete newTheme[CACHE_KEY]
    void sb.from('dashboard_configs').upsert({ location_id: BELLESSERE_LOCATION_ID, theme: newTheme }, { onConflict: 'location_id' })
  }).catch(() => {})
}

// POST — create a calendar (service)
export async function POST(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const { name, description, duration, price, teamMembers = [], color = '#1B2E4A', groupId, slotInterval, slotBuffer, preBuffer } = await req.json()
  if (!name || !duration) return NextResponse.json({ error: 'name and duration required' }, { status: 400 })

  const token = await getToken()
  const payload: Record<string, unknown> = {
    locationId: BELLESSERE_LOCATION_ID,
    name,
    description: description ?? '',
    slotDuration: Number(duration),
    slotInterval: slotInterval != null ? Number(slotInterval) : Number(duration),
    eventColor: color,
    isActive: true,
    price: price ? Number(price) : undefined,
    teamMembers: teamMembers.map((id: string) => ({ userId: id, priority: 0, meetingLocationType: 'default' })),
    calendarType: 'service',
  }
  if (groupId) payload.groupId = groupId
  if (slotBuffer != null) payload.slotBuffer = Number(slotBuffer)
  if (preBuffer != null) payload.preBuffer = Number(preBuffer)

  const res = await fetch(`${GHL}/calendars/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Version: CAL_V, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (res.ok) bustCache(createAdminClient())
  return NextResponse.json(data, { status: res.status })
}

// PUT — update a calendar
export async function PUT(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const { calendarId, name, description, duration, price, teamMembers, color, groupId, slotInterval, slotBuffer, preBuffer } = await req.json()
  if (!calendarId) return NextResponse.json({ error: 'calendarId required' }, { status: 400 })

  const token = await getToken()
  const payload: Record<string, unknown> = {}
  if (name !== undefined) payload.name = name
  if (description !== undefined) payload.description = description
  if (duration !== undefined) payload.slotDuration = Number(duration)
  if (slotInterval !== undefined) payload.slotInterval = Number(slotInterval)
  else if (duration !== undefined) payload.slotInterval = Number(duration)
  if (slotBuffer !== undefined) payload.slotBuffer = Number(slotBuffer)
  if (preBuffer !== undefined) payload.preBuffer = Number(preBuffer)
  if (price !== undefined) payload.price = Number(price)
  if (color !== undefined) payload.eventColor = color
  if (groupId !== undefined) payload.groupId = groupId
  if (teamMembers !== undefined) {
    payload.teamMembers = teamMembers.map((id: string) => ({ userId: id, priority: 0, meetingLocationType: 'default' }))
  }

  const res = await fetch(`${GHL}/calendars/${calendarId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Version: CAL_V, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (res.ok) bustCache(createAdminClient())
  return NextResponse.json(data, { status: res.status })
}

// DELETE — delete a calendar
export async function DELETE(req: NextRequest) {
  const err = await authCheck(req)
  if (err) return err

  const { calendarId } = await req.json()
  if (!calendarId) return NextResponse.json({ error: 'calendarId required' }, { status: 400 })

  const token = await getToken()
  const res = await fetch(`${GHL}/calendars/${calendarId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Version: CAL_V },
  })
  if (res.ok) bustCache(createAdminClient())
  return NextResponse.json({ ok: res.ok }, { status: res.status })
}
