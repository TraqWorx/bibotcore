import Link from 'next/link'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import WeekCalendar from './WeekCalendar'
import SimfoniaPageHeader from '../_components/SimfoniaPageHeader'
import { sf } from '@/lib/simfonia/ui'

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
      <div className={`${sf.emptyPanel}`}>
        <p className="text-sm font-medium text-gray-500">Nessuna location connessa.</p>
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
        <div className="rounded-3xl border border-amber-200/80 bg-amber-50/80 p-10 text-center shadow-sm backdrop-blur-sm">
          <p className="text-sm font-semibold text-amber-900">Connessione non autorizzata per questa funzione.</p>
          <p className="mt-1 text-xs text-amber-700">Riconnetti la location con gli scope aggiornati.</p>
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
    <div className="space-y-8">
      <SimfoniaPageHeader
        eyebrow="Agenda"
        title="Calendario"
        description={
          <>
            <span className="font-semibold text-gray-800">{events.length}</span> appuntamenti in cache per questa location.
          </>
        }
        actions={
          <Link
            href={`/designs/simfonia/calendar/new?locationId=${locationId}`}
            className={sf.primaryBtn}
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 88%, white) 100%)',
            }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuovo appuntamento
          </Link>
        }
      />

      <div className="rounded-3xl border border-gray-200/70 bg-white/85 p-4 shadow-sm backdrop-blur-md sm:p-5">
        <WeekCalendar
          events={events}
          users={users}
          isAdmin={isAdmin}
          currentUserId={currentGhlUser?.id ?? null}
        />
      </div>
    </div>
  )
}
