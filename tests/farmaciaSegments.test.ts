import { describe, expect, it } from 'vitest'
import {
  computeTier, countByTier, averageOrderCents, normalizeSegments, tierTag,
  DEFAULT_SEGMENTS, type SegmentConfig,
} from '@/lib/farmacia/segments'

const anyCfg = (segments = DEFAULT_SEGMENTS): SegmentConfig => ({ segments, matchMode: 'any' })
const allCfg = (segments: SegmentConfig['segments']): SegmentConfig => ({ segments, matchMode: 'all' })

describe('computeTier — order count', () => {
  it('returns the highest tier the order count meets', () => {
    expect(computeTier(0, 0, anyCfg())?.name).toBe('Bronzo')
    expect(computeTier(7, 0, anyCfg())?.name).toBe('Argento')
    expect(computeTier(20, 0, anyCfg())?.name).toBe('Oro')
    expect(computeTier(999, 0, anyCfg())?.name).toBe('Platino')
  })
  it('re-buckets when thresholds change', () => {
    const stricter = anyCfg([{ name: 'Bronzo', minOrders: 0, minSpendCents: 0 }, { name: 'Oro', minOrders: 30, minSpendCents: 0 }])
    expect(computeTier(20, 0, stricter)?.name).toBe('Bronzo')
  })
})

describe('computeTier — mixing orders and spend', () => {
  const segs = [
    { name: 'Bronzo', minOrders: 0, minSpendCents: 0 },
    { name: 'Oro', minOrders: 20, minSpendCents: 100000 }, // 20 orders OR €1000
  ]
  it('ANY: meeting either threshold reaches the tier', () => {
    expect(computeTier(20, 0, allCfg(segs)) === null).toBe(false)
    expect(computeTier(5, 120000, { segments: segs, matchMode: 'any' })?.name).toBe('Oro') // big spender, few orders
    expect(computeTier(25, 0, { segments: segs, matchMode: 'any' })?.name).toBe('Oro') // frequent, low spend
  })
  it('ALL: must meet both thresholds', () => {
    expect(computeTier(25, 0, allCfg(segs))?.name).toBe('Bronzo') // orders ok, spend not
    expect(computeTier(25, 120000, allCfg(segs))?.name).toBe('Oro') // both ok
  })
})

describe('countByTier', () => {
  it('counts per tier and shifts when thresholds change', () => {
    const customers = [0, 5, 5, 25, 60].map((n) => ({ ordersCount: n, totalSpentCents: 0 }))
    expect(countByTier(customers, anyCfg())).toEqual({ Bronzo: 1, Argento: 2, Oro: 1, Platino: 1 })
    const raised = anyCfg(DEFAULT_SEGMENTS.map((s) => (s.name === 'Oro' ? { ...s, minOrders: 30 } : s)))
    expect(countByTier(customers, raised).Argento).toBe(3)
  })
})

describe('averageOrderCents', () => {
  it('computes scontrino medio and guards divide-by-zero', () => {
    expect(averageOrderCents(10000, 4)).toBe(2500)
    expect(averageOrderCents(0, 0)).toBe(0)
  })
})

describe('tierTag', () => {
  it('slugs a tier name into a GHL tag', () => {
    expect(tierTag('Oro')).toBe('livello-oro')
    expect(tierTag('Cliente VIP')).toBe('livello-cliente-vip')
  })
})

describe('normalizeSegments', () => {
  it('drops blanks and clamps negatives, preserving order', () => {
    const out = normalizeSegments([
      { name: 'Oro', minOrders: 20, minSpendCents: -5 },
      { name: '  ', minOrders: 5, minSpendCents: 0 },
      { name: 'Bronzo', minOrders: -3, minSpendCents: 0 },
    ])
    expect(out.map((s) => s.name)).toEqual(['Oro', 'Bronzo'])
    expect(out[0].minSpendCents).toBe(0)
    expect(out[1].minOrders).toBe(0)
  })
})
