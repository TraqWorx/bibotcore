import Link from 'next/link'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { createAdminClient } from '@/lib/supabase-server'
import { getOpportunitiesByContact } from '@/lib/data/opportunities'
import { listPipelines } from '@/lib/data/pipelines'
import { sf } from '@/lib/simfonia/ui'

interface CalendarEvent {
  id: string
  title?: string
  calendarId?: string
  startTime?: string
  appointmentStatus?: string
}

export default async function ContactProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ contactId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { contactId } = await params
  const sp = await searchParams
  const locationId = await getActiveLocation(sp).catch(() => null)
  if (!locationId) {
    return (
      <div className={`${sf.emptyPanel}`}>
        <p className="text-sm font-medium text-gray-500">Location non trovata.</p>
      </div>
    )
  }

  const sb = createAdminClient()

  // Fetch everything from cache
  const [
    { data: cached },
    { data: customFieldValues },
    { data: fieldDefs },
    cachedOpps,
    { pipelines },
    { data: cachedEvents },
    { data: cachedCalendars },
    { data: cachedConvos },
  ] = await Promise.all([
    sb.from('cached_contacts').select('first_name, last_name, email, phone, address1, city, tags, company_name').eq('location_id', locationId).eq('ghl_id', contactId).single(),
    sb.from('cached_contact_custom_fields').select('field_id, value').eq('location_id', locationId).eq('contact_ghl_id', contactId),
    sb.from('cached_custom_fields').select('field_id, name').eq('location_id', locationId),
    getOpportunitiesByContact(locationId, contactId),
    listPipelines(locationId),
    sb.from('cached_calendar_events').select('ghl_id, calendar_id, title, start_time, appointment_status').eq('location_id', locationId).eq('contact_ghl_id', contactId).order('start_time', { ascending: false }),
    sb.from('cached_calendars').select('ghl_id, name').eq('location_id', locationId),
    sb.from('cached_conversations').select('ghl_id, type, last_message_date, last_message_body').eq('location_id', locationId).eq('contact_ghl_id', contactId).order('last_message_date', { ascending: false }).limit(5),
  ])

  const contact = cached
    ? { firstName: cached.first_name, lastName: cached.last_name, email: cached.email, phone: cached.phone, address1: cached.address1, city: cached.city, tags: cached.tags ?? [], companyName: cached.company_name }
    : null

  const events: CalendarEvent[] = (cachedEvents ?? []).map((e) => ({
    id: e.ghl_id, title: e.title, calendarId: e.calendar_id, startTime: e.start_time, appointmentStatus: e.appointment_status,
  }))
  const conversations = (cachedConvos ?? []).map((c) => ({
    id: c.ghl_id, type: c.type, lastMessageDate: c.last_message_date, lastMessageBody: c.last_message_body,
  }))

  // Build field name map
  const fieldNameMap = new Map((fieldDefs ?? []).map((f) => [f.field_id, f.name ?? '']))
  const customFields = (customFieldValues ?? []).filter((cf) => cf.value).map((cf) => ({
    id: cf.field_id, value: cf.value, name: fieldNameMap.get(cf.field_id) ?? cf.field_id,
  }))

  // Build maps
  const stageMap: Record<string, string> = {}
  for (const pipeline of pipelines) {
    for (const stage of pipeline.stages ?? []) {
      stageMap[stage.id] = stage.name
    }
  }
  const calendarMap: Record<string, string> = {}
  for (const cal of cachedCalendars ?? []) {
    calendarMap[cal.ghl_id] = cal.name ?? ''
  }

  const fullName = [contact?.firstName, contact?.lastName].filter(Boolean).join(' ') || '—'
  const q = `?locationId=${locationId}`

  const tagColors: Record<string, string> = {
    energia:      'bg-amber-50 text-amber-700',
    telefonia:    'bg-blue-50 text-blue-700',
    wind:         'bg-purple-50 text-purple-700',
    fastweb:      'bg-orange-50 text-orange-700',
    connettivita: 'bg-teal-50 text-teal-700',
  }

  return (
    <div className="space-y-8">
      <Link
        href={`/designs/simfonia/contacts${q}`}
        className="inline-flex items-center gap-2 text-sm font-bold text-brand transition hover:underline hover:underline-offset-4"
      >
        ← Contatti
      </Link>

      {/* Header */}
      <div className={`${sf.card} ${sf.cardPadding} border-brand/15`}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">{fullName}</h1>
            <div className="mt-2 space-y-1 text-sm text-gray-500">
              {contact?.email && <p>✉ {contact.email}</p>}
              {contact?.phone && <p>📞 {contact.phone}</p>}
              {contact?.address1 && (
                <p>📍 {contact.address1}{contact.city ? `, ${contact.city}` : ''}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-end max-w-xs">
            {(contact?.tags ?? []).map((tag: string) => (
              <span
                key={tag}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  tagColors[tag.toLowerCase()] ?? 'bg-gray-100 text-gray-600'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Custom fields */}
      {customFields.length > 0 && (
        <section>
          <h2 className={`mb-3 ${sf.sectionLabel}`}>Campi personalizzati</h2>
          <div className={`${sf.card} overflow-hidden p-0`}>
            <dl className="divide-y divide-gray-50">
              {customFields.map((field) => (
                <div key={field.id} className="flex items-center gap-4 px-5 py-3">
                  <dt className="w-48 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400 truncate">
                    {field.name}
                  </dt>
                  <dd className="text-sm text-gray-800">{field.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Opportunities */}
        <section>
          <h2 className={`mb-3 ${sf.sectionLabel}`}>Opportunità</h2>
          <div className={`${sf.card} overflow-hidden p-0`}>
            {cachedOpps.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">Nessuna opportunità.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Nome</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Stadio</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Valore</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cachedOpps.map((opp) => (
                    <tr key={opp.ghl_id}>
                      <td className="px-5 py-3 font-medium text-gray-800">{opp.name ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {opp.pipeline_stage_id ? (stageMap[opp.pipeline_stage_id] ?? '—') : '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        €{(Number(opp.monetary_value) || 0).toLocaleString('it-IT')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Appointments */}
        <section>
          <h2 className={`mb-3 ${sf.sectionLabel}`}>Appuntamenti</h2>
          <div className={`${sf.card} overflow-hidden p-0`}>
            {events.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">Nessun appuntamento.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Calendario</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Data</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Stato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {event.calendarId ? (calendarMap[event.calendarId] ?? '—') : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {event.startTime ? new Date(event.startTime).toLocaleString('it-IT') : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          event.appointmentStatus === 'confirmed' ? 'bg-green-50 text-green-700' :
                          event.appointmentStatus === 'noshow' ? 'bg-red-50 text-red-700' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {event.appointmentStatus ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* Conversations */}
      {conversations.length > 0 && (
        <section>
          <h2 className={`mb-3 ${sf.sectionLabel}`}>Messaggi recenti</h2>
          <div className="space-y-3">
            {conversations.map((conv) => (
              <div key={conv.id} className={`${sf.card} ${sf.cardPadding}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm text-gray-700">{conv.lastMessageBody ?? '—'}</p>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    {conv.type ?? 'msg'}
                  </span>
                </div>
                {conv.lastMessageDate && (
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(conv.lastMessageDate).toLocaleString('it-IT')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
