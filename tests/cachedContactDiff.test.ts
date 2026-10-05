import { describe, it, expect } from 'vitest'
import { transformContact, sameCachedContact } from '@/lib/sync/transforms'

const ghlContact = {
  id: 'ct1',
  firstName: 'Luca',
  lastName: 'Verdi',
  email: 'luca@example.it',
  phone: '+393335556677',
  companyName: 'Verdi SRL',
  address1: 'Via Roma 1',
  city: 'Bari',
  tags: ['cliente', 'vip'],
  assignedTo: 'user-9',
  dateAdded: '2026-01-02T10:00:00Z',
  lastActivity: '2026-09-30T08:00:00Z',
  updatedAt: '2026-09-30T08:00:00Z',
}

describe('sameCachedContact (bulk sync)', () => {
  const row = transformContact('loc1', ghlContact)

  it('holds when the cached row carries the same values', () => {
    const { raw: _raw, synced_at: _synced, location_id: _loc, ...stored } = row
    expect(sameCachedContact(stored, row)).toBe(true)
  })

  it('ignores synced_at, which moves on every run', () => {
    const { raw: _raw, synced_at: _synced, location_id: _loc, ...stored } = row
    const later = { ...transformContact('loc1', ghlContact), synced_at: '2099-01-01T00:00:00.000Z' }
    expect(sameCachedContact(stored, later)).toBe(true)
  })

  it('ignores tag order', () => {
    const { raw: _raw, synced_at: _synced, location_id: _loc, ...stored } = row
    expect(sameCachedContact({ ...stored, tags: ['vip', 'cliente'] }, row)).toBe(true)
  })

  it('is false for a contact we have never cached', () => {
    expect(sameCachedContact(undefined, row)).toBe(false)
  })

  it('sees GHL bumping updatedAt', () => {
    const { raw: _raw, synced_at: _synced, location_id: _loc, ...stored } = row
    const changed = transformContact('loc1', { ...ghlContact, updatedAt: '2026-10-01T09:00:00Z' })
    expect(sameCachedContact(stored, changed)).toBe(false)
  })

  it('sees an edited field and an added tag', () => {
    const { raw: _raw, synced_at: _synced, location_id: _loc, ...stored } = row
    expect(sameCachedContact(stored, transformContact('loc1', { ...ghlContact, city: 'Lecce' }))).toBe(false)
    expect(sameCachedContact(stored, transformContact('loc1', { ...ghlContact, tags: ['cliente'] }))).toBe(false)
  })

  it('treats a missing GHL field and a null column as the same', () => {
    const noPhone = transformContact('loc1', { ...ghlContact, phone: undefined })
    const { raw: _raw, synced_at: _synced, location_id: _loc, ...stored } = noPhone
    expect(sameCachedContact({ ...stored, phone: null }, noPhone)).toBe(true)
  })
})
