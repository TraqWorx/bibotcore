import { createAdminClient } from '@/lib/supabase-server'
import { getSegmentConfig } from '@/lib/farmacia/segments-store'
import ClientiView, { type ClientiRow } from './_components/ClientiView'

export const dynamic = 'force-dynamic'

export default async function ClientiPage() {
  const sb = createAdminClient()
  const [{ data }, config] = await Promise.all([
    sb.from('farmacia_contacts')
      .select('id, first_name, last_name, phone_norm, email, origin_tags, tags, notes, orders_count, total_spent_cents, avg_order_cents, is_conversion, last_order_at, sync_status, ghl_id')
      .order('total_spent_cents', { ascending: false })
      .limit(1000),
    getSegmentConfig(),
  ])
  return <ClientiView contacts={(data ?? []) as ClientiRow[]} config={config} />
}
