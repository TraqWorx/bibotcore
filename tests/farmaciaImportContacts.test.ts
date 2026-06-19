import { describe, expect, it } from 'vitest'
import { validateContactRows } from '@/lib/farmacia/import-contacts'
import { SHIPPYPRO_MAP } from '@/lib/farmacia/import-config'

describe('validateContactRows', () => {
  it('accepts rows with a name and a valid phone', () => {
    const r = validateContactRows([
      { Customer: 'Mario Rossi', Phone: '333 123 4567', Email: 'm@x.com' },
    ], SHIPPYPRO_MAP)
    expect(r.valid).toHaveLength(1)
    expect(r.valid[0].phoneNorm).toBe('+393331234567')
    expect(r.discarded).toBe(0)
  })

  it('discards with reasons: missing phone, invalid phone, missing name', () => {
    const r = validateContactRows([
      { Customer: 'No Phone' },                         // telefono mancante
      { Customer: 'Bad Phone', Phone: '123' },          // telefono non valido
      { Phone: '3331234567' },                          // nome mancante
      { Customer: 'Ok', Phone: '3339998877' },          // valid
    ], SHIPPYPRO_MAP)
    expect(r.valid).toHaveLength(1)
    expect(r.reasons['telefono mancante']).toBe(1)
    expect(r.reasons['telefono non valido']).toBe(1)
    expect(r.reasons['nome mancante']).toBe(1)
    expect(r.discarded).toBe(3)
  })

  it('dedups by phone within the file', () => {
    const r = validateContactRows([
      { Customer: 'A', Phone: '333 123 4567' },
      { Customer: 'A dup', Phone: '+39 3331234567' },
    ], SHIPPYPRO_MAP)
    expect(r.valid).toHaveLength(1)
    expect(r.reasons['duplicato nel file']).toBe(1)
  })
})
