// Server-side initial-data fetchers so the heavy Bellessere pages render with
// content (like Apulia) instead of a client-side spinner. All read the cache.
import { createAdminClient } from '@/lib/supabase-server'
import { BELLESSERE_LOCATION_ID } from './constants'
import type { InitialClienti } from '@/app/designs/bellessere/(secure)/clienti/ClientiView'

const CLIENTI_PAGE = 60

export async function getInitialClienti(): Promise<InitialClienti> {
  const sb = createAdminClient()

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const base = () => sb.from('cached_contacts').select('*', { count: 'exact', head: true }).eq('location_id', BELLESSERE_LOCATION_ID)

  const [{ data: rows }, totalR, emailR, phoneR, newR] = await Promise.all([
    sb.from('cached_contacts')
      .select('ghl_id, first_name, last_name, email, phone, tags')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .order('last_name', { ascending: true })
      .range(0, CLIENTI_PAGE - 1),
    base(),
    base().not('email', 'is', null).neq('email', ''),
    base().not('phone', 'is', null).neq('phone', ''),
    base().gte('date_added', monthStart.toISOString()),
  ])

  const contacts = (rows ?? []).map(c => ({
    id: c.ghl_id, firstName: c.first_name ?? '', lastName: c.last_name ?? '',
    email: c.email ?? '', phone: c.phone ?? '', companyName: '', dateAdded: '',
    tags: (c.tags ?? []) as string[],
  }))

  // Booking counts + last booking for this page of contacts (one query)
  const ids = contacts.map(c => c.id)
  const bookingCounts: Record<string, number> = {}
  const lastBooking: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: evs } = await sb.from('cached_calendar_events')
      .select('contact_ghl_id, start_time')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .in('contact_ghl_id', ids)
    for (const e of evs ?? []) {
      const cid = e.contact_ghl_id
      if (!cid) continue
      bookingCounts[cid] = (bookingCounts[cid] ?? 0) + 1
      if (e.start_time && (!lastBooking[cid] || e.start_time > lastBooking[cid])) lastBooking[cid] = e.start_time
    }
  }

  const total = totalR.count ?? contacts.length
  return {
    contacts,
    stats: { total, withEmail: emailR.count ?? 0, withPhone: phoneR.count ?? 0, newThisMonth: newR.count ?? 0 },
    hasMore: total > contacts.length,
    bookingCounts,
    lastBooking,
  }
}
