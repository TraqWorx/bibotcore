import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getLocationAccess } from '@/lib/auth/assertLocationAccess'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'
const V = '2021-04-15'
const V_SCHED = 'v3'

async function getToken(): Promise<string> {
  const sb = createAdminClient()
  const { data: conn } = await sb
    .from('ghl_connections')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .single()
  if (!conn) throw new Error('No GHL connection')
  return refreshIfNeeded(BELLESSERE_LOCATION_ID, conn)
}

// POST — full sync: users, groups, services, schedules
export async function POST(req: NextRequest) {
  const access = await getLocationAccess(req, BELLESSERE_LOCATION_ID)
  if (access.status === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (access.status === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = await getToken()
  const sb = createAdminClient()

  // Fetch all GHL data in parallel
  const [usersRes, groupsRes, calsRes] = await Promise.all([
    fetch(`${GHL}/users/?locationId=${BELLESSERE_LOCATION_ID}`, { headers: { Authorization: `Bearer ${token}`, Version: V } }),
    fetch(`${GHL}/calendars/groups?locationId=${BELLESSERE_LOCATION_ID}`, { headers: { Authorization: `Bearer ${token}`, Version: V } }),
    fetch(`${GHL}/calendars/?locationId=${BELLESSERE_LOCATION_ID}`, { headers: { Authorization: `Bearer ${token}`, Version: V } }),
  ])
  const [usersData, groupsData, calsData] = await Promise.all([usersRes.json(), groupsRes.json(), calsRes.json()])

  const users: { id: string; name: string; email: string; phone?: string }[] = usersData.users ?? []
  const groups: { id: string; name: string }[] = groupsData.groups ?? []
  const calendars: Record<string, unknown>[] = calsData.calendars ?? []
  const services = calendars.filter(c => c.calendarType === 'service')

  // Fetch schedules for each user in parallel
  const schedules: { id: string; userId: string; name: string; rules: unknown[]; timezone: string }[] = []
  await Promise.all(users.map(async (u) => {
    try {
      const res = await fetch(
        `${GHL}/calendars/schedules/search?locationId=${BELLESSERE_LOCATION_ID}&userId=${u.id}&limit=1`,
        { headers: { Authorization: `Bearer ${token}`, Version: V_SCHED } }
      )
      const d = await res.json()
      const s = d.schedules?.[0]
      if (s) schedules.push({ id: s.id, userId: u.id, name: s.name ?? '', rules: s.rules ?? [], timezone: s.timezone ?? 'Europe/Rome' })
    } catch { /* skip */ }
  }))

  const now = new Date().toISOString()

  // Upsert all tables in parallel
  const [uUsers, uGroups, uServices, uSchedules] = await Promise.all([
    sb.from('bellessere_users').upsert(
      users.map(u => ({ id: u.id, location_id: BELLESSERE_LOCATION_ID, name: u.name, email: u.email, phone: u.phone ?? null, synced_at: now })),
      { onConflict: 'id' }
    ),
    sb.from('bellessere_groups').upsert(
      groups.map(g => ({ id: g.id, location_id: BELLESSERE_LOCATION_ID, name: g.name, synced_at: now })),
      { onConflict: 'id' }
    ),
    sb.from('bellessere_services').upsert(
      services.map(s => ({
        id: s.id as string,
        location_id: BELLESSERE_LOCATION_ID,
        name: s.name as string,
        description: (s.description as string) ?? null,
        slot_duration: (s.slotDuration as number) ?? null,
        slot_interval: (s.slotInterval as number) ?? null,
        slot_buffer: (s.slotBuffer as number) ?? null,
        pre_buffer: (s.preBuffer as number) ?? null,
        price: (s.price as number) ?? null,
        group_id: (s.groupId as string) ?? null,
        team_members: s.teamMembers ?? [],
        is_active: (s.isActive as boolean) ?? true,
        synced_at: now,
      })),
      { onConflict: 'id' }
    ),
    schedules.length > 0
      ? sb.from('bellessere_schedules').upsert(
          schedules.map(s => ({
            id: s.id,
            location_id: BELLESSERE_LOCATION_ID,
            user_id: s.userId,
            name: s.name,
            rules: s.rules,
            timezone: s.timezone,
            synced_at: now,
          })),
          { onConflict: 'id' }
        )
      : Promise.resolve({ error: null }),
  ])

  const errors = [uUsers.error, uGroups.error, uServices.error, uSchedules.error].filter(Boolean)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0]!.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    synced: { users: users.length, groups: groups.length, services: services.length, schedules: schedules.length },
  })
}
