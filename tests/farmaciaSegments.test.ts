import { describe, expect, it } from 'vitest'
import { computeTier, countByTier, averageOrderCents, normalizeSegments, DEFAULT_SEGMENTS } from '@/lib/farmacia/segments'

describe('computeTier', () => {
  it('returns the highest tier the order count meets', () => {
    expect(computeTier(0, DEFAULT_SEGMENTS)?.name).toBe('Bronzo')
    expect(computeTier(7, DEFAULT_SEGMENTS)?.name).toBe('Argento')
    expect(computeTier(20, DEFAULT_SEGMENTS)?.name).toBe('Oro')
    expect(computeTier(999, DEFAULT_SEGMENTS)?.name).toBe('Platino')
  })
  it('re-buckets instantly when thresholds change', () => {
    const custom = [{ name: 'Bronzo', minOrders: 0 }, { name: 'Oro', minOrders: 20 }]
    expect(computeTier(20, custom)?.name).toBe('Oro')
    const stricter = [{ name: 'Bronzo', minOrders: 0 }, { name: 'Oro', minOrders: 30 }]
    expect(computeTier(20, stricter)?.name).toBe('Bronzo')
  })
})

describe('countByTier', () => {
  it('counts customers per tier and changes with the thresholds', () => {
    const counts = [0, 5, 5, 25, 60]
    const c = countByTier(counts, DEFAULT_SEGMENTS)
    expect(c).toEqual({ Bronzo: 1, Argento: 2, Oro: 1, Platino: 1 })
    // raise Oro to 30 → the 25-order customer drops to Argento
    const raised = DEFAULT_SEGMENTS.map((s) => (s.name === 'Oro' ? { ...s, minOrders: 30 } : s))
    expect(countByTier(counts, raised).Argento).toBe(3)
    expect(countByTier(counts, raised).Oro).toBe(0)
  })
})

describe('averageOrderCents', () => {
  it('computes scontrino medio and guards divide-by-zero', () => {
    expect(averageOrderCents(10000, 4)).toBe(2500)
    expect(averageOrderCents(0, 0)).toBe(0)
  })
})

describe('normalizeSegments', () => {
  it('drops blanks, clamps negatives, sorts by threshold', () => {
    const out = normalizeSegments([
      { name: 'Oro', minOrders: 20 },
      { name: '  ', minOrders: 5 },
      { name: 'Bronzo', minOrders: -3 },
    ])
    expect(out.map((s) => s.name)).toEqual(['Bronzo', 'Oro'])
    expect(out[0].minOrders).toBe(0)
  })
})
