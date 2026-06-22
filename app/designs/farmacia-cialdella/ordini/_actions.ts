'use server'

import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { canAccessBibotDesign } from '@/lib/auth/designOwner'
import { FARMACIA_LOCATION_ID } from '@/lib/farmacia/fields'

export interface OrderItem {
  id: string
  sku: string | null
  ean: string | null
  description: string | null
  qty: number | null
  unit_price_cents: number | null
  line_total_cents: number | null
  category: string | null
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  // Pharmacy order line-items are private client data — only a Bibot admin or a
  // user assigned to the Farmacia location may read them.
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return []
  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role, agency_id, location_id').eq('id', user.id).single()
  if (!(await canAccessBibotDesign(user.id, profile, FARMACIA_LOCATION_ID))) return []

  const { data } = await sb
    .from('farmacia_order_items')
    .select('id, sku, ean, description, qty, unit_price_cents, line_total_cents, category')
    .eq('order_id', orderId)
  return (data ?? []) as OrderItem[]
}
