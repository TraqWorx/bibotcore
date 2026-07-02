import { describe, expect, it } from 'vitest'
import {
  hhmmToMinutes, entryWindow, overlaps, entryMatchesSlot, matchWaitlist, buildWaitlistSms, renderInviteText,
  type WaitEntry, type FreedSlot, type ServiceInfo,
} from '@/lib/bellessere/waitlist'

const service: ServiceInfo = { slot_duration: 30, team_members: [{ userId: 'OP1' }, { userId: 'OP2' }] }
const services = { CAL1: service }

const baseEntry = (over: Partial<WaitEntry> = {}): WaitEntry => ({
  id: 'e1', calendar_id: 'CAL1', operator_id: null,
  preferred_date: '2026-07-10', time_pref: 'any',
  preferred_from: null, preferred_to: null, status: 'waiting',
  created_at: '2026-07-01T10:00:00Z', ...over,
})

const freed = (over: Partial<FreedSlot> = {}): FreedSlot => ({
  operatorId: 'OP1', date: '2026-07-10', startMinutes: 10 * 60, endMinutes: 11 * 60, ...over,
})

describe('hhmmToMinutes', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(hhmmToMinutes('09:30')).toBe(570)
    expect(hhmmToMinutes('13:00:00')).toBe(780)
  })
  it('returns null for empty/invalid', () => {
    expect(hhmmToMinutes(null)).toBeNull()
    expect(hhmmToMinutes('nope')).toBeNull()
  })
})

describe('entryWindow', () => {
  it('maps presets', () => {
    expect(entryWindow({ time_pref: 'any', preferred_from: null, preferred_to: null })).toEqual([0, 1440])
    expect(entryWindow({ time_pref: 'morning', preferred_from: null, preferred_to: null })).toEqual([0, 780])
    expect(entryWindow({ time_pref: 'afternoon', preferred_from: null, preferred_to: null })).toEqual([780, 1440])
  })
  it('uses the specific window', () => {
    expect(entryWindow({ time_pref: 'specific', preferred_from: '14:00', preferred_to: '16:00' })).toEqual([840, 960])
  })
})

describe('overlaps', () => {
  it('is half-open', () => {
    expect(overlaps(0, 10, 10, 20)).toBe(false)
    expect(overlaps(0, 11, 10, 20)).toBe(true)
  })
})

describe('entryMatchesSlot', () => {
  it('matches a plain any-operator any-time same-day entry', () => {
    expect(entryMatchesSlot(baseEntry(), freed(), service)).toBe(true)
  })
  it('rejects a different day', () => {
    expect(entryMatchesSlot(baseEntry({ preferred_date: '2026-07-11' }), freed(), service)).toBe(false)
  })
  it('rejects non-waiting entries', () => {
    expect(entryMatchesSlot(baseEntry({ status: 'invited' }), freed(), service)).toBe(false)
  })
  it('honours operator preference', () => {
    expect(entryMatchesSlot(baseEntry({ operator_id: 'OP1' }), freed({ operatorId: 'OP1' }), service)).toBe(true)
    expect(entryMatchesSlot(baseEntry({ operator_id: 'OP2' }), freed({ operatorId: 'OP1' }), service)).toBe(false)
  })
  it('requires the freed operator to be on the service team', () => {
    expect(entryMatchesSlot(baseEntry(), freed({ operatorId: 'STRANGER' }), service)).toBe(false)
  })
  it('rejects when the freed window is too short for the service', () => {
    const longService: ServiceInfo = { slot_duration: 90, team_members: [{ userId: 'OP1' }] }
    expect(entryMatchesSlot(baseEntry(), freed({ startMinutes: 600, endMinutes: 660 }), longService)).toBe(false)
  })
  it('respects a morning-only preference', () => {
    const morning = baseEntry({ time_pref: 'morning' })
    expect(entryMatchesSlot(morning, freed({ startMinutes: 10 * 60, endMinutes: 11 * 60 }), service)).toBe(true)
    expect(entryMatchesSlot(morning, freed({ startMinutes: 15 * 60, endMinutes: 16 * 60 }), service)).toBe(false)
  })
  it('respects a specific window', () => {
    const spec = baseEntry({ time_pref: 'specific', preferred_from: '14:00', preferred_to: '16:00' })
    expect(entryMatchesSlot(spec, freed({ startMinutes: 14 * 60, endMinutes: 15 * 60 }), service)).toBe(true)
    expect(entryMatchesSlot(spec, freed({ startMinutes: 9 * 60, endMinutes: 10 * 60 }), service)).toBe(false)
  })
})

describe('matchWaitlist', () => {
  it('returns matches ordered first-in-line (oldest created_at first)', () => {
    const older = baseEntry({ id: 'old', created_at: '2026-07-01T08:00:00Z' })
    const newer = baseEntry({ id: 'new', created_at: '2026-07-02T08:00:00Z' })
    const other = baseEntry({ id: 'wrongday', preferred_date: '2026-07-12' })
    const result = matchWaitlist(freed(), [newer, older, other], services)
    expect(result.map(e => e.id)).toEqual(['old', 'new'])
  })
})

describe('renderInviteText', () => {
  it('substitutes all placeholders (case/space-insensitive)', () => {
    const out = renderInviteText('Ciao {{nome}}, {{ SERVIZIO }} il {{giorno}} alle {{ora}}: {{link}}', {
      nome: 'Marco', servizio: 'Barba', giorno: '10 luglio', ora: '09:30', link: 'https://x.y',
    })
    expect(out).toBe('Ciao Marco, Barba il 10 luglio alle 09:30: https://x.y')
  })
  it('replaces missing vars with empty string', () => {
    expect(renderInviteText('{{nome}}{{servizio}}', {})).toBe('')
  })
})

describe('buildWaitlistSms', () => {
  it('includes name, service, date and link', () => {
    const msg = buildWaitlistSms({ name: 'Marco', serviceName: 'Barba', dateLabel: '10 luglio', bookingLink: 'https://x.y/z' })
    expect(msg).toContain('Marco')
    expect(msg).toContain('Barba')
    expect(msg).toContain('10 luglio')
    expect(msg).toContain('https://x.y/z')
  })
})
