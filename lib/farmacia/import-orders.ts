/**
 * Persist a parsed order import: upsert contacts (by phone, else email), upsert
 * orders (by external id), replace their line items, recompute contact rollups
 * from the DB (so incremental imports stay correct), and enqueue create ops for
 * new contacts. The pure planning/rollup logic lives in import-plan.ts.
 */

import { createAdminClient } from '@/lib/supabase-server'
import { enqueueOps, type QueueOpInput } from './sync-queue'
import { buildImportPlan, computeRollup, type RollupOrder } from './import-plan'
import { type ParsedOrder } from './transform'
import { FARMACIA_ORIGIN, FARMACIA_TAG, type FarmaciaOrigin } from './fields'

export interface ImportSummary {
  contactsCreated: number
  contactsUpdated: number
  ordersUpserted: number
  itemsInserted: number
  conversions: number
  ordersUnlinked: number
}

function newId(): string {
  return globalThis.crypto.randomUUID()
}

function chunked<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function originTags(origins: FarmaciaOrigin[]): string[] {
  const map: Partial<Record<FarmaciaOrigin, string>> = {
    [FARMACIA_ORIGIN.AMAZON]: FARMACIA_TAG.ORIGIN_AMAZON,
    [FARMACIA_ORIGIN.EBAY]: FARMACIA_TAG.ORIGIN_EBAY,
    [FARMACIA_ORIGIN.ONLINE_STORE]: FARMACIA_TAG.ORIGIN_ONLINE_STORE,
  }
  return origins.map((o) => map[o]).filter((t): t is string => !!t)
}

export async function persistOrderImport(
  orders: ParsedOrder[],
  opts?: { skuMap?: Map<string, string>; eanMap?: Map<string, string>; importId?: string | null }
): Promise<ImportSummary> {
  const sb = createAdminClient()
  const plan = buildImportPlan(orders, opts)
  const importId = opts?.importId ?? null
  const summary: ImportSummary = {
    contactsCreated: 0, contactsUpdated: 0, ordersUpserted: 0,
    itemsInserted: 0, conversions: 0, ordersUnlinked: 0,
  }

  // 1. Resolve existing contacts by phone_norm and (phone-less) email.
  const keyToId = new Map<string, string>()
  const phoneKeys = plan.contacts.map((c) => c.phoneNorm).filter((p): p is string => !!p)
  const emailKeys = plan.contacts.filter((c) => !c.phoneNorm && c.email).map((c) => c.email!.toLowerCase())
  for (const chunk of chunked(phoneKeys, 300)) {
    const { data } = await sb.from('farmacia_contacts').select('id, phone_norm').in('phone_norm', chunk)
    for (const r of data ?? []) if (r.phone_norm) keyToId.set(r.phone_norm, r.id)
  }
  for (const chunk of chunked(emailKeys, 300)) {
    const { data } = await sb.from('farmacia_contacts').select('id, email').in('email', chunk)
    for (const r of data ?? []) if (r.email) keyToId.set(`email:${r.email.toLowerCase()}`, r.id)
  }

  // 2. Insert missing contacts; queue a create op for each.
  const createOps: QueueOpInput[] = []
  for (const c of plan.contacts) {
    if (keyToId.has(c.key)) { summary.contactsUpdated++; continue }
    const id = newId()
    keyToId.set(c.key, id)
    const { error } = await sb.from('farmacia_contacts').insert({
      id,
      phone_norm: c.phoneNorm,
      phone: c.phoneNorm,
      email: c.email,
      first_name: c.firstName,
      last_name: c.lastName,
      tags: [FARMACIA_TAG.CUSTOMER, ...originTags(c.origins)],
      sync_status: 'pending_create',
    })
    if (error) throw new Error(`contact insert: ${error.message}`)
    summary.contactsCreated++
    createOps.push({ contact_id: id, action: 'create', import_id: importId })
  }

  // 3. Upsert orders by external id.
  const orderIdByExt = new Map<string, string>()
  for (const o of plan.orders) {
    const contactId = o.contactKey ? keyToId.get(o.contactKey) ?? null : null
    if (!contactId) summary.ordersUnlinked++
    const { data, error } = await sb
      .from('farmacia_orders')
      .upsert(
        {
          order_ext_id: o.orderExtId,
          contact_id: contactId,
          phone_norm: o.phoneNorm,
          channel: o.channel,
          order_date: o.orderDate,
          total_cents: o.totalCents,
          category: o.category,
          import_id: importId,
        },
        { onConflict: 'order_ext_id' }
      )
      .select('id')
      .single()
    if (error) throw new Error(`order upsert: ${error.message}`)
    orderIdByExt.set(o.orderExtId, data.id)
    summary.ordersUpserted++
  }

  // 4. Replace line items for these orders (idempotent on re-import).
  const orderIds = [...orderIdByExt.values()]
  for (const chunk of chunked(orderIds, 200)) {
    if (chunk.length) await sb.from('farmacia_order_items').delete().in('order_id', chunk)
  }
  const itemRows = plan.orders.flatMap((o) =>
    o.items.map((it) => ({
      order_id: orderIdByExt.get(o.orderExtId)!,
      order_ext_id: o.orderExtId,
      sku: it.sku, ean: it.ean, description: it.description,
      qty: it.qty, unit_price_cents: it.unitPriceCents,
      line_total_cents: it.lineTotalCents, category: it.category,
    }))
  )
  for (const chunk of chunked(itemRows, 500)) {
    if (!chunk.length) continue
    const { error } = await sb.from('farmacia_order_items').insert(chunk)
    if (error) throw new Error(`items insert: ${error.message}`)
    summary.itemsInserted += chunk.length
  }

  // 5. Recompute each affected contact's rollups from the DB.
  const affected = [...new Set(
    plan.orders.map((o) => (o.contactKey ? keyToId.get(o.contactKey) : null)).filter((x): x is string => !!x)
  )]
  for (const cid of affected) {
    const { data: ords } = await sb
      .from('farmacia_orders')
      .select('channel, order_date, total_cents')
      .eq('contact_id', cid)
    const rollupOrders: RollupOrder[] = (ords ?? []).map((r) => ({
      channel: r.channel as FarmaciaOrigin,
      orderDate: r.order_date as string | null,
      totalCents: r.total_cents as number | null,
    }))
    const roll = computeRollup(rollupOrders)
    if (roll.isConversion) summary.conversions++
    await sb.from('farmacia_contacts').update({
      orders_count: roll.ordersCount,
      total_spent_cents: roll.totalSpentCents,
      first_order_at: roll.firstOrderAt,
      last_order_at: roll.lastOrderAt,
      first_marketplace_order_at: roll.firstMarketplaceOrderAt,
      first_online_store_order_at: roll.firstOnlineStoreOrderAt,
      is_conversion: roll.isConversion,
      converted_at: roll.convertedAt,
    }).eq('id', cid)
  }

  // 6. Queue create ops for new contacts.
  if (createOps.length) await enqueueOps(createOps, importId)

  // 7. Recompute loyalty tiers for affected contacts and sync tier tags to GHL.
  if (affected.length) {
    const { applyTierTags } = await import('./tier-sync')
    await applyTierTags(affected)
  }

  return summary
}
