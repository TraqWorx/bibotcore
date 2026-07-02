// Pure, unit-tested waiting-list logic: decide whether a freed slot matches a
// waiting entry, and build the invite message. No I/O here.

export type TimePref = 'any' | 'morning' | 'afternoon' | 'specific'

export interface FreedSlot {
  operatorId: string | null // operator whose time freed up (cancelled appt's assignedUserId)
  date: string              // 'YYYY-MM-DD' (Europe/Rome local date)
  startMinutes: number      // minutes from midnight (Rome)
  endMinutes: number
}

export interface WaitEntry {
  id: string
  calendar_id: string
  operator_id: string | null // preferred operator; null = any
  preferred_date: string     // 'YYYY-MM-DD'
  time_pref: TimePref
  preferred_from: string | null // 'HH:MM' / 'HH:MM:SS' when time_pref='specific'
  preferred_to: string | null
  status: string
  created_at: string
}

export interface ServiceInfo {
  slot_duration: number | null            // minutes
  team_members: { userId: string }[]
}

const AFTERNOON_START = 13 * 60 // 13:00

export function hhmmToMinutes(t: string | null | undefined): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

/** The [fromMinutes, toMinutes) window a waiting entry is willing to accept. */
export function entryWindow(entry: Pick<WaitEntry, 'time_pref' | 'preferred_from' | 'preferred_to'>): [number, number] {
  switch (entry.time_pref) {
    case 'morning': return [0, AFTERNOON_START]
    case 'afternoon': return [AFTERNOON_START, 24 * 60]
    case 'specific': {
      const from = hhmmToMinutes(entry.preferred_from) ?? 0
      const to = hhmmToMinutes(entry.preferred_to) ?? 24 * 60
      return [from, Math.max(to, from)]
    }
    case 'any':
    default: return [0, 24 * 60]
  }
}

/** Half-open interval overlap. */
export function overlaps(a1: number, a2: number, b1: number, b2: number): boolean {
  return a1 < b2 && b1 < a2
}

/**
 * A freed slot matches a waiting entry when:
 *  - the entry is still waiting,
 *  - it's for the same day,
 *  - the freed operator can perform the entry's service (on its team) and the
 *    entry either asked for that operator or "any",
 *  - the freed window is long enough for the entry's service duration,
 *  - the freed window overlaps the entry's preferred time-of-day window.
 */
export function entryMatchesSlot(entry: WaitEntry, freed: FreedSlot, service: ServiceInfo | undefined): boolean {
  if (entry.status !== 'waiting') return false
  if (!service) return false
  if (entry.preferred_date !== freed.date) return false
  if (!freed.operatorId) return false

  const operatorOnTeam = service.team_members.some(m => m.userId === freed.operatorId)
  if (!operatorOnTeam) return false
  if (entry.operator_id && entry.operator_id !== freed.operatorId) return false

  const duration = service.slot_duration ?? 30
  if (freed.endMinutes - freed.startMinutes < duration) return false

  const [from, to] = entryWindow(entry)
  return overlaps(from, to, freed.startMinutes, freed.endMinutes)
}

/** All waiting entries a freed slot can serve, ordered first-in-line (oldest first). */
export function matchWaitlist(
  freed: FreedSlot,
  entries: WaitEntry[],
  servicesById: Record<string, ServiceInfo>,
): WaitEntry[] {
  return entries
    .filter(e => entryMatchesSlot(e, freed, servicesById[e.calendar_id]))
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
}

/** Substitute {{nome}} {{servizio}} {{giorno}} {{link}} in a custom invite text. */
export function renderInviteText(
  template: string,
  vars: { nome?: string; servizio?: string; giorno?: string; ora?: string; link?: string },
): string {
  return template
    .replace(/\{\{\s*nome\s*\}\}/gi, vars.nome ?? '')
    .replace(/\{\{\s*servizio\s*\}\}/gi, vars.servizio ?? '')
    .replace(/\{\{\s*giorno\s*\}\}/gi, vars.giorno ?? '')
    .replace(/\{\{\s*ora\s*\}\}/gi, vars.ora ?? '')
    .replace(/\{\{\s*link\s*\}\}/gi, vars.link ?? '')
    .trim()
}

/** Build the default invite SMS text. */
export function buildWaitlistSms(opts: {
  name: string
  serviceName: string
  dateLabel?: string
  timeLabel?: string
  bookingLink: string
}): string {
  const { name, serviceName, dateLabel, timeLabel, bookingLink } = opts
  const day = dateLabel ? ` ${dateLabel}` : ''
  const time = timeLabel ? ` alle ${timeLabel}` : ''
  const when = day || time ? ` per${day}${time}` : ''
  return `Ciao ${name || ''}! Si è liberato un posto per ${serviceName}${when} da Bellessere. `
    + `Prenota subito qui: ${bookingLink}`.trim()
}
