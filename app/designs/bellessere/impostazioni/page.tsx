'use client'

import { useState, useEffect } from 'react'

interface GhlUser { id: string; name: string; email: string }

// GHL availability slot: either { openHour, openMinute, closeHour, closeMinute }
// or { open: "HH:MM", close: "HH:MM" } — we handle both
interface GhlHour {
  openHour?: number; openMinute?: number
  closeHour?: number; closeMinute?: number
  open?: string; close?: string
}

interface GhlAvailabilityDay {
  // GHL uses either a "day" string ("monday", "tuesday", ...) or numeric index (0=Sun,1=Mon,...)
  day?: string | number
  // Some GHL responses use "date" for specific dates — skip these (null = recurring weekly)
  date?: string | null
  hours?: GhlHour[]
  // Flat fields (some API versions)
  openHour?: number; openMinute?: number; closeHour?: number; closeMinute?: number
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_LABELS_IT: Record<string, string> = {
  sunday: 'Dom', monday: 'Lun', tuesday: 'Mar', wednesday: 'Mer',
  thursday: 'Gio', friday: 'Ven', saturday: 'Sab',
}

function fmt(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseHourRange(entry: GhlAvailabilityDay): string {
  // Flat format
  if (entry.openHour != null) return `${fmt(entry.openHour, entry.openMinute ?? 0)} – ${fmt(entry.closeHour ?? 17, entry.closeMinute ?? 0)}`
  const h = entry.hours?.[0]
  if (!h) return ''
  if (h.openHour != null) return `${fmt(h.openHour, h.openMinute ?? 0)} – ${fmt(h.closeHour ?? 17, h.closeMinute ?? 0)}`
  if (h.open) return `${h.open} – ${h.close ?? ''}`
  return ''
}

function normaliseDayKey(day: string | number | undefined): string | null {
  if (day == null) return null
  if (typeof day === 'number') return DAY_KEYS[day] ?? null
  return String(day).toLowerCase()
}

function buildScheduleMap(availability: GhlAvailabilityDay[]): Record<string, string | null> {
  const map: Record<string, string | null> = {}
  for (const k of DAY_KEYS) map[k] = null // null = closed

  for (const entry of availability) {
    // Skip specific-date overrides (only show recurring weekly)
    if (entry.date !== undefined && entry.date !== null) continue
    const key = normaliseDayKey(entry.day)
    if (!key || !DAY_KEYS.includes(key)) continue
    const range = parseHourRange(entry)
    map[key] = range || 'Aperto'
  }
  return map
}

function AvailabilityGrid({ availability }: { availability: GhlAvailabilityDay[] }) {
  const schedule = buildScheduleMap(availability)
  const workDays = DAY_KEYS.filter(k => schedule[k] !== null)

  if (workDays.length === 0) {
    return <span style={{ fontSize: 12, color: 'var(--bs-text-faint)', fontStyle: 'italic' }}>Nessun orario impostato su GHL</span>
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 6 }}>
      {DAY_KEYS.filter(k => schedule[k] !== null).map(k => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--bs-text-muted)', width: 28 }}>{DAY_LABELS_IT[k]}</span>
          <span style={{ fontSize: 12, color: 'var(--bs-text)' }}>{schedule[k]}</span>
        </div>
      ))}
    </div>
  )
}

export default function ImpostazioniPage() {
  const [users, setUsers] = useState<GhlUser[]>([])
  const [schedules, setSchedules] = useState<Record<string, GhlAvailabilityDay[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/bellessere/services').then(r => r.json()),
      fetch('/api/bellessere/user-availability').then(r => r.json()),
    ]).then(([svc, avail]) => {
      setUsers(svc.users ?? [])
      const map: Record<string, GhlAvailabilityDay[]> = {}
      for (const s of (avail.schedules ?? [])) map[s.userId] = s.availability ?? []
      setSchedules(map)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <div className="bs-page-eyebrow">Bibot</div>
        <h1 className="bs-page-title">Impostazioni</h1>
      </div>

      {/* Team + GHL availability */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
          Team — Disponibilità da GHL
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--bs-text-faint)' }}>Caricamento...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--bs-text-faint)' }}>Nessun membro del team trovato</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {users.map(u => (
              <div key={u.id} className="bs-card" style={{ padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: 'var(--bs-gold)', flexShrink: 0 }}>
                    {u.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>{u.email}</div>
                  </div>
                </div>
                <AvailabilityGrid availability={schedules[u.id] ?? []} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bs-gold-tint)', border: '1px solid var(--bs-line)', fontSize: 12.5, color: 'var(--bs-text-muted)', lineHeight: 1.6 }}>
        Gli orari mostrati sono quelli configurati nel profilo utente su GoHighLevel. Le prenotazioni rispettano automaticamente questa disponibilità.
      </div>
    </div>
  )
}
