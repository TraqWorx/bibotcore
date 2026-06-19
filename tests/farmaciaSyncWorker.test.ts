import { describe, expect, it } from 'vitest'
import { buildContactBody, type ContactRow } from '@/lib/farmacia/sync-worker'
import { FARMACIA_LOCATION_ID } from '@/lib/farmacia/fields'

const row: ContactRow = {
  id: 'c1', ghl_id: null, email: 'mario@example.com', phone: '+393331234567',
  first_name: 'Mario', last_name: 'Rossi', tags: ['cliente', 'origine-amazon'],
  custom_fields: { fieldA: 'v1' },
}

describe('buildContactBody', () => {
  it('includes locationId only on create', () => {
    expect(buildContactBody(row, { create: true }).locationId).toBe(FARMACIA_LOCATION_ID)
    expect(buildContactBody(row, { create: false }).locationId).toBeUndefined()
  })
  it('maps identity, tags and custom fields', () => {
    const b = buildContactBody(row, { create: true })
    expect(b.firstName).toBe('Mario')
    expect(b.email).toBe('mario@example.com')
    expect(b.tags).toEqual(['cliente', 'origine-amazon'])
    expect(b.customFields).toEqual([{ id: 'fieldA', value: 'v1' }])
  })
  it('omits null identity fields', () => {
    const b = buildContactBody({ ...row, email: null, last_name: null, tags: null }, { create: false })
    expect('email' in b).toBe(false)
    expect('lastName' in b).toBe(false)
    expect('tags' in b).toBe(false)
    expect(b.customFields).toEqual([{ id: 'fieldA', value: 'v1' }])
  })
})
