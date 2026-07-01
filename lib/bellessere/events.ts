import { BELLESSERE_LOCATION_ID } from './constants'

const GHL = 'https://services.leadconnectorhq.com'
const V = '2021-04-15'

export interface BellessereEvent {
  id: string
  calendarId: string | null
  contactId: string | null
  userId: string | null
  title: string | null
  startTime: string | null
  endTime: string | null
  appointmentStatus: string | null
}

// GHL's /calendars/events returns 422 without a calendarId/userId/groupId, and its
// userId filter matches the (usually empty) `userId` field — the operator actually
// lives in `assignedUserId`. So we fan out across calendar GROUPS (which cover every
// service_booking calendar) and normalise the operator from assignedUserId ?? userId.
export async function fetchBellessereEvents(
  token: string,
  startMs: number,
  endMs: number,
): Promise<BellessereEvent[]> {
  // Discover group ids (dynamic per location)
  const gr = await fetch(`${GHL}/calendars/groups?locationId=${BELLESSERE_LOCATION_ID}`, {
    headers: { Authorization: `Bearer ${token}`, Version: V },
  }).catch(() => null)
  const groups: { id: string }[] = gr?.ok ? ((await gr.json())?.groups ?? []) : []

  if (groups.length === 0) return []

  const perGroup = await Promise.all(
    groups.map(g =>
      fetch(
        `${GHL}/calendars/events?locationId=${BELLESSERE_LOCATION_ID}&groupId=${g.id}&startTime=${startMs}&endTime=${endMs}&includeAll=true`,
        { headers: { Authorization: `Bearer ${token}`, Version: V } },
      )
        .then(r => (r.ok ? r.json() : { events: [] }))
        .then(d => (d?.events ?? []) as Record<string, unknown>[])
        .catch(() => [] as Record<string, unknown>[]),
    ),
  )

  // Merge + dedupe by id (a calendar can belong to multiple groups)
  const byId = new Map<string, Record<string, unknown>>()
  for (const evs of perGroup) for (const e of evs) byId.set(e.id as string, e)

  return [...byId.values()].map(e => ({
    id: e.id as string,
    calendarId: (e.calendarId as string) ?? null,
    contactId: (e.contactId as string) ?? null,
    userId: ((e.assignedUserId ?? e.userId) as string) ?? null,
    title: (e.title as string) ?? null,
    startTime: (e.startTime as string) ?? null,
    endTime: (e.endTime as string) ?? null,
    appointmentStatus: ((e.appointmentStatus ?? e.status) as string) ?? null,
  }))
}
