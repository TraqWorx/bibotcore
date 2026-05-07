import { ghlFetch } from './ghl'
import { APULIA_LOCATION_ID } from './fields'

export interface GhlForm {
  id: string
  name: string
  locationId: string
}

export interface GhlCalendar {
  id: string
  name: string
  /** Public booking widget slug (used by the booking widget URL). */
  slug?: string | null
  /** Embedded calendar URL when present. */
  widgetSlug?: string | null
  isActive?: boolean
}

/**
 * Fetch every form on the Apulia location. Used by the stores admin to
 * pick which form each store's QR code should encode. GHL's API
 * returns the full list in one call (no pagination needed for typical
 * accounts).
 */
export async function listGhlForms(): Promise<GhlForm[]> {
  const r = await ghlFetch(`/forms/?locationId=${APULIA_LOCATION_ID}&limit=100`)
  if (!r.ok) {
    console.error('[ghl-resources] forms fetch:', r.status, await r.text().catch(() => ''))
    return []
  }
  const j = (await r.json()) as { forms?: GhlForm[] }
  return j.forms ?? []
}

/**
 * Fetch every calendar on the Apulia location. The widget slug (or
 * `slug`) is what the booking-widget URL uses.
 */
export async function listGhlCalendars(): Promise<GhlCalendar[]> {
  const r = await ghlFetch(`/calendars/?locationId=${APULIA_LOCATION_ID}`)
  if (!r.ok) {
    console.error('[ghl-resources] calendars fetch:', r.status, await r.text().catch(() => ''))
    return []
  }
  const j = (await r.json()) as { calendars?: GhlCalendar[] }
  return j.calendars ?? []
}
