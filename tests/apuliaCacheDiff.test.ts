import { describe, it, expect } from 'vitest'
import { sameCachedContact, cacheRowFromGhlContact, type CachedContactRow } from '@/lib/apulia/cache'

/** A fully-populated cached row, as PostgREST hands it back. */
function row(patch: Partial<CachedContactRow> = {}): CachedContactRow {
  return {
    id: 'c1',
    ghl_id: 'c1',
    sync_status: 'synced',
    email: 'mario@example.it',
    phone: '+393331234567',
    first_name: 'Mario',
    last_name: 'Rossi',
    tags: ['amministratore', 'switch-out'],
    custom_fields: { aaa: '1', bbb: 'due' },
    pod_pdr: '1042000000001',
    codice_amministratore: '14644263',
    amministratore_name: 'ROSSI MARIO',
    cliente: 'ROSSI MARIO',
    comune: 'Bari',
    stato: 'Attivo',
    compenso_per_pod: 12,
    pod_override: null,
    commissione_totale: 36.5,
    is_amministratore: false,
    is_switch_out: true,
    ghl_updated_at: null,
    ...patch,
  }
}

describe('sameCachedContact', () => {
  it('holds for an identical row', () => {
    expect(sameCachedContact(row(), row())).toBe(true)
  })

  it('ignores tag order, which GHL does not promise', () => {
    expect(sameCachedContact(row({ tags: ['switch-out', 'amministratore'] }), row())).toBe(true)
  })

  it('ignores custom-field key order, which jsonb normalises', () => {
    const stored = row({ custom_fields: { bbb: 'due', aaa: '1' } })
    expect(sameCachedContact(stored, row())).toBe(true)
  })

  it('treats a numeric column as equal across string and number forms', () => {
    // numeric columns can arrive as strings depending on the column type
    expect(sameCachedContact(row({ commissione_totale: '36.5' as unknown as number }), row())).toBe(true)
  })

  it('sees a changed field', () => {
    expect(sameCachedContact(row({ comune: 'Lecce' }), row())).toBe(false)
    expect(sameCachedContact(row({ stato: null }), row())).toBe(false)
    expect(sameCachedContact(row({ is_switch_out: false }), row())).toBe(false)
    expect(sameCachedContact(row({ pod_override: 5 }), row())).toBe(false)
  })

  it('sees an added, removed or changed custom field', () => {
    expect(sameCachedContact(row({ custom_fields: { aaa: '1' } }), row())).toBe(false)
    expect(sameCachedContact(row({ custom_fields: { aaa: '1', bbb: 'due', ccc: 'tre' } }), row())).toBe(false)
    expect(sameCachedContact(row({ custom_fields: { aaa: '1', bbb: 'tre' } }), row())).toBe(false)
  })

  it('sees an added or removed tag', () => {
    expect(sameCachedContact(row({ tags: ['amministratore'] }), row())).toBe(false)
    expect(sameCachedContact(row({ tags: ['amministratore', 'switch-out', 'nuovo'] }), row())).toBe(false)
  })

  it('holds for a row built from the GHL payload it was built from', () => {
    const ghl = {
      id: 'g1',
      email: 'anna@example.it',
      phone: undefined,
      firstName: 'Anna',
      lastName: 'Bianchi',
      tags: ['Amministratore'],
      customFields: [{ id: 'fff', value: 'x' }],
    }
    const built = cacheRowFromGhlContact(ghl as Parameters<typeof cacheRowFromGhlContact>[0])
    expect(sameCachedContact(built, built)).toBe(true)
    // and a second build of the same payload must not look like a change
    expect(sameCachedContact(built, cacheRowFromGhlContact(ghl as Parameters<typeof cacheRowFromGhlContact>[0]))).toBe(true)
  })
})
