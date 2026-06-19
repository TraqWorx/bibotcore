import { describe, expect, it } from 'vitest'
import {
  sanitizePhone,
  normalizeChannel,
  isMarketplace,
  parseAmountToCents,
  parseDate,
  mapRow,
  groupIntoOrders,
  detectConversions,
  resolveCategory,
  type MappedRow,
} from '@/lib/farmacia/transform'
import { SHIPPYPRO_MAP } from '@/lib/farmacia/import-config'
import { FARMACIA_ORIGIN } from '@/lib/farmacia/fields'

describe('sanitizePhone', () => {
  it('normalizes Italian national numbers to +39', () => {
    expect(sanitizePhone('333 123 4567')).toBe('+393331234567')
    expect(sanitizePhone('3331234567')).toBe('+393331234567')
  })
  it('keeps explicit international form', () => {
    expect(sanitizePhone('+39 333 1234567')).toBe('+393331234567')
    expect(sanitizePhone('0039 3331234567')).toBe('+393331234567')
  })
  it('treats the same human number identically regardless of formatting (dedup key)', () => {
    expect(sanitizePhone('+39 333-123-4567')).toBe(sanitizePhone('3331234567'))
  })
  it('returns null for empty/garbage', () => {
    expect(sanitizePhone('')).toBeNull()
    expect(sanitizePhone('   ')).toBeNull()
    expect(sanitizePhone(null)).toBeNull()
  })
})

describe('normalizeChannel', () => {
  it('maps known marketplaces and the online store', () => {
    expect(normalizeChannel('Amazon.it')).toBe(FARMACIA_ORIGIN.AMAZON)
    expect(normalizeChannel('eBay')).toBe(FARMACIA_ORIGIN.EBAY)
    expect(normalizeChannel('Online Store')).toBe(FARMACIA_ORIGIN.ONLINE_STORE)
    expect(normalizeChannel('WooCommerce')).toBe(FARMACIA_ORIGIN.ONLINE_STORE)
  })
  it('falls back to other and honors overrides', () => {
    expect(normalizeChannel('Carrier XYZ')).toBe(FARMACIA_ORIGIN.OTHER)
    expect(normalizeChannel('MySite', { mysite: FARMACIA_ORIGIN.ONLINE_STORE })).toBe(FARMACIA_ORIGIN.ONLINE_STORE)
  })
  it('classifies marketplace correctly', () => {
    expect(isMarketplace(FARMACIA_ORIGIN.AMAZON)).toBe(true)
    expect(isMarketplace(FARMACIA_ORIGIN.ONLINE_STORE)).toBe(false)
  })
})

describe('parseAmountToCents', () => {
  it('parses Italian and international money formats', () => {
    expect(parseAmountToCents('12,34 €')).toBe(1234)
    expect(parseAmountToCents('1.234,56')).toBe(123456)
    expect(parseAmountToCents('12.34')).toBe(1234)
    expect(parseAmountToCents('1,234.56')).toBe(123456)
    expect(parseAmountToCents('1.000')).toBe(100000)
    expect(parseAmountToCents('5')).toBe(500)
  })
  it('returns null for non-numeric', () => {
    expect(parseAmountToCents('')).toBeNull()
    expect(parseAmountToCents(null)).toBeNull()
    expect(parseAmountToCents('N/A')).toBeNull()
  })
})

describe('parseDate', () => {
  it('parses Italian and ISO dates', () => {
    expect(parseDate('15/03/2026')).toBe('2026-03-15T00:00:00.000Z')
    expect(parseDate('2026-03-15')).toContain('2026-03-15')
  })
  it('returns null on junk', () => {
    expect(parseDate('not a date')).toBeNull()
    expect(parseDate('')).toBeNull()
  })
})

describe('mapRow', () => {
  it('maps ShippyPro headers to a normalized row', () => {
    const row = {
      'Order ID': 'A-1001',
      'Order Date': '15/03/2026',
      Phone: '333 123 4567',
      Email: 'Mario@Example.com',
      Customer: 'Mario Rossi',
      Marketplace: 'Amazon',
      Total: '29,90 €',
      SKU: 'SKU1',
      EAN: '8001234567890',
      Product: 'Vitamina C',
      Quantity: '2',
      'Unit Price': '14,95',
    }
    const m = mapRow(row, SHIPPYPRO_MAP)
    expect(m.orderExtId).toBe('A-1001')
    expect(m.phone).toBe('+393331234567')
    expect(m.email).toBe('mario@example.com')
    expect(m.firstName).toBe('Mario')
    expect(m.lastName).toBe('Rossi')
    expect(m.channel).toBe(FARMACIA_ORIGIN.AMAZON)
    expect(m.orderTotalCents).toBe(2990)
    expect(m.qty).toBe(2)
    expect(m.unitPriceCents).toBe(1495)
  })
})

describe('groupIntoOrders', () => {
  it('groups multi-line rows (header + items) into one order with items', () => {
    const base = (over: Partial<MappedRow>): MappedRow => ({
      orderExtId: 'A-1', orderDate: '2026-03-01T00:00:00.000Z', phone: '+393331234567',
      email: 'a@b.com', firstName: 'Mario', lastName: 'Rossi', channel: FARMACIA_ORIGIN.AMAZON,
      orderTotalCents: 5000, sku: null, ean: null, description: null, qty: null,
      unitPriceCents: null, lineTotalCents: null, category: null, ...over,
    })
    const rows: MappedRow[] = [
      base({ sku: 'S1', description: 'Item 1', qty: 1, lineTotalCents: 2000 }),
      base({ sku: 'S2', description: 'Item 2', qty: 1, lineTotalCents: 3000 }),
    ]
    const orders = groupIntoOrders(rows)
    expect(orders).toHaveLength(1)
    expect(orders[0].items).toHaveLength(2)
    expect(orders[0].totalCents).toBe(5000)
    expect(orders[0].channel).toBe(FARMACIA_ORIGIN.AMAZON)
  })
  it('skips rows without an order id and rows without product detail', () => {
    const rows: MappedRow[] = [
      { orderExtId: null } as unknown as MappedRow,
    ]
    expect(groupIntoOrders(rows)).toHaveLength(0)
  })
})

describe('detectConversions', () => {
  const order = (phone: string, channel: typeof FARMACIA_ORIGIN[keyof typeof FARMACIA_ORIGIN], date: string, id: string) => ({
    orderExtId: id, orderDate: date, phoneNorm: phone, email: null, firstName: null,
    lastName: null, channel, totalCents: 1000, category: null, items: [],
  })

  it('flags a marketplace order followed by a later online-store order', () => {
    const orders = [
      order('+391', FARMACIA_ORIGIN.AMAZON, '2026-01-01T00:00:00.000Z', 'm1'),
      order('+391', FARMACIA_ORIGIN.ONLINE_STORE, '2026-02-01T00:00:00.000Z', 'o1'),
    ]
    const conv = detectConversions(orders).get('+391')!
    expect(conv.isConversion).toBe(true)
    expect(conv.convertedAt).toBe('2026-02-01T00:00:00.000Z')
  })
  it('does NOT flag online-store-only or marketplace-only customers', () => {
    const onlineOnly = detectConversions([
      order('+392', FARMACIA_ORIGIN.ONLINE_STORE, '2026-01-01T00:00:00.000Z', 'o'),
    ]).get('+392')!
    expect(onlineOnly.isConversion).toBe(false)

    const mpOnly = detectConversions([
      order('+393', FARMACIA_ORIGIN.AMAZON, '2026-01-01T00:00:00.000Z', 'm'),
    ]).get('+393')!
    expect(mpOnly.isConversion).toBe(false)
  })
  it('does NOT flag when the online order came BEFORE the marketplace order', () => {
    const conv = detectConversions([
      order('+394', FARMACIA_ORIGIN.ONLINE_STORE, '2026-01-01T00:00:00.000Z', 'o'),
      order('+394', FARMACIA_ORIGIN.AMAZON, '2026-02-01T00:00:00.000Z', 'm'),
    ]).get('+394')!
    expect(conv.isConversion).toBe(false)
  })
})

describe('resolveCategory', () => {
  const skuMap = new Map([['S1', 'Integratori']])
  const eanMap = new Map([['8001', 'Cosmetici']])
  it('prefers an explicit (Market Rock) category', () => {
    expect(resolveCategory({ sku: 'S1', ean: '8001', category: 'Farmaci' }, skuMap, eanMap)).toBe('Farmaci')
  })
  it('falls back to SKU then EAN map', () => {
    expect(resolveCategory({ sku: 'S1', ean: null, category: null }, skuMap, eanMap)).toBe('Integratori')
    expect(resolveCategory({ sku: 'X', ean: '8001', category: null }, skuMap, eanMap)).toBe('Cosmetici')
  })
  it('returns null when nothing matches', () => {
    expect(resolveCategory({ sku: 'X', ean: 'Y', category: null }, skuMap, eanMap)).toBeNull()
  })
})
