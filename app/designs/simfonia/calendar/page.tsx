import Link from 'next/link'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import WeekCalendar from './WeekCalendar'

interface GhlUser {
  id: string
  name: string
  email: string
  role?: string
}

async function fetchGhlUsers(locationId: string): Promise<GhlUser[]> {
  const sb = createAdminClient()
  const { data: cached } = await sb
    .from('cached_ghl_users')
    .select('ghl_id, name, first_name, last_name, email, role')
    .eq('location_id', locationId)
  if (!cached || cached.length === 0) return []
  return cached.map((u) => ({
    id: u.ghl_id,
    name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.ghl_id,
    email: u.email ?? '',
    role: u.role ?? undefined,
  }))
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locationId = await getActiveLocation(await searchParams).catch(() => null)

  if (!locationId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">Nessuna location connessa.</p>
      </div>
    )
  }

  const authClient = await createAuthClient()
  const supabase = createAdminClient()

  let data: Record<string, unknown> | null = null
  let ghlUsers: GhlUser[] = []
  let authUser: { id: string; email?: string } | null = null

  try {
    // Read calendar events from Supabase cache
    const { data: cachedEvents } = await supabase
      .from('cached_calendar_events')
      .select('ghl_id, calendar_id, contact_ghl_id, title, start_time, end_time, appointment_status')
      .eq('location_id', locationId)
    const calData = {
      events: (cachedEvents ?? []).map((e) => ({
        id: e.ghl_id, calendarId: e.calendar_id, contactId: e.contact_ghl_id,
        title: e.title, startTime: e.start_time, endTime: e.end_time,
        appointmentStatus: e.appointment_status,
      })),
    } as Record<string, unknown>

    const [users, { data: { user } }] = await Promise.all([
      fetchGhlUsers(locationId),
      authClient.auth.getUser(),
    ])
    data = calData as Record<string, unknown>
    ghlUsers = users
    authUser = user
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('401') || msg.includes('not authorized')) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center">
          <p className="text-sm font-medium text-amber-800">Token GHL non autorizzato per questa funzione.</p>
          <p className="mt-1 text-xs text-amber-600">Riconnetti la location con gli scope aggiornati.</p>
        </div>
      )
    }
    throw err
  }

  // Determine if current user is admin
  const userEmail = authUser?.email?.toLowerCase() ?? ''
  const { data: profile } = authUser
    ? await supabase.from('profiles').select('role').eq('id', authUser.id).single()
    : { data: null }
  const isSuperAdmin = profile?.role === 'super_admin'
  const currentGhlUser = ghlUsers.find((u) => u.email.toLowerCase() === userEmail)
  const isGhlAdmin = currentGhlUser?.role === 'admin'
  const isAdmin = isSuperAdmin || isGhlAdmin

  const users = ghlUsers.map((u) => ({ id: u.id, name: u.name }))

  const events = (data?.events ?? []) as {
    id: string
    title?: string
    startTime?: string
    endTime?: string
    appointmentStatus?: string
    assignedUserId?: string
    contactId?: string
  }[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {events.length} appuntamenti
          </p>
        </div>
        <Link
          href={`/designs/simfonia/calendar/new?locationId=${locationId}`}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-black transition-all hover:opacity-90"
          style={{ background: '#00F0FF' }}
        >
          + Nuovo Appuntamento
        </Link>
      </div>

      <WeekCalendar
        events={events}
        users={users}
        isAdmin={isAdmin}
        currentUserId={currentGhlUser?.id ?? null}
      />
    </div>
  )
}
