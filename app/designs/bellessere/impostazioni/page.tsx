'use client'

import { useState, useEffect } from 'react'

interface GhlUser { id: string; name: string; email: string }

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Lunedì' },
  { key: 'tue', label: 'Martedì' },
  { key: 'wed', label: 'Mercoledì' },
  { key: 'thu', label: 'Giovedì' },
  { key: 'fri', label: 'Venerdì' },
  { key: 'sat', label: 'Sabato' },
  { key: 'sun', label: 'Domenica' },
]

const DEFAULT_DAY = { open: false, start: '09:00', end: '18:00' }

type DaySchedule = { open: boolean; start: string; end: string }
type UserSchedule = Record<string, DaySchedule>
type TeamSchedule = Record<string, UserSchedule>

function defaultSchedule(): UserSchedule {
  const s: UserSchedule = {}
  for (const d of DAYS) s[d.key] = { ...DEFAULT_DAY }
  // Mon–Fri open by default
  for (const k of ['mon', 'tue', 'wed', 'thu', 'fri']) s[k] = { open: true, start: '09:00', end: '18:00' }
  return s
}

function UserScheduleEditor({
  user, schedule, onChange,
}: { user: GhlUser; schedule: UserSchedule; onChange: (s: UserSchedule) => void }) {
  function toggleDay(key: string) {
    onChange({ ...schedule, [key]: { ...schedule[key], open: !schedule[key]?.open } })
  }
  function setTime(key: string, field: 'start' | 'end', value: string) {
    onChange({ ...schedule, [key]: { ...schedule[key], [field]: value } })
  }

  return (
    <div>
      <div style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--bs-line)' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: 'var(--bs-gold)', flexShrink: 0 }}>
          {user.name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{user.name}</div>
          <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>{user.email}</div>
        </div>
      </div>
      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {DAYS.map(({ key, label }) => {
          const day = schedule[key] ?? DEFAULT_DAY
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Toggle */}
              <button
                onClick={() => toggleDay(key)}
                style={{
                  width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: day.open ? 'var(--bs-black)' : 'var(--bs-line)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%', background: 'white',
                  transition: 'left 0.2s', left: day.open ? 18 : 2,
                }} />
              </button>
              {/* Day label */}
              <span style={{ width: 90, fontSize: 13, color: day.open ? 'var(--bs-text)' : 'var(--bs-text-faint)', fontWeight: day.open ? 600 : 400 }}>
                {label}
              </span>
              {/* Time inputs */}
              {day.open ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <input
                    type="time"
                    value={day.start}
                    onChange={e => setTime(key, 'start', e.target.value)}
                    style={{ border: '1.5px solid var(--bs-line)', borderRadius: 8, padding: '4px 8px', fontSize: 13, fontFamily: 'inherit', color: 'var(--bs-text)' }}
                  />
                  <span style={{ color: 'var(--bs-text-faint)', fontSize: 12 }}>→</span>
                  <input
                    type="time"
                    value={day.end}
                    onChange={e => setTime(key, 'end', e.target.value)}
                    style={{ border: '1.5px solid var(--bs-line)', borderRadius: 8, padding: '4px 8px', fontSize: 13, fontFamily: 'inherit', color: 'var(--bs-text)' }}
                  />
                </div>
              ) : (
                <span style={{ fontSize: 12.5, color: 'var(--bs-text-faint)' }}>Chiuso</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ImpostazioniPage() {
  const [users, setUsers] = useState<GhlUser[]>([])
  const [teamSchedule, setTeamSchedule] = useState<TeamSchedule>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/bellessere/services').then(r => r.json()),
      fetch('/api/bellessere/settings').then(r => r.json()),
    ]).then(([svc, settings]) => {
      const usrs: GhlUser[] = svc.users ?? []
      setUsers(usrs)
      const saved: TeamSchedule = settings.teamSchedule ?? {}
      // Ensure every user has a schedule
      const full: TeamSchedule = {}
      for (const u of usrs) full[u.id] = saved[u.id] ?? defaultSchedule()
      setTeamSchedule(full)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true); setSavedMsg('')
    const res = await fetch('/api/bellessere/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamSchedule }),
    })
    setSaving(false)
    if (res.ok) {
      setSavedMsg('Salvato')
      setTimeout(() => setSavedMsg(''), 3000)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="bs-page-eyebrow">Bibot</div>
          <h1 className="bs-page-title">Impostazioni</h1>
        </div>
      </div>

      {/* Working hours */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Orari di lavoro</div>
            <div style={{ fontSize: 12.5, color: 'var(--bs-text-muted)', marginTop: 2 }}>
              Definisci i turni settimanali per ogni professionista
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {savedMsg && <span style={{ fontSize: 12.5, color: '#16a34a' }}>{savedMsg}</span>}
            <button className="bs-btn-primary" onClick={save} disabled={saving} style={{ fontSize: 13 }}>
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--bs-text-faint)' }}>Caricamento...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {users.map(u => (
              <div key={u.id} className="bs-card">
                <UserScheduleEditor
                  user={u}
                  schedule={teamSchedule[u.id] ?? defaultSchedule()}
                  onChange={s => setTeamSchedule(prev => ({ ...prev, [u.id]: s }))}
                />
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Team list */}
      <div className="bs-card">
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bs-line)', fontWeight: 700, fontSize: 14 }}>Team ({users.length})</div>
        {users.map((u, idx) => (
          <div key={u.id} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: idx < users.length - 1 ? '1px solid var(--bs-line)' : 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bs-gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: 'var(--bs-gold)', flexShrink: 0 }}>
              {u.name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name}</div>
              <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>{u.email}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, fontSize: 11.5, color: 'var(--bs-text-faint)' }}>
              {DAYS.filter(d => teamSchedule[u.id]?.[d.key]?.open)
                .map(d => d.label.slice(0, 3))
                .join(' · ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
