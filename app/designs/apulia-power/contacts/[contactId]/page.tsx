import Link from 'next/link'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import { getActiveLocation } from '@/lib/location/getActiveLocation'

interface Opportunity {
  id: string
  name?: string
  pipelineStageId?: string
  monetaryValue?: number
  createdAt?: string
}

interface CalendarEvent {
  id: string
  title?: string
  calendarId?: string
  startTime?: string
  appointmentStatus?: string
}

interface Conversation {
  id: string
  type?: string
  lastMessageDate?: string
  lastMessageBody?: string
}

interface CustomField {
  id: string
  value?: string
  field_value?: string
  fieldValue?: string
  key?: string
  name?: string
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

  const ghl = await getGhlClient(locationId ?? '')

  const [contactData, opportunitiesData, pipelinesData, eventsData, calendarsData, conversationsData] =
    await Promise.all([
      ghl.contacts.get(contactId),
      ghl.opportunities.byContact(contactId),
      ghl.pipelines.list(),
      ghl.calendarEvents.byContact(contactId),
      ghl.calendars.list(),
      ghl.conversations.byContact(contactId).catch(() => null),
    ])

  const contact = contactData?.contact
  const opportunities: Opportunity[] = opportunitiesData?.opportunities ?? []
  const events: CalendarEvent[] = eventsData?.events ?? []
  const conversations: Conversation[] = conversationsData?.conversations ?? []
  const customFields: CustomField[] = contact?.customFields ?? []

  const stageMap: Record<string, string> = {}
  for (const pipeline of pipelinesData?.pipelines ?? []) {
    for (const stage of pipeline.stages ?? []) {
      stageMap[stage.id] = stage.name
    }
  }

  const calendarMap: Record<string, string> = {}
  for (const cal of calendarsData?.calendars ?? []) {
    calendarMap[cal.id] = cal.name
  }

  const fullName = [contact?.firstName, contact?.lastName].filter(Boolean).join(' ') || '—'
  const q = locationId ? `?locationId=${locationId}` : ''

  const tagColors: Record<string, string> = {
    energia:      'bg-amber-50 text-amber-700',
    telefonia:    'bg-blue-50 text-blue-700',
    wind:         'bg-purple-50 text-purple-700',
    fastweb:      'bg-orange-50 text-orange-700',
    connettivita: 'bg-teal-50 text-teal-700',
  }

  return (
    <div className="space-y-6">
      <Link href={`/designs/apulia-power/contacts${q}`} className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: '#2A00CC' }}>
        ← Contatti
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
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
      {customFields.filter((f) => (f.value ?? f.field_value ?? f.fieldValue) && (f.value ?? f.field_value ?? f.fieldValue) !== '').length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Campi Personalizzati</h2>
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <dl className="divide-y divide-gray-50">
              {customFields.map((field) => {
                const val = field.value ?? field.field_value ?? field.fieldValue ?? ''
                if (!val) return null
                const label = field.name ?? field.key ?? field.id
                return (
                  <div key={field.id} className="flex items-center gap-4 px-5 py-3">
                    <dt className="w-48 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400 truncate">
                      {label}
                    </dt>
                    <dd className="text-sm text-gray-800">{val}</dd>
                  </div>
                )
              })}
            </dl>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Opportunities */}
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Opportunità</h2>
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            {opportunities.length === 0 ? (
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
                  {opportunities.map((opp) => (
                    <tr key={opp.id}>
                      <td className="px-5 py-3 font-medium text-gray-800">{opp.name ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {opp.pipelineStageId ? (stageMap[opp.pipelineStageId] ?? '—') : '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        €{(opp.monetaryValue ?? 0).toLocaleString('it-IT')}
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
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Appuntamenti</h2>
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
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
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Messaggi recenti</h2>
          <div className="space-y-2">
            {conversations.slice(0, 5).map((conv) => (
              <div key={conv.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
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
