import { describe, it, expect } from 'vitest'
import { normalizeStore, type StoreLite } from '@/lib/apulia/pdp-chunked'

/** The live store list after migration 145. */
const STORES: StoreLite[] = [
  { slug: 'barletta', name: 'Barletta 2', city: 'Barletta', aliases: ['BARLETTA', 'STORE BARLETTA'] },
  { slug: 'bisceglie', name: 'Bisceglie 1', city: 'Bisceglie', aliases: ['BISCEGLIE', 'STORE BISCEGLIE'] },
  { slug: 'casagiove', name: 'Casagiove 3', city: 'Casagiove', aliases: ['CASAGIOVE', 'STORE CASAGIOVE'] },
  { slug: 'caserta', name: 'Caserta Centro 4', city: 'Caserta', aliases: ['CASERTA', 'CASERTA CENTRO', 'STORE CASERTA'] },
  { slug: 'messina', name: 'Messina 7', city: 'Messina', aliases: ['MESSINA', 'STORE MESSINA'] },
  { slug: 'napoli-secondigliano', name: 'Napoli Secondigliano 5', city: 'Napoli', aliases: ['SECONDIGLIANO', 'NAPOLI SECONDIGLIANO', 'STORE SECONDIGLIANO'] },
  { slug: 'torino', name: 'Torino 6', city: 'Torino', aliases: ['TORINO', 'STORE TORINO'] },
  { slug: 'quaresima-carmela', name: 'Quaresima Carmela', city: null, aliases: ['QUARESIMA CARMELA'] },
  { slug: 'matuozzo-anna', name: 'Matuozzo Anna', city: null, aliases: ['MATUOZZO ANNA'] },
]

describe('normalizeStore', () => {
  it('resolves every value in the October 2026 client file', () => {
    // Taken verbatim from the export, trailing and doubled spaces included.
    const cases: Array<[string, string]> = [
      ['STORE BISCEGLIE', 'bisceglie'],
      ['QUARESIMA CARMELA', 'quaresima-carmela'],
      ['STORE CASAGIOVE', 'casagiove'],
      ['STORE SECONDIGLIANO', 'napoli-secondigliano'],
      ['STORE CASERTA', 'caserta'],
      ['STORE BARLETTA', 'barletta'],
      ['STORE MESSINA', 'messina'],
      ['STORE TORINO', 'torino'],
      ['MATUOZZO ANNA ', 'matuozzo-anna'],
      ['STORE BARLETTA ', 'barletta'],
      ['STORE CASAGIOVE ', 'casagiove'],
      ['STORE  MESSINA', 'messina'],
    ]
    for (const [note, slug] of cases) {
      expect(normalizeStore(note, STORES), `"${note}"`).toBe(slug)
    }
  })

  it('matched Secondigliano, which the old contains-based rule did not', () => {
    // "STORE SECONDIGLIANO" does not contain "Napoli Secondigliano 5".
    expect(normalizeStore('STORE SECONDIGLIANO', STORES)).toBe('napoli-secondigliano')
  })

  it('leaves an undeclared value unassigned rather than guessing', () => {
    expect(normalizeStore('ALTRA SOCIETA', STORES)).toBeNull()
    expect(normalizeStore('', STORES)).toBeNull()
    expect(normalizeStore(undefined, STORES)).toBeNull()
    expect(normalizeStore('   ', STORES)).toBeNull()
  })

  it('does not let one town name swallow another', () => {
    // The old rule matched on substrings, so a note could land on a store that
    // merely shared a word with it.
    expect(normalizeStore('STORE BISCEGLIE NORD', STORES)).toBeNull()
    expect(normalizeStore('CASERTA SUD', STORES)).toBeNull()
  })

  it('accepts the slug and the city as written', () => {
    expect(normalizeStore('napoli-secondigliano', STORES)).toBe('napoli-secondigliano')
    expect(normalizeStore('Bisceglie', STORES)).toBe('bisceglie')
  })
})
