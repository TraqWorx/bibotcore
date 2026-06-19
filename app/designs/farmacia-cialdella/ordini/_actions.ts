'use server'

import { createAdminClient } from '@/lib/supabase-server'

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
  const sb = createAdminClient()
  const { data } = await sb
    .from('farmacia_order_items')
    .select('id, sku, ean, description, qty, unit_price_cents, line_total_cents, category')
    .eq('order_id', orderId)
  return (data ?? []) as OrderItem[]
}
