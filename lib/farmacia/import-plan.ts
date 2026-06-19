/**
 * Pure import planner: turn parsed orders into the rows to persist
 * (contacts with rollups + conversion flags, orders, resolved line items).
 * No DB/network — fully unit-testable. lib/farmacia/import-orders.ts does the
 * actual upserts + sync enqueue from this plan.
 */

import { FARMACIA_ORIGIN, type FarmaciaOrigin } from './fields'
import { isMarketplace, resolveCategory, type ParsedOrder } from './transform'

export interface ContactRollup {
  ordersCount: number
  totalSpentCents: number
  firstOrderAt: string | null
  lastOrderAt: string | null
  firstMarketplaceOrderAt: string | null
  firstOnlineStoreOrderAt: string | null
  isConversion: boolean
  convertedAt: string | null
}

export interface RollupOrder {
  channel: FarmaciaOrigin
  orderDate: string | null
  totalCents: number | null
}

function minIso(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}
function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

/**
 * Aggregate a contact's orders. Shared by the planner and the DB recompute so
 * the conversion rule lives in exactly one place. Conversion = a marketplace
 * order, then a later online-store order.
 */
export function computeRollup(orders: RollupOrder[]): ContactRollup {
  const r: ContactRollup = {
    ordersCount: 0, totalSpentCents: 0, firstOrderAt: null, lastOrderAt: null,
    firstMarketplaceOrderAt: null, firstOnlineStoreOrderAt: null, isConversion: false, convertedAt: null,
  }
  for (const o of orders) {
    r.ordersCount += 1
    r.totalSpentCents += o.totalCents ?? 0
    r.firstOrderAt = minIso(r.firstOrderAt, o.orderDate)
    r.lastOrderAt = maxIso(r.lastOrderAt, o.orderDate)
    if (o.orderDate) {
      if (isMarketplace(o.channel)) r.firstMarketplaceOrderAt = minIso(r.firstMarketplaceOrderAt, o.orderDate)
      else if (o.channel === FARMACIA_ORIGIN.ONLINE_STORE) r.firstOnlineStoreOrderAt = minIso(r.firstOnlineStoreOrderAt, o.orderDate)
    }
  }
  if (r.firstMarketplaceOrderAt && r.firstOnlineStoreOrderAt && r.firstOnlineStoreOrderAt > r.firstMarketplaceOrderAt) {
    r.isConversion = true
    r.convertedAt = r.firstOnlineStoreOrderAt
  }
  return r
}

export interface PlannedContact extends ContactRollup {
  key: string                     // phone_norm, or `email:<addr>` when no phone
  phoneNorm: string | null
  email: string | null
  firstName: string | null
  lastName: string | null
  origins: FarmaciaOrigin[]
}

export interface PlannedItem {
  sku: string | null
  ean: string | null
  description: string | null
  qty: number | null
  unitPriceCents: number | null
  lineTotalCents: number | null
  category: string | null
}

export interface PlannedOrder {
  orderExtId: string
  contactKey: string | null
  phoneNorm: string | null
  channel: FarmaciaOrigin
  orderDate: string | null
  totalCents: number | null
  category: string | null
  items: PlannedItem[]
}

export interface ImportPlan {
  contacts: PlannedContact[]
  orders: PlannedOrder[]
}

function contactKeyFor(o: ParsedOrder): string | null {
  if (o.phoneNorm) return o.phoneNorm
  if (o.email) return `email:${o.email}`
  return null
}

export function buildImportPlan(
  orders: ParsedOrder[],
  opts?: { skuMap?: Map<string, string>; eanMap?: Map<string, string> }
): ImportPlan {
  const skuMap = opts?.skuMap ?? new Map()
  const eanMap = opts?.eanMap ?? new Map()

  const groups = new Map<string, { identity: ParsedOrder; origins: FarmaciaOrigin[]; orders: RollupOrder[] }>()
  const plannedOrders: PlannedOrder[] = []

  for (const o of orders) {
    plannedOrders.push({
      orderExtId: o.orderExtId,
      contactKey: contactKeyFor(o),
      phoneNorm: o.phoneNorm,
      channel: o.channel,
      orderDate: o.orderDate,
      totalCents: o.totalCents,
      category: o.category,
      items: o.items.map((it) => ({
        sku: it.sku, ean: it.ean, description: it.description, qty: it.qty,
        unitPriceCents: it.unitPriceCents, lineTotalCents: it.lineTotalCents,
        category: resolveCategory(it, skuMap, eanMap),
      })),
    })

    const key = contactKeyFor(o)
    if (!key) continue
    const g = groups.get(key) ?? { identity: o, origins: [], orders: [] }
    if (!g.origins.includes(o.channel)) g.origins.push(o.channel)
    g.orders.push({ channel: o.channel, orderDate: o.orderDate, totalCents: o.totalCents })
    // keep the first non-empty identity fields
    g.identity = {
      ...g.identity,
      email: g.identity.email ?? o.email,
      firstName: g.identity.firstName ?? o.firstName,
      lastName: g.identity.lastName ?? o.lastName,
      phoneNorm: g.identity.phoneNorm ?? o.phoneNorm,
    }
    groups.set(key, g)
  }

  const contacts: PlannedContact[] = []
  for (const [key, g] of groups) {
    contacts.push({
      key,
      phoneNorm: g.identity.phoneNorm,
      email: g.identity.email,
      firstName: g.identity.firstName,
      lastName: g.identity.lastName,
      origins: g.origins,
      ...computeRollup(g.orders),
    })
  }

  return { contacts, orders: plannedOrders }
}
