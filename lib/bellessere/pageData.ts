// Server-side initial-data fetchers so the heavy Bellessere pages render with
// content (like Apulia) instead of a client-side spinner. All read the cache.
import { createAdminClient } from '@/lib/supabase-server'
import { BELLESSERE_LOCATION_ID } from './constants'
import type { InitialClienti } from '@/app/designs/bellessere/(secure)/clienti/ClientiView'
import type { InitialAppuntamenti } from '@/app/designs/bellessere/(secure)/appuntamenti/AppuntamentiView'
import type { InitialCalendario } from '@/app/designs/bellessere/(secure)/calendario/CalendarioView'

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

const APPT_PAGE = 100

export async function getInitialAppuntamenti(): Promise<InitialAppuntamenti> {
  const sb = createAdminClient()
  const start = new Date(); start.setMonth(start.getMonth() - 1)
  const end = new Date(); end.setMonth(end.getMonth() + 3)
  const startIso = start.toISOString(), endIso = end.toISOString()
  const todayStr = new Date().toISOString().slice(0, 10)

  const evsSel = 'ghl_id, calendar_id, contact_ghl_id, user_id, title, start_time, end_time, appointment_status'

  const [{ data: rows, count }, { data: services }, { data: usersRaw }, todayC, confC, cancC, noshowC] = await Promise.all([
    sb.from('cached_calendar_events').select(evsSel, { count: 'exact' })
      .eq('location_id', BELLESSERE_LOCATION_ID).gte('start_time', startIso).lte('start_time', endIso)
      .order('start_time', { ascending: true }).range(0, APPT_PAGE - 1),
    sb.from('bellessere_services').select('id, name, slot_duration, price, team_members, is_active').eq('location_id', BELLESSERE_LOCATION_ID),
    sb.from('bellessere_users').select('id, name').eq('location_id', BELLESSERE_LOCATION_ID).order('name'),
    sb.from('cached_calendar_events').select('*', { count: 'exact', head: true }).eq('location_id', BELLESSERE_LOCATION_ID).gte('start_time', `${todayStr}T00:00:00.000Z`).lte('start_time', `${todayStr}T23:59:59.999Z`),
    sb.from('cached_calendar_events').select('*', { count: 'exact', head: true }).eq('location_id', BELLESSERE_LOCATION_ID).gte('start_time', startIso).lte('start_time', endIso).in('appointment_status', ['confirmed', 'new']),
    sb.from('cached_calendar_events').select('*', { count: 'exact', head: true }).eq('location_id', BELLESSERE_LOCATION_ID).gte('start_time', startIso).lte('start_time', endIso).in('appointment_status', ['cancelled']),
    sb.from('cached_calendar_events').select('*', { count: 'exact', head: true }).eq('location_id', BELLESSERE_LOCATION_ID).gte('start_time', startIso).lte('start_time', endIso).in('appointment_status', ['no-show', 'noshow']),
  ])

  const contactIds = [...new Set((rows ?? []).map(r => r.contact_ghl_id).filter(Boolean))] as string[]
  const contactMap: Record<string, string> = {}
  if (contactIds.length > 0) {
    const { data: cts } = await sb.from('cached_contacts').select('ghl_id, first_name, last_name').eq('location_id', BELLESSERE_LOCATION_ID).in('ghl_id', contactIds)
    for (const c of cts ?? []) contactMap[c.ghl_id] = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.ghl_id
  }

  const appointments = (rows ?? []).map(r => ({
    id: r.ghl_id, title: r.title ?? undefined, startTime: r.start_time ?? undefined, endTime: r.end_time ?? undefined,
    appointmentStatus: r.appointment_status ?? undefined, contactId: r.contact_ghl_id ?? undefined,
    contactName: r.contact_ghl_id ? contactMap[r.contact_ghl_id] : undefined,
    calendarId: r.calendar_id ?? undefined, userId: r.user_id ?? undefined,
  }))
  const calendars = (services ?? []).map(s => ({
    id: s.id, name: s.name ?? '', slotDuration: s.slot_duration ?? undefined, price: s.price ?? undefined,
    isActive: s.is_active ?? undefined, teamMembers: (s.team_members ?? []) as { userId: string }[],
  }))

  return {
    appointments,
    hasMore: (count ?? 0) > appointments.length,
    counts: { today: todayC.count ?? 0, confirmed: confC.count ?? 0, cancelled: cancC.count ?? 0, noshow: noshowC.count ?? 0 },
    calendars,
    users: (usersRaw ?? []).map(u => ({ id: u.id, name: u.name ?? '' })),
  }
}

export async function getInitialCalendario(): Promise<InitialCalendario> {
  const sb = createAdminClient()
  // Current week (Sunday-based), matching the client's getWeekDates()
  const d = new Date(); d.setDate(d.getDate() - d.getDay())
  const start = new Date(d); start.setHours(0, 0, 0, 0)
  const end = new Date(d); end.setDate(d.getDate() + 6); end.setHours(23, 59, 59, 999)

  const [{ data: rows }, { data: services }, { data: usersRaw }] = await Promise.all([
    sb.from('cached_calendar_events')
      .select('ghl_id, calendar_id, contact_ghl_id, user_id, title, start_time, end_time, appointment_status')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .gte('start_time', start.toISOString()).lte('start_time', end.toISOString())
      .order('start_time', { ascending: true }),
    sb.from('bellessere_services').select('id, name, slot_duration, price, team_members, is_active').eq('location_id', BELLESSERE_LOCATION_ID),
    sb.from('bellessere_users').select('id, name').eq('location_id', BELLESSERE_LOCATION_ID).order('name'),
  ])

  const contactIds = [...new Set((rows ?? []).map(r => r.contact_ghl_id).filter(Boolean))] as string[]
  const contactMap: Record<string, string> = {}
  if (contactIds.length > 0) {
    const { data: cts } = await sb.from('cached_contacts').select('ghl_id, first_name, last_name').eq('location_id', BELLESSERE_LOCATION_ID).in('ghl_id', contactIds)
    for (const c of cts ?? []) contactMap[c.ghl_id] = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.ghl_id
  }

  const events = (rows ?? []).map(r => ({
    id: r.ghl_id, title: r.title ?? undefined, startTime: r.start_time ?? undefined, endTime: r.end_time ?? undefined,
    appointmentStatus: r.appointment_status ?? undefined, contactId: r.contact_ghl_id ?? undefined,
    contactName: r.contact_ghl_id ? contactMap[r.contact_ghl_id] : undefined,
    calendarId: r.calendar_id ?? undefined, userId: r.user_id ?? undefined,
  }))
  const calendars = (services ?? []).map(s => ({
    id: s.id, name: s.name ?? '', slotDuration: s.slot_duration ?? undefined, price: s.price ?? undefined,
    isActive: s.is_active ?? undefined, teamMembers: (s.team_members ?? []) as { userId: string }[],
  }))

  return { events, calendars, users: (usersRaw ?? []).map(u => ({ id: u.id, name: u.name ?? '' })) }
}
