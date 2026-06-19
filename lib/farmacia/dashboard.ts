/** Read models for the Farmacia dashboard. RPCs do the grouped aggregations. */

import { createAdminClient } from '@/lib/supabase-server'
import { tierBreakdown, type TierStat } from './segments'
import { getSegmentConfig } from './segments-store'

export interface Overview {
  ordersCount: number
  revenueCents: number
  aovCents: number
  newCustomers: number
  recurringCustomers: number
  amazonConversions: number
  ebayConversions: number
}

export interface TopCustomer {
  id: string
  name: string
  ordersCount: number
  totalSpentCents: number
  avgOrderCents: number
}

export interface CategoryStat {
  category: string
  revenueCents: number
  ordersCount: number
  repurchasePct: number
  topCustomer: string | null
}

function displayName(r: { first_name: string | null; last_name: string | null; phone_norm: string | null; email: string | null }): string {
  return [r.first_name, r.last_name].filter(Boolean).join(' ') || r.phone_norm || r.email || '—'
}

export async function getOverview(from: Date, to: Date): Promise<Overview> {
  const sb = createAdminClient()
  const [{ data: ov }, { data: conv }] = await Promise.all([
    sb.rpc('farmacia_overview', { p_from: from.toISOString(), p_to: to.toISOString() }),
    sb.rpc('farmacia_channel_conversions'),
  ])
  const o = (Array.isArray(ov) ? ov[0] : ov) ?? {}
  const c = (Array.isArray(conv) ? conv[0] : conv) ?? {}
  const ordersCount = Number(o.orders_count ?? 0)
  const revenueCents = Number(o.revenue_cents ?? 0)
  return {
    ordersCount,
    revenueCents,
    aovCents: ordersCount > 0 ? Math.round(revenueCents / ordersCount) : 0,
    newCustomers: Number(o.new_customers ?? 0),
    recurringCustomers: Number(o.recurring_customers ?? 0),
    amazonConversions: Number(c.amazon ?? 0),
    ebayConversions: Number(c.ebay ?? 0),
  }
}

const TOP_COLS = 'id, first_name, last_name, phone_norm, email, orders_count, total_spent_cents, avg_order_cents'

async function topBy(column: string, limit: number): Promise<TopCustomer[]> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('farmacia_contacts')
    .select(TOP_COLS)
    .gt('orders_count', 0)
    .order(column, { ascending: false })
    .limit(limit)
  return (data ?? []).map((r) => ({
    id: r.id,
    name: displayName(r),
    ordersCount: r.orders_count ?? 0,
    totalSpentCents: r.total_spent_cents ?? 0,
    avgOrderCents: r.avg_order_cents ?? 0,
  }))
}

export async function getTopCustomers(limit = 20): Promise<{ bySpend: TopCustomer[]; byOrders: TopCustomer[]; byAov: TopCustomer[] }> {
  const [bySpend, byOrders, byAov] = await Promise.all([
    topBy('total_spent_cents', limit),
    topBy('orders_count', limit),
    topBy('avg_order_cents', limit),
  ])
  return { bySpend, byOrders, byAov }
}

export async function getClusterization(): Promise<TierStat[]> {
  const sb = createAdminClient()
  const [{ data }, config] = await Promise.all([
    sb.from('farmacia_contacts').select('orders_count, total_spent_cents'),
    getSegmentConfig(),
  ])
  const customers = (data ?? []).map((r) => ({ ordersCount: r.orders_count ?? 0, totalSpentCents: r.total_spent_cents ?? 0 }))
  return tierBreakdown(customers, config)
}

export async function getCategoryStats(): Promise<CategoryStat[]> {
  const sb = createAdminClient()
  const { data } = await sb.rpc('farmacia_category_stats')
  return (data ?? []).map((r: Record<string, unknown>) => ({
    category: String(r.category),
    revenueCents: Number(r.revenue_cents ?? 0),
    ordersCount: Number(r.orders_count ?? 0),
    repurchasePct: Number(r.repurchase_pct ?? 0),
    topCustomer: (r.top_customer as string | null) ?? null,
  }))
}
