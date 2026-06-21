import { createAdminClient } from '@/lib/supabase-server'
import OrdiniView, { type OrderRow } from './_components/OrdiniView'

export const dynamic = 'force-dynamic'

export default async function OrdiniPage() {
  const sb = createAdminClient()
  const { data } = await sb
    .from('farmacia_orders')
    .select('id, order_ext_id, channel, order_date, total_cents, category, status, contact_id, ship_name, ship_address, ship_city, ship_zip, ship_province, ship_country, farmacia_contacts(first_name, last_name, phone_norm)')
    .order('order_date', { ascending: false, nullsFirst: false })
    .limit(300)
  return <OrdiniView orders={(data ?? []) as unknown as OrderRow[]} />
}
