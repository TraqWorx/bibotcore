import { createAdminClient } from '@/lib/supabase-server'
import { getSegmentConfig } from '@/lib/farmacia/segments-store'
import ClientiView, { type ClientiRow } from './_components/ClientiView'

export const dynamic = 'force-dynamic'

export default async function ClientiPage() {
  const sb = createAdminClient()
  const [{ data }, config, { data: ct }] = await Promise.all([
    sb.from('farmacia_contacts')
      .select('id, first_name, last_name, phone_norm, email, origin_tags, tags, notes, orders_count, total_spent_cents, avg_order_cents, is_conversion, last_order_at, sync_status, ghl_id')
      .order('total_spent_cents', { ascending: false })
      .limit(300),
    getSegmentConfig(),
    sb.from('farmacia_settings').select('value').eq('key', 'custom_tags').maybeSingle(),
  ])
  const contacts = (data ?? []) as ClientiRow[]

  // Type-ahead suggestions: every tag in use + the custom-tag catalog.
  const sugg = new Set<string>()
  for (const c of contacts) for (const t of c.tags ?? []) sugg.add(t)
  for (const t of (Array.isArray(ct?.value) ? (ct!.value as string[]) : [])) sugg.add(t)

  return <ClientiView contacts={contacts} config={config} suggestions={[...sugg].sort()} />
}
