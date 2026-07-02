import { createAdminClient } from '@/lib/supabase-server'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from './constants'

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
  if (!conn) throw new Error('No GHL connection for Bellessere')
  return refreshIfNeeded(BELLESSERE_LOCATION_ID, conn)
}

export async function syncBellessere(scope: 'all' | 'users' | 'appointments' = 'all') {
  const token = await getToken()
  const sb = createAdminClient()
  const now = new Date().toISOString()

  if (scope === 'all') {
    const [usersRes, groupsRes, calsRes] = await Promise.all([
      fetch(`${GHL}/users/?locationId=${BELLESSERE_LOCATION_ID}`, { headers: { Authorization: `Bearer ${token}`, Version: V } }),
      fetch(`${GHL}/calendars/groups?locationId=${BELLESSERE_LOCATION_ID}`, { headers: { Authorization: `Bearer ${token}`, Version: V } }),
      fetch(`${GHL}/calendars/?locationId=${BELLESSERE_LOCATION_ID}`, { headers: { Authorization: `Bearer ${token}`, Version: V } }),
    ])
    const [usersData, groupsData, calsData] = await Promise.all([usersRes.json(), groupsRes.json(), calsRes.json()])

    const users: { id: string; name: string; email: string; phone?: string }[] = usersData.users ?? []
    const groups: { id: string; name: string }[] = groupsData.groups ?? []
    const services = ((calsData.calendars ?? []) as Record<string, unknown>[]).filter(c => c.calendarType !== 'personal')

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

    await Promise.all([
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
        : Promise.resolve(),
    ])

    return { users: users.length, groups: groups.length, services: services.length, schedules: schedules.length }
  }

  if (scope === 'users') {
    const res = await fetch(`${GHL}/users/?locationId=${BELLESSERE_LOCATION_ID}`, {
      headers: { Authorization: `Bearer ${token}`, Version: V },
    })
    const data = await res.json()
    const users: { id: string; name: string; email: string; phone?: string }[] = data.users ?? []
    if (!res.ok) return { users: 0 }
    if (users.length > 0) {
      await sb.from('bellessere_users').upsert(
        users.map(u => ({ id: u.id, location_id: BELLESSERE_LOCATION_ID, name: u.name, email: u.email, phone: u.phone ?? null, synced_at: now })),
        { onConflict: 'id' }
      )
    }
    // Reconcile deletions: drop cached members (and their schedules) that no
    // longer exist in GHL — so removing a user directly in GHL is reflected too.
    const ghlIds = users.map(u => u.id)
    if (ghlIds.length > 0) {
      const inList = `(${ghlIds.join(',')})`
      await sb.from('bellessere_users').delete().eq('location_id', BELLESSERE_LOCATION_ID).not('id', 'in', inList)
      await sb.from('bellessere_schedules').delete().eq('location_id', BELLESSERE_LOCATION_ID).not('user_id', 'in', inList)
    }
    return { users: users.length }
  }

  if (scope === 'appointments') {
    // Sync last 6 months + 3 months ahead. GHL's /calendars/events 422s without a
    // calendarId/userId/groupId, so fan out over groups (via the shared helper) and
    // store the operator from assignedUserId → user_id.
    const { fetchBellessereEvents } = await import('./events')
    const start = new Date(); start.setMonth(start.getMonth() - 6)
    const end = new Date(); end.setMonth(end.getMonth() + 3)
    const events = await fetchBellessereEvents(token, start.getTime(), end.getTime())
    if (events.length > 0) {
      const rows = events.map(e => ({
        ghl_id: e.id,
        location_id: BELLESSERE_LOCATION_ID,
        calendar_id: e.calendarId,
        contact_ghl_id: e.contactId,
        user_id: e.userId,
        title: e.title,
        start_time: e.startTime,
        end_time: e.endTime,
        appointment_status: e.appointmentStatus,
        synced_at: now,
      }))
      for (let i = 0; i < rows.length; i += 200) {
        await sb.from('cached_calendar_events').upsert(rows.slice(i, i + 200), { onConflict: 'location_id,ghl_id' })
      }
    }
    return { appointments: events.length }
  }
}

const STALE_MS = 60 * 60 * 1000 // 1 hour

export async function ensureFresh() {
  const sb = createAdminClient()
  const { count } = await sb
    .from('bellessere_services')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', BELLESSERE_LOCATION_ID)

  if ((count ?? 0) === 0) {
    // Tables empty — sync inline and wait
    await syncBellessere('all')
    return
  }

  // Check staleness
  const { data } = await sb
    .from('bellessere_services')
    .select('synced_at')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .order('synced_at', { ascending: true })
    .limit(1)
    .single()

  if (data && Date.now() - new Date(data.synced_at).getTime() > STALE_MS) {
    // Stale — refresh in background, don't block
    syncBellessere('all').catch(() => {})
  }
}
