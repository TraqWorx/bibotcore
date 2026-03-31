import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export default async function PortalAppointmentsPage({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect(`/portal/login?locationId=${locationId}`)

  const sb = createAdminClient()
  const { data: portalUser } = await sb
    .from('portal_users')
    .select('contact_ghl_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!portalUser) redirect(`/portal/login?locationId=${locationId}`)

  const [{ data: events }, { data: calendars }] = await Promise.all([
    sb.from('cached_calendar_events')
      .select('ghl_id, calendar_id, title, start_time, end_time, appointment_status')
      .eq('location_id', locationId)
      .eq('contact_ghl_id', portalUser.contact_ghl_id)
      .order('start_time', { ascending: false }),
    sb.from('cached_calendars')
      .select('ghl_id, name')
      .eq('location_id', locationId),
  ])

  const calendarMap = new Map((calendars ?? []).map((c) => [c.ghl_id, c.name ?? '']))
  const now = new Date()

  const upcoming = (events ?? []).filter((e) => e.start_time && new Date(e.start_time) >= now)
  const past = (events ?? []).filter((e) => e.start_time && new Date(e.start_time) < now)

  function formatDateTime(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    confirmed: { label: 'Confermato', bg: 'bg-green-50', text: 'text-green-700' },
    showed: { label: 'Presente', bg: 'bg-green-50', text: 'text-green-700' },
    noshow: { label: 'Assente', bg: 'bg-red-50', text: 'text-red-700' },
    cancelled: { label: 'Cancellato', bg: 'bg-gray-100', text: 'text-gray-500' },
    pending: { label: 'In attesa', bg: 'bg-amber-50', text: 'text-amber-700' },
  }

  function renderEvent(e: typeof events extends (infer T)[] | null ? T : never) {
    if (!e) return null
    const status = statusConfig[e.appointment_status ?? ''] ?? { label: e.appointment_status ?? '—', bg: 'bg-gray-100', text: 'text-gray-500' }
    return (
      <div key={e.ghl_id} className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/50 p-4">
        <div>
          <p className="font-medium text-gray-900">{e.title ?? calendarMap.get(e.calendar_id ?? '') ?? 'Appuntamento'}</p>
          <p className="mt-0.5 text-xs text-gray-400">{formatDateTime(e.start_time)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.bg} ${status.text}`}>
          {status.label}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Appuntamenti</h1>

      {/* Upcoming */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-400">Prossimi</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400">Nessun appuntamento in programma.</p>
        ) : (
          <div className="space-y-3">{upcoming.map(renderEvent)}</div>
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-400">Passati</h2>
          <div className="space-y-3">{past.map(renderEvent)}</div>
        </div>
      )}
    </div>
  )
}
