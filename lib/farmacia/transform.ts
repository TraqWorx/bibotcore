/**
 * Pure transforms for the Farmacia importer: parse → map → group multi-line
 * orders → detect conversions → resolve category. No DB or network here so it
 * is fully unit-testable; the API route wires these to persistence + the sync
 * queue.
 */

import { FARMACIA_ORIGIN, type FarmaciaOrigin } from './fields'
import { type ColumnMap, pick } from './import-config'

export interface MappedRow {
  orderExtId: string | null
  orderDate: string | null      // ISO or null
  phone: string | null
  email: string | null
  firstName: string | null
  lastName: string | null
  channel: FarmaciaOrigin
  orderTotalCents: number | null
  sku: string | null
  ean: string | null
  description: string | null
  qty: number | null
  unitPriceCents: number | null
  lineTotalCents: number | null
  category: string | null
}

export interface ParsedItem {
  sku: string | null
  ean: string | null
  description: string | null
  qty: number | null
  unitPriceCents: number | null
  lineTotalCents: number | null
  category: string | null
}

export interface ParsedOrder {
  orderExtId: string
  orderDate: string | null
  phoneNorm: string | null
  email: string | null
  firstName: string | null
  lastName: string | null
  channel: FarmaciaOrigin
  totalCents: number | null
  category: string | null
  items: ParsedItem[]
}

/** Normalize a phone to +39… form for stable dedup. */
export function sanitizePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const hadPlus = String(raw).trim().startsWith('+')
  const d = String(raw).replace(/[^0-9]/g, '')
  if (!d) return null
  if (hadPlus) return '+' + d
  if (d.startsWith('00')) return '+' + d.slice(2)
  if (d.length === 12 && d.startsWith('39')) return '+' + d
  if (d.length === 10) return '+39' + d
  return '+' + d
}

/** Map a source channel/marketplace string to an origin. Configurable via overrides. */
export function normalizeChannel(
  raw: string | null | undefined,
  overrides?: Record<string, FarmaciaOrigin>
): FarmaciaOrigin {
  const s = (raw ?? '').toLowerCase().trim()
  if (!s) return FARMACIA_ORIGIN.OTHER
  if (overrides) {
    for (const [needle, origin] of Object.entries(overrides)) {
      if (s.includes(needle.toLowerCase())) return origin
    }
  }
  if (s.includes('amazon')) return FARMACIA_ORIGIN.AMAZON
  if (s.includes('ebay')) return FARMACIA_ORIGIN.EBAY
  if (s.includes('online') || s.includes('store') || s.includes('shop') || s.includes('web') || s.includes('woocommerce'))
    return FARMACIA_ORIGIN.ONLINE_STORE
  return FARMACIA_ORIGIN.OTHER
}

export function isMarketplace(channel: FarmaciaOrigin): boolean {
  return channel === FARMACIA_ORIGIN.AMAZON || channel === FARMACIA_ORIGIN.EBAY
}

/** Parse a money string (handles "12,34 €", "1.234,56", "12.34") to integer cents. */
export function parseAmountToCents(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const s = String(raw).replace(/[^0-9.,-]/g, '')
  if (!s || s === '-') return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let decimalSep = ''
  if (lastComma > -1 && lastDot > -1) decimalSep = lastComma > lastDot ? ',' : '.'
  else if (lastComma > -1) decimalSep = ','
  else if (lastDot > -1) {
    const parts = s.split('.')
    decimalSep = parts.length === 2 && parts[1].length <= 2 ? '.' : ''
  }
  let normalized: string
  if (decimalSep) {
    const thousands = decimalSep === ',' ? '.' : ','
    normalized = s.split(thousands).join('').replace(decimalSep, '.')
  } else {
    normalized = s.split(',').join('').split('.').join('')
  }
  const num = parseFloat(normalized)
  if (!isFinite(num)) return null
  return Math.round(num * 100)
}

function parseQty(raw: string | null): number | null {
  if (raw == null) return null
  const n = parseFloat(String(raw).replace(',', '.').replace(/[^0-9.-]/g, ''))
  return isFinite(n) ? n : null
}

/** Parse a date cell to ISO (supports ISO and Italian DD/MM/YYYY). */
export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  const it = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (it) {
    const [, dd, mm, yyyyRaw] = it
    const yyyy = yyyyRaw.length === 2 ? `20${yyyyRaw}` : yyyyRaw
    const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    const d = new Date(iso + 'T00:00:00Z')
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

/** Map one raw spreadsheet row to a normalized MappedRow using the column map. */
export function mapRow(
  raw: Record<string, string>,
  map: ColumnMap,
  channelOverrides?: Record<string, FarmaciaOrigin>
): MappedRow {
  const fullName = pick(raw, map.fullName)
  let firstName = pick(raw, map.firstName)
  let lastName = pick(raw, map.lastName)
  if (!firstName && !lastName && fullName) {
    const parts = fullName.split(/\s+/)
    firstName = parts.shift() ?? null
    lastName = parts.length ? parts.join(' ') : null
  }
  return {
    orderExtId: pick(raw, map.orderExtId),
    orderDate: parseDate(pick(raw, map.orderDate)),
    phone: sanitizePhone(pick(raw, map.phone)),
    email: pick(raw, map.email)?.toLowerCase() ?? null,
    firstName,
    lastName,
    channel: normalizeChannel(pick(raw, map.channel), channelOverrides),
    orderTotalCents: parseAmountToCents(pick(raw, map.orderTotal)),
    sku: pick(raw, map.sku),
    ean: pick(raw, map.ean),
    description: pick(raw, map.description),
    qty: parseQty(pick(raw, map.qty)),
    unitPriceCents: parseAmountToCents(pick(raw, map.unitPrice)),
    lineTotalCents: parseAmountToCents(pick(raw, map.lineTotal)),
    category: pick(raw, map.category),
  }
}

/** Group mapped rows (one per line item) into orders keyed by order id. */
export function groupIntoOrders(rows: MappedRow[]): ParsedOrder[] {
  const byId = new Map<string, ParsedOrder>()
  for (const r of rows) {
    if (!r.orderExtId) continue
    let o = byId.get(r.orderExtId)
    if (!o) {
      o = {
        orderExtId: r.orderExtId,
        orderDate: r.orderDate,
        phoneNorm: r.phone,
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        channel: r.channel,
        totalCents: r.orderTotalCents,
        category: r.category,
        items: [],
      }
      byId.set(r.orderExtId, o)
    } else {
      // Fill header fields from later rows only when the first row left them empty.
      o.orderDate ??= r.orderDate
      o.phoneNorm ??= r.phone
      o.email ??= r.email
      o.firstName ??= r.firstName
      o.lastName ??= r.lastName
      o.totalCents ??= r.orderTotalCents
      o.category ??= r.category
      if (o.channel === FARMACIA_ORIGIN.OTHER && r.channel !== FARMACIA_ORIGIN.OTHER) o.channel = r.channel
    }
    // Only push a line item if the row carries product detail.
    if (r.sku || r.ean || r.description) {
      o.items.push({
        sku: r.sku,
        ean: r.ean,
        description: r.description,
        qty: r.qty,
        unitPriceCents: r.unitPriceCents,
        lineTotalCents: r.lineTotalCents,
        category: r.category,
      })
    }
  }
  return [...byId.values()]
}

export interface ConversionInfo {
  phoneNorm: string
  isConversion: boolean
  firstMarketplaceAt: string | null
  firstOnlineStoreAt: string | null
  convertedAt: string | null
}

/**
 * A phone is a "conversion" when it has a marketplace order AND a later
 * online-store order. Orders without a date can't establish ordering and are
 * ignored for the comparison.
 */
export function detectConversions(orders: ParsedOrder[]): Map<string, ConversionInfo> {
  const byPhone = new Map<string, { marketplace: string[]; online: string[] }>()
  for (const o of orders) {
    if (!o.phoneNorm) continue
    const bucket = byPhone.get(o.phoneNorm) ?? { marketplace: [], online: [] }
    if (o.orderDate) {
      if (isMarketplace(o.channel)) bucket.marketplace.push(o.orderDate)
      else if (o.channel === FARMACIA_ORIGIN.ONLINE_STORE) bucket.online.push(o.orderDate)
    }
    byPhone.set(o.phoneNorm, bucket)
  }
  const out = new Map<string, ConversionInfo>()
  for (const [phone, b] of byPhone) {
    const firstMarketplace = b.marketplace.length ? b.marketplace.slice().sort()[0] : null
    const firstOnline = b.online.length ? b.online.slice().sort()[0] : null
    const isConversion = !!firstMarketplace && !!firstOnline && firstOnline > firstMarketplace
    out.set(phone, {
      phoneNorm: phone,
      isConversion,
      firstMarketplaceAt: firstMarketplace,
      firstOnlineStoreAt: firstOnline,
      convertedAt: isConversion ? firstOnline : null,
    })
  }
  return out
}

/** Resolve an item's category: Market Rock value wins, else SKU map, else EAN map. */
export function resolveCategory(
  item: { sku: string | null; ean: string | null; category: string | null },
  skuMap: Map<string, string>,
  eanMap: Map<string, string>
): string | null {
  if (item.category && item.category.trim()) return item.category.trim()
  if (item.sku && skuMap.has(item.sku)) return skuMap.get(item.sku)!
  if (item.ean && eanMap.has(item.ean)) return eanMap.get(item.ean)!
  return null
}
