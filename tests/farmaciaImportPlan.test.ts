import { describe, expect, it } from 'vitest'
import { buildImportPlan } from '@/lib/farmacia/import-plan'
import { type ParsedOrder } from '@/lib/farmacia/transform'
import { FARMACIA_ORIGIN } from '@/lib/farmacia/fields'

function order(over: Partial<ParsedOrder>): ParsedOrder {
  return {
    orderExtId: 'O1', orderDate: '2026-01-01T00:00:00.000Z', phoneNorm: '+393331234567',
    email: 'mario@example.com', firstName: 'Mario', lastName: 'Rossi',
    channel: FARMACIA_ORIGIN.AMAZON, totalCents: 1000, category: null, items: [], ...over,
  }
}

describe('buildImportPlan', () => {
  it('rolls up a contact across orders (count, spend, origins, first/last)', () => {
    const plan = buildImportPlan([
      order({ orderExtId: 'A', channel: FARMACIA_ORIGIN.AMAZON, totalCents: 1000, orderDate: '2026-01-01T00:00:00.000Z' }),
      order({ orderExtId: 'B', channel: FARMACIA_ORIGIN.ONLINE_STORE, totalCents: 2500, orderDate: '2026-03-01T00:00:00.000Z' }),
    ])
    expect(plan.contacts).toHaveLength(1)
    const c = plan.contacts[0]
    expect(c.ordersCount).toBe(2)
    expect(c.totalSpentCents).toBe(3500)
    expect(c.origins.sort()).toEqual(['amazon', 'online_store'])
    expect(c.firstOrderAt).toBe('2026-01-01T00:00:00.000Z')
    expect(c.lastOrderAt).toBe('2026-03-01T00:00:00.000Z')
  })

  it('flags conversion when marketplace precedes online store', () => {
    const plan = buildImportPlan([
      order({ orderExtId: 'A', channel: FARMACIA_ORIGIN.AMAZON, orderDate: '2026-01-01T00:00:00.000Z' }),
      order({ orderExtId: 'B', channel: FARMACIA_ORIGIN.ONLINE_STORE, orderDate: '2026-02-01T00:00:00.000Z' }),
    ])
    expect(plan.contacts[0].isConversion).toBe(true)
    expect(plan.contacts[0].convertedAt).toBe('2026-02-01T00:00:00.000Z')
  })

  it('does not flag conversion for online-store-first customers', () => {
    const plan = buildImportPlan([
      order({ orderExtId: 'A', channel: FARMACIA_ORIGIN.ONLINE_STORE, orderDate: '2026-01-01T00:00:00.000Z' }),
      order({ orderExtId: 'B', channel: FARMACIA_ORIGIN.AMAZON, orderDate: '2026-02-01T00:00:00.000Z' }),
    ])
    expect(plan.contacts[0].isConversion).toBe(false)
  })

  it('keys contacts by email when phone is missing, and leaves orphan orders unlinked', () => {
    const plan = buildImportPlan([
      order({ orderExtId: 'A', phoneNorm: null, email: 'x@y.com' }),
      order({ orderExtId: 'B', phoneNorm: null, email: null }),
    ])
    expect(plan.contacts).toHaveLength(1)
    expect(plan.contacts[0].key).toBe('email:x@y.com')
    const orphan = plan.orders.find((o) => o.orderExtId === 'B')!
    expect(orphan.contactKey).toBeNull()
  })

  it('resolves item categories via the SKU/EAN maps', () => {
    const plan = buildImportPlan(
      [order({ items: [{ sku: 'S1', ean: null, description: 'd', qty: 1, unitPriceCents: 100, lineTotalCents: 100, category: null }] })],
      { skuMap: new Map([['S1', 'Integratori']]) }
    )
    expect(plan.orders[0].items[0].category).toBe('Integratori')
  })
})
