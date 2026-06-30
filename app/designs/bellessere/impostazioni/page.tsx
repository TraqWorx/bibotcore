'use client'

import { useState, useEffect } from 'react'

interface GhlUser { id: string; name: string; email: string }

interface PersonalCalendar {
  calendarId: string
  name: string
  userId: string | null
  openHours: OpenHoursEntry[] | Record<string, unknown>
  timezone: string
}

// GHL openHours format: array of { daysOfTheWeek: number[], hours: [{ openHour, openMinute, closeHour, closeMinute }] }
// daysOfTheWeek: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
interface OpenHoursEntry {
  daysOfTheWeek: number[]
  hours: { openHour: number; openMinute: number; closeHour: number; closeMinute: number }[]
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_IDX: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
const DAY_LABELS_IT: Record<string, string> = {
  sunday: 'Dom', monday: 'Lun', tuesday: 'Mar',
  wednesday: 'Mer', thursday: 'Gio', friday: 'Ven', saturday: 'Sab',
}

type EditDay = { open: boolean; start: string; end: string }
type EditSchedule = Record<string, EditDay>

function fmt(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function ghlToEdit(openHours: OpenHoursEntry[] | Record<string, unknown>): EditSchedule {
  const edit: EditSchedule = {}
  for (const k of DAY_KEYS) edit[k] = { open: false, start: '09:00', end: '18:00' }

  if (!Array.isArray(openHours)) return edit

  for (const entry of openHours) {
    const h = entry.hours?.[0]
    if (!h) continue
    const timeRange = { open: true, start: fmt(h.openHour, h.openMinute ?? 0), end: fmt(h.closeHour, h.closeMinute ?? 0) }
    for (const dayIdx of entry.daysOfTheWeek ?? []) {
      const key = DAY_KEYS[dayIdx]
      if (key) edit[key] = timeRange
    }
  }
  return edit
}

function editToOpenHours(edit: EditSchedule): OpenHoursEntry[] {
  // Group days that share the same time range into one entry
  const groups: Record<string, number[]> = {}
  for (const key of DAY_KEYS) {
    if (!edit[key]?.open) continue
    const groupKey = `${edit[key].start}-${edit[key].end}`
    if (!groups[groupKey]) groups[groupKey] = []
    groups[groupKey].push(DAY_IDX[key])
  }
  return Object.entries(groups).map(([timeKey, days]) => {
    const [start, end] = timeKey.split('-')
    const [oh, om] = start.split(':').map(Number)
    const [ch, cm] = end.split(':').map(Number)
    return {
      daysOfTheWeek: days.sort((a, b) => a - b),
      hours: [{ openHour: oh, openMinute: om, closeHour: ch, closeMinute: cm }],
    }
  })
}

function UserScheduleEditor({ schedule, onChange }: { schedule: EditSchedule; onChange: (s: EditSchedule) => void }) {
  function toggle(key: string) {
    onChange({ ...schedule, [key]: { ...schedule[key], open: !schedule[key]?.open } })
  }
  function setTime(key: string, field: 'start' | 'end', val: string) {
    onChange({ ...schedule, [key]: { ...schedule[key], [field]: val } })
  }

  return (
    <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {DAY_KEYS.map(key => {
        const day = schedule[key] ?? { open: false, start: '09:00', end: '18:00' }
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => toggle(key)} style={{
              width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0,
              background: day.open ? 'var(--bs-black)' : 'var(--bs-line)', position: 'relative', transition: 'background 0.2s',
            }}>
              <span style={{
                position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%', background: 'white',
                transition: 'left 0.2s', left: day.open ? 18 : 2,
              }} />
            </button>
            <span style={{ width: 34, fontSize: 13, fontWeight: 700, color: day.open ? 'var(--bs-text)' : 'var(--bs-text-faint)' }}>
              {DAY_LABELS_IT[key]}
            </span>
            {day.open ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="time" value={day.start} onChange={e => setTime(key, 'start', e.target.value)}
                  style={{ border: '1.5px solid var(--bs-line)', borderRadius: 8, padding: '4px 8px', fontSize: 13, fontFamily: 'inherit', color: 'var(--bs-text)' }} />
                <span style={{ color: 'var(--bs-text-faint)', fontSize: 12 }}>→</span>
                <input type="time" value={day.end} onChange={e => setTime(key, 'end', e.target.value)}
                  style={{ border: '1.5px solid var(--bs-line)', borderRadius: 8, padding: '4px 8px', fontSize: 13, fontFamily: 'inherit', color: 'var(--bs-text)' }} />
              </div>
            ) : (
              <span style={{ fontSize: 12.5, color: 'var(--bs-text-faint)' }}>Chiuso</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function ImpostazioniPage() {
  const [users, setUsers] = useState<GhlUser[]>([])
  // Map userId → { calendarId, editSchedule }
  const [calMap, setCalMap] = useState<Record<string, { calendarId: string; edit: EditSchedule }>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [savedMsg, setSavedMsg] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/bellessere/services').then(r => r.json()),
      fetch('/api/bellessere/user-availability').then(r => r.json()),
    ]).then(([svc, avail]) => {
      setUsers(svc.users ?? [])
      const personal: PersonalCalendar[] = avail.personal ?? []
      const map: Record<string, { calendarId: string; edit: EditSchedule }> = {}
      for (const p of personal) {
        if (p.userId) {
          map[p.userId] = { calendarId: p.calendarId, edit: ghlToEdit(p.openHours as OpenHoursEntry[]) }
        }
      }
      setCalMap(map)
    }).catch(e => setError(String(e))).finally(() => setLoading(false))
  }, [])

  async function save(userId: string) {
    const entry = calMap[userId]
    if (!entry) return
    setSaving(p => ({ ...p, [userId]: true }))
    setSavedMsg(p => ({ ...p, [userId]: '' }))
    setError('')
    const res = await fetch('/api/bellessere/user-availability', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarId: entry.calendarId, openHours: editToOpenHours(entry.edit) }),
    })
    setSaving(p => ({ ...p, [userId]: false }))
    if (res.ok) {
      setSavedMsg(p => ({ ...p, [userId]: 'Salvato su GHL' }))
      setTimeout(() => setSavedMsg(p => ({ ...p, [userId]: '' })), 3000)
    } else {
      const d = await res.json()
      setError(d.message ?? d.error ?? 'Errore durante il salvataggio')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <div className="bs-page-eyebrow">Bibot</div>
        <h1 className="bs-page-title">Impostazioni</h1>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: 9, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--bs-text-faint)' }}>Caricamento...</div>
      ) : users.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--bs-text-faint)' }}>Nessun membro del team trovato</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {users.map(u => {
            const entry = calMap[u.id]
            return (
              <div key={u.id} className="bs-card">
                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--bs-line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: 'var(--bs-gold)', flexShrink: 0 }}>
                      {u.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>{u.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {savedMsg[u.id] && <span style={{ fontSize: 12.5, color: '#16a34a' }}>{savedMsg[u.id]}</span>}
                    {!entry && <span style={{ fontSize: 11.5, color: 'var(--bs-text-faint)', fontStyle: 'italic' }}>nessun calendario personale GHL</span>}
                    <button
                      className="bs-btn-primary"
                      style={{ fontSize: 13 }}
                      disabled={saving[u.id] || !entry}
                      onClick={() => save(u.id)}
                    >
                      {saving[u.id] ? 'Salvataggio...' : 'Salva su GHL'}
                    </button>
                  </div>
                </div>
                {entry ? (
                  <UserScheduleEditor
                    schedule={entry.edit}
                    onChange={s => setCalMap(p => ({ ...p, [u.id]: { ...p[u.id], edit: s } }))}
                  />
                ) : (
                  <div style={{ padding: '16px 20px', fontSize: 12.5, color: 'var(--bs-text-faint)' }}>
                    Crea un calendario personale per questo utente su GHL per gestirne gli orari.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bs-gold-tint)', border: '1px solid var(--bs-line)', fontSize: 12.5, color: 'var(--bs-text-muted)', lineHeight: 1.6 }}>
        Le modifiche vengono salvate direttamente su GoHighLevel e influenzano la disponibilità di prenotazione in tempo reale.
      </div>
    </div>
  )
}
