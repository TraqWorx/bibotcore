import { createAdminClient } from '@/lib/supabase-server'

export interface Store {
  id: string
  slug: string
  name: string
  city: string | null
  address: string | null
  calendar_id: string | null
  calendar_widget_slug: string | null
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

/** Public booking widget URL hosted by the underlying CRM. */
export function bookingUrlFor(widgetSlug: string | null | undefined): string | null {
  if (!widgetSlug) return null
  return `https://api.leadconnectorhq.com/widget/booking/${widgetSlug}`
}

/** Public lead form URL on this app. */
export function leadFormUrlFor(slug: string, baseUrl?: string): string {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://core.bibotcrm.it'
  return `${base}/apulia/lead/${slug}`
}

/** Free third-party QR generator. No keys, just a stable URL. */
export function qrImageUrl(target: string, size = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(target)}`
}
