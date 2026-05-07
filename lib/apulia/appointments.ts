import { ghlFetch } from './ghl'
import { APULIA_LOCATION_ID } from './fields'
import { listStores } from './stores'
import { createAdminClient } from '@/lib/supabase-server'

export interface AppointmentRow {
  id: string
  title?: string
  startTime: string
  endTime?: string
  appointmentStatus?: string
  contactId?: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
}

export interface StoreAppointments {
  storeSlug: string
  storeName: string
  city: string | null
  calendarId: string | null
  appointments: AppointmentRow[]
  /** True when GHL returned an error for this store's calendar. */
  error?: string
}

/**
 * Fetch today's appointments grouped by store. One round-trip per
 * store with a configured calendar_id; stores without a calendar are
 * still returned (with empty appointments) so the dashboard can show
 * "Nessun calendario configurato" for them.
 *
 * Times are localized to Europe/Rome by computing today's start/end
 * via the user's local Date and converting to ms; GHL accepts ms
 * timestamps for /calendars/events startTime / endTime.
 */
export async function listTodayAppointmentsByStore(): Promise<StoreAppointments[]> {
  const stores = await listStores()
  if (stores.length === 0) return []

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()

  const initial = await Promise.all(stores.map(async (s): Promise<StoreAppointments> => {
    const base: StoreAppointments = {
      storeSlug: s.slug,
      storeName: s.name,
      city: s.city,
      calendarId: s.calendar_id,
      appointments: [],
    }
    if (!s.calendar_id || !s.active) return base
    try {
      const r = await ghlFetch(
        `/calendars/events?locationId=${APULIA_LOCATION_ID}&calendarId=${s.calendar_id}&startTime=${startOfDay}&endTime=${endOfDay}`,
        { headers: { Version: '2021-04-15' } },
      )
      if (!r.ok) {
        return { ...base, error: `HTTP ${r.status}` }
      }
      const json = await r.json() as { events?: Array<{
        id: string
        title?: string
        startTime?: string
        endTime?: string
        appointmentStatus?: string
        contactId?: string
      }> }
      const events = json.events ?? []
      // Sort earliest first; GHL doesn't guarantee order.
      events.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
      base.appointments = events.map((e) => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime ?? '',
        endTime: e.endTime,
        appointmentStatus: e.appointmentStatus,
        contactId: e.contactId,
      }))
      return base
    } catch (err) {
      return { ...base, error: err instanceof Error ? err.message : 'fetch failed' }
    }
  }))

  // Enrich each appointment with the cached contact name/phone/email
  // (one DB hop instead of N GHL contact lookups).
  const ghlIds = Array.from(new Set(initial.flatMap((s) => s.appointments.map((a) => a.contactId).filter((x): x is string => !!x))))
  const contactMap = new Map<string, { name: string; phone?: string; email?: string }>()
  if (ghlIds.length > 0) {
    const sb = createAdminClient()
    const { data } = await sb.from('apulia_contacts').select('ghl_id, first_name, last_name, phone, email').in('ghl_id', ghlIds)
    for (const r of (data ?? []) as Array<{ ghl_id: string; first_name: string | null; last_name: string | null; phone: string | null; email: string | null }>) {
      contactMap.set(r.ghl_id, {
        name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || '—',
        phone: r.phone ?? undefined,
        email: r.email ?? undefined,
      })
    }
  }
  for (const s of initial) {
    for (const a of s.appointments) {
      if (a.contactId) {
        const c = contactMap.get(a.contactId)
        if (c) { a.contactName = c.name; a.contactPhone = c.phone; a.contactEmail = c.email }
      }
    }
  }

  return initial
}
