// Pure, unit-tested helpers shared by Bellessere API routes and pages.

/** Parse + clamp pagination params from a query string. */
export function parsePageParams(
  sp: URLSearchParams,
  defaultLimit = 100,
  maxLimit = 200,
): { limit: number; offset: number } {
  const rawLimit = parseInt(sp.get('limit') ?? String(defaultLimit), 10)
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : defaultLimit, 1), maxLimit)
  const rawOffset = parseInt(sp.get('offset') ?? '0', 10)
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0)
  return { limit, offset }
}

/**
 * Sanitize a free-text search term before interpolating into a PostgREST
 * `.or(...)` filter. Commas / parens / percent / backslash would break the
 * filter grammar or inject extra conditions, so strip them.
 */
export function sanitizeSearch(raw: string): string {
  return raw.replace(/[,()%\\*]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Build the PostgREST `.or()` expression for a contact search across fields. */
export function contactSearchOr(sanitizedTerm: string): string {
  const t = sanitizedTerm
  return `first_name.ilike.%${t}%,last_name.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%`
}

export type ApptStatusFilter = 'all' | 'confirmed' | 'showed' | 'cancelled' | 'noshow' | 'pending'

const STATUS_FILTERS: ApptStatusFilter[] = ['all', 'confirmed', 'showed', 'cancelled', 'noshow', 'pending']

export function isApptStatusFilter(v: string | null | undefined): v is ApptStatusFilter {
  return !!v && (STATUS_FILTERS as string[]).includes(v)
}

/**
 * The set of stored appointment_status values matched by a filter, or null for
 * "all" (no constraint). Used both for server-side `.in()` and client checks.
 * GHL uses `noshow`; older cached rows may hold `no-show`, and `new` counts as
 * confirmed.
 */
export function statusValuesFor(filter: ApptStatusFilter): string[] | null {
  switch (filter) {
    case 'confirmed': return ['confirmed', 'new']
    case 'showed': return ['showed']
    case 'cancelled': return ['cancelled']
    case 'noshow': return ['no-show', 'noshow']
    case 'pending': return ['pending']
    case 'all':
    default: return null
  }
}

/** Client-side equivalent of statusValuesFor for filtering already-loaded events. */
export function matchesStatus(status: string | null | undefined, filter: ApptStatusFilter): boolean {
  if (filter === 'all') return true
  const s = status ?? 'new'
  if (filter === 'pending') return s === 'pending' || !status
  return (statusValuesFor(filter) ?? []).includes(s)
}

export interface NewUserInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Validate add-team-member input. Returns an error message or null if valid. */
export function validateNewUser(i: NewUserInput): string | null {
  if (!i.firstName?.trim()) return 'Nome obbligatorio'
  if (!i.lastName?.trim()) return 'Cognome obbligatorio'
  if (!i.email?.trim()) return 'Email obbligatoria'
  if (!EMAIL_RE.test(i.email.trim())) return 'Email non valida'
  return null
}

/** Build the GHL POST /users/ body (verified required fields via live probe). */
export function buildCreateUserPayload(
  i: NewUserInput,
  companyId: string,
  locationId: string,
): Record<string, unknown> {
  return {
    companyId,
    firstName: i.firstName!.trim(),
    lastName: i.lastName!.trim(),
    email: i.email!.trim(),
    phone: i.phone?.trim() || undefined,
    type: 'account',
    role: 'user',
    locationIds: [locationId],
  }
}
