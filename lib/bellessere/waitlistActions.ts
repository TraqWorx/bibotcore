// Server-side waiting-list actions (DB + GHL I/O). Shared by the waitlist API
// route (manual invite) and the cancellation hook (auto invite).
import { createAdminClient } from '@/lib/supabase-server'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID, BELLESSERE_BOOKING_LINK, WAITLIST_HOLD_HOURS } from './constants'
import { buildWaitlistSms, matchWaitlist, type FreedSlot, type WaitEntry, type ServiceInfo } from './waitlist'

const GHL = 'https://services.leadconnectorhq.com'
const V = '2021-07-28'

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

/** Convert an ISO instant to the Rome-local date + minutes-from-midnight. */
export function romeParts(iso: string): { date: string; minutes: number } {
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  const [h, m] = hm.split(':').map(Number)
  return { date, minutes: h * 60 + m }
}

/** Send the invite SMS for one entry and flip it to `invited` with a hold window.
 *  `freedSlot` (optional) is stored so the cron can drip to the next person. */
export async function inviteEntry(entryId: string, freedSlot?: FreedSlot): Promise<{ ok: true } | { error: string; status?: number }> {
  const sb = createAdminClient()
  const { data: entry } = await sb.from('bellessere_waitlist')
    .select('*').eq('location_id', BELLESSERE_LOCATION_ID).eq('id', entryId).single()
  if (!entry) return { error: 'Voce non trovata', status: 404 }
  if (!entry.contact_ghl_id) return { error: 'Contatto GHL mancante per questa voce', status: 400 }

  const dateLabel = entry.preferred_date
    ? new Date(entry.preferred_date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
    : undefined
  const message = buildWaitlistSms({
    name: entry.first_name ?? '', serviceName: entry.service_name ?? 'il tuo servizio',
    dateLabel, bookingLink: BELLESSERE_BOOKING_LINK,
  })

  // Notification channel is configurable in Impostazioni (SMS / WhatsApp / Email)
  const { data: settings } = await sb.from('bellessere_settings')
    .select('invite_channel').eq('location_id', BELLESSERE_LOCATION_ID).maybeSingle()
  const channel = settings?.invite_channel ?? 'SMS'
  const payload: Record<string, unknown> = { type: channel, contactId: entry.contact_ghl_id, message }
  if (channel === 'Email') { payload.subject = "Bellessere — Lista d'attesa"; payload.html = message }

  try {
    const token = await getToken()
    const res = await fetch(`${GHL}/conversations/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Version: V, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    if (!res.ok) {
      let msg = text.slice(0, 200)
      try { const d = JSON.parse(text); msg = Array.isArray(d.message) ? d.message.join(', ') : (d.message ?? msg) } catch { /* keep */ }
      return { error: `Invio SMS fallito: ${msg}`, status: res.status }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Errore invio', status: 500 }
  }

  await sb.from('bellessere_waitlist').update({
    status: 'invited', invited_at: new Date().toISOString(),
    hold_until: new Date(Date.now() + WAITLIST_HOLD_HOURS * 3600_000).toISOString(),
    notified_count: (entry.notified_count ?? 0) + 1, updated_at: new Date().toISOString(),
    ...(freedSlot ? { freed_slot: freedSlot } : {}),
  }).eq('id', entryId)

  return { ok: true }
}

/** Mark any active waiting-list entries for a contact as booked (they responded). */
export async function closeBookedForContact(contactId: string, eventId?: string): Promise<void> {
  const sb = createAdminClient()
  await sb.from('bellessere_waitlist')
    .update({ status: 'booked', booked_event_id: eventId ?? null, updated_at: new Date().toISOString() })
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .eq('contact_ghl_id', contactId)
    .in('status', ['invited', 'waiting'])
}

/**
 * Cron: expire invites whose hold window elapsed, and drip to the next matching
 * person for that freed slot. Returns counts.
 */
export async function promoteExpiredHolds(): Promise<{ expired: number; promoted: number }> {
  const sb = createAdminClient()
  const nowIso = new Date().toISOString()
  const { data: expired } = await sb.from('bellessere_waitlist')
    .select('*').eq('location_id', BELLESSERE_LOCATION_ID)
    .eq('status', 'invited').lt('hold_until', nowIso)

  if (!expired || expired.length === 0) return { expired: 0, promoted: 0 }

  // Load current waiting entries + services once
  const [{ data: waiting }, { data: services }] = await Promise.all([
    sb.from('bellessere_waitlist').select('*').eq('location_id', BELLESSERE_LOCATION_ID).eq('status', 'waiting').order('created_at'),
    sb.from('bellessere_services').select('id, slot_duration, team_members').eq('location_id', BELLESSERE_LOCATION_ID),
  ])
  const servicesById: Record<string, ServiceInfo> = {}
  for (const s of services ?? []) servicesById[s.id] = { slot_duration: s.slot_duration ?? null, team_members: (s.team_members as { userId: string }[]) ?? [] }
  const stillWaiting = [...((waiting ?? []) as WaitEntry[])]

  let promoted = 0
  for (const e of expired) {
    await sb.from('bellessere_waitlist').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', e.id)
    const freed = e.freed_slot as FreedSlot | null
    if (!freed) continue
    const next = matchWaitlist(freed, stillWaiting, servicesById)[0]
    if (next) {
      const r = await inviteEntry(next.id, freed)
      if ('ok' in r) {
        promoted++
        const idx = stillWaiting.findIndex(w => w.id === next.id)
        if (idx >= 0) stillWaiting.splice(idx, 1) // don't invite the same person twice this run
      }
    }
  }
  return { expired: expired.length, promoted }
}

/**
 * A slot just freed up (a booking was cancelled). Find matching waiting entries.
 * If `autoInvite`, invite the first-in-line immediately. Returns the ordered matches.
 */
export async function processFreedSlot(
  freedAppt: { calendarId: string | null; operatorId: string | null; startTime: string | null; endTime: string | null },
  autoInvite: boolean,
): Promise<{ matches: WaitEntry[]; invitedId: string | null }> {
  if (!freedAppt.startTime || !freedAppt.endTime || !freedAppt.operatorId) return { matches: [], invitedId: null }

  const start = romeParts(freedAppt.startTime)
  const end = romeParts(freedAppt.endTime)
  const freed: FreedSlot = {
    operatorId: freedAppt.operatorId, date: start.date,
    startMinutes: start.minutes,
    endMinutes: end.date === start.date ? end.minutes : 24 * 60,
  }

  const sb = createAdminClient()
  const [{ data: entries }, { data: services }] = await Promise.all([
    sb.from('bellessere_waitlist').select('*').eq('location_id', BELLESSERE_LOCATION_ID).eq('status', 'waiting').order('created_at'),
    sb.from('bellessere_services').select('id, slot_duration, team_members').eq('location_id', BELLESSERE_LOCATION_ID),
  ])

  const servicesById: Record<string, ServiceInfo> = {}
  for (const s of services ?? []) servicesById[s.id] = { slot_duration: s.slot_duration ?? null, team_members: (s.team_members as { userId: string }[]) ?? [] }

  const matches = matchWaitlist(freed, (entries ?? []) as WaitEntry[], servicesById)

  let invitedId: string | null = null
  if (autoInvite && matches.length > 0) {
    const r = await inviteEntry(matches[0].id, freed)
    if ('ok' in r) invitedId = matches[0].id
  }
  return { matches, invitedId }
}
