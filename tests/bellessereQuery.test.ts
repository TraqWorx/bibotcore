import { describe, expect, it } from 'vitest'
import {
  parsePageParams, sanitizeSearch, contactSearchOr,
  isApptStatusFilter, statusValuesFor, matchesStatus,
  validateNewUser, buildCreateUserPayload,
} from '@/lib/bellessere/query'

const sp = (q: string) => new URLSearchParams(q)

describe('parsePageParams', () => {
  it('uses defaults when absent', () => {
    expect(parsePageParams(sp(''), 100, 200)).toEqual({ limit: 100, offset: 0 })
  })
  it('clamps limit to max and floors at 1', () => {
    expect(parsePageParams(sp('limit=999'), 100, 200).limit).toBe(200)
    expect(parsePageParams(sp('limit=0'), 100, 200).limit).toBe(1)
    expect(parsePageParams(sp('limit=-5'), 100, 200).limit).toBe(1)
  })
  it('never returns a negative offset', () => {
    expect(parsePageParams(sp('offset=-10'), 100, 200).offset).toBe(0)
    expect(parsePageParams(sp('offset=40'), 100, 200).offset).toBe(40)
  })
  it('falls back to defaults on non-numeric input', () => {
    expect(parsePageParams(sp('limit=abc&offset=xyz'), 50, 200)).toEqual({ limit: 50, offset: 0 })
  })
})

describe('sanitizeSearch', () => {
  it('strips PostgREST filter-breaking characters', () => {
    expect(sanitizeSearch('a,b(c)%d*\\e')).toBe('a b c d e')
  })
  it('collapses whitespace and trims', () => {
    expect(sanitizeSearch('  mario   rossi  ')).toBe('mario rossi')
  })
  it('leaves a clean term untouched', () => {
    expect(sanitizeSearch('rossi')).toBe('rossi')
  })
})

describe('contactSearchOr', () => {
  it('builds an ilike OR across the four fields', () => {
    expect(contactSearchOr('ross')).toBe(
      'first_name.ilike.%ross%,last_name.ilike.%ross%,email.ilike.%ross%,phone.ilike.%ross%'
    )
  })
})

describe('isApptStatusFilter', () => {
  it('accepts known filters', () => {
    expect(isApptStatusFilter('confirmed')).toBe(true)
    expect(isApptStatusFilter('noshow')).toBe(true)
  })
  it('rejects unknown / empty', () => {
    expect(isApptStatusFilter('bogus')).toBe(false)
    expect(isApptStatusFilter(null)).toBe(false)
    expect(isApptStatusFilter(undefined)).toBe(false)
  })
})

describe('statusValuesFor', () => {
  it('maps confirmed to confirmed+new', () => {
    expect(statusValuesFor('confirmed')).toEqual(['confirmed', 'new'])
  })
  it('maps noshow to both spellings', () => {
    expect(statusValuesFor('noshow')).toEqual(['no-show', 'noshow'])
  })
  it('returns null for all (no constraint)', () => {
    expect(statusValuesFor('all')).toBeNull()
  })
})

describe('matchesStatus', () => {
  it('all matches everything', () => {
    expect(matchesStatus('cancelled', 'all')).toBe(true)
    expect(matchesStatus(null, 'all')).toBe(true)
  })
  it('confirmed matches confirmed and new (and null defaults to new)', () => {
    expect(matchesStatus('confirmed', 'confirmed')).toBe(true)
    expect(matchesStatus('new', 'confirmed')).toBe(true)
    expect(matchesStatus(null, 'confirmed')).toBe(true)
    expect(matchesStatus('cancelled', 'confirmed')).toBe(false)
  })
  it('noshow matches both hyphen spellings', () => {
    expect(matchesStatus('no-show', 'noshow')).toBe(true)
    expect(matchesStatus('noshow', 'noshow')).toBe(true)
    expect(matchesStatus('showed', 'noshow')).toBe(false)
  })
})

describe('validateNewUser', () => {
  it('requires first, last, valid email', () => {
    expect(validateNewUser({})).toBe('Nome obbligatorio')
    expect(validateNewUser({ firstName: 'A' })).toBe('Cognome obbligatorio')
    expect(validateNewUser({ firstName: 'A', lastName: 'B' })).toBe('Email obbligatoria')
    expect(validateNewUser({ firstName: 'A', lastName: 'B', email: 'nope' })).toBe('Email non valida')
  })
  it('passes a valid member', () => {
    expect(validateNewUser({ firstName: 'Adriana', lastName: 'P', email: 'a@x.com' })).toBeNull()
  })
})

describe('buildCreateUserPayload', () => {
  it('produces the GHL-required shape (verified via live probe)', () => {
    const body = buildCreateUserPayload(
      { firstName: ' Mauro ', lastName: ' R ', email: ' m@x.com ', phone: '' },
      'COMPANY1', 'LOC1'
    )
    expect(body).toEqual({
      companyId: 'COMPANY1',
      firstName: 'Mauro',
      lastName: 'R',
      email: 'm@x.com',
      phone: undefined,
      type: 'account',
      role: 'user',
      locationIds: ['LOC1'],
    })
  })
})
