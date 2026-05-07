import { createAdminClient } from '@/lib/supabase-server'

export interface Store {
  id: string
  slug: string
  name: string
  city: string | null
  address: string | null
  calendar_id: string | null
  calendar_widget_slug: string | null
  form_id: string | null
  pipeline_id: string | null
  display_order: number
  active: boolean
}

export async function listStores(): Promise<Store[]> {
  const sb = createAdminClient()
  const { data } = await sb.from('apulia_stores').select('*').order('display_order')
  return (data ?? []) as Store[]
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const sb = createAdminClient()
  const { data } = await sb.from('apulia_stores').select('*').eq('slug', slug).maybeSingle()
  return data as Store | null
}

/**
 * GHL-hosted booking widget URL for a calendar slug. Editing the
 * calendar in GHL is reflected immediately — the URL points at GHL's
 * hosted widget.
 */
export function bookingUrlFor(widgetSlug: string | null | undefined): string | null {
  if (!widgetSlug) return null
  return `https://api.leadconnectorhq.com/widget/bookings/${widgetSlug}`
}

/**
 * GHL-hosted form widget URL. Returns null when the store has no form
 * assigned. Submissions land directly in GHL; count rolls into Bibot
 * via a GHL workflow that adds the store-{slug} tag on submit.
 */
export function leadFormUrlFor(formId: string | null | undefined): string | null {
  if (!formId) return null
  return `https://api.leadconnectorhq.com/widget/form/${formId}`
}

/** Free third-party QR generator. No keys, just a stable URL. */
export function qrImageUrl(target: string, size = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(target)}`
}
