import { describe, expect, it } from 'vitest'
import { mapReview } from '@/lib/farmacia/reviews'

describe('mapReview', () => {
  it('maps a typical review and tolerates field-name variants', () => {
    const row = mapReview({ id: 'r1', rating: 5, comment: 'Ottima farmacia', reviewer: { name: 'Anna' }, source: 'google', createdAt: '2026-05-01T00:00:00Z' }, 'LOC')!
    expect(row.id).toBe('r1')
    expect(row.rating).toBe(5)
    expect(row.body).toBe('Ottima farmacia')
    expect(row.reviewer_name).toBe('Anna')
    expect(row.platform).toBe('google')
    expect(row.location_id).toBe('LOC')
  })
  it('handles string reviewer and alternate id/body keys', () => {
    const row = mapReview({ _id: 'r2', content: 'Bene', reviewer: 'Marco', dateAdded: '2026-04-01T00:00:00Z' }, 'LOC')!
    expect(row.id).toBe('r2')
    expect(row.body).toBe('Bene')
    expect(row.reviewer_name).toBe('Marco')
  })
  it('returns null when there is no id', () => {
    expect(mapReview({ rating: 4 }, 'LOC')).toBeNull()
  })
})
