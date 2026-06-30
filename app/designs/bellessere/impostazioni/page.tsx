'use client'

import { useState, useEffect } from 'react'

interface GhlUser { id: string; name: string; email: string }

interface ScheduleRule {
  type: 'wday' | 'date'
  day?: string
  date?: string
  intervals: { from: string; to: string }[]
}

interface UserSchedule {
  scheduleId: string
  rules: ScheduleRule[]
  timezone: string
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_LABELS_IT: Record<string, string> = {
  sunday: 'Dom', monday: 'Lun', tuesday: 'Mar',
  wednesday: 'Mer', thursday: 'Gio', friday: 'Ven', saturday: 'Sab',
}

type EditDay = { open: boolean; start: string; end: string }
type EditSchedule = Record<string, EditDay>

function rulesToEdit(rules: ScheduleRule[]): EditSchedule {
  const edit: EditSchedule = {}
  for (const k of DAY_KEYS) edit[k] = { open: false, start: '09:00', end: '18:00' }
  for (const rule of rules) {
    if (rule.type !== 'wday' || !rule.day || !rule.intervals?.[0]) continue
    edit[rule.day] = { open: true, start: rule.intervals[0].from, end: rule.intervals[0].to }
  }
  return edit
}

function editToRules(edit: EditSchedule): ScheduleRule[] {
  return DAY_KEYS
    .filter(k => edit[k]?.open)
    .map(k => ({ type: 'wday' as const, day: k, intervals: [{ from: edit[k].start, to: edit[k].end }] }))
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
  const [scheduleMap, setScheduleMap] = useState<Record<string, UserSchedule>>({})
  const [edits, setEdits] = useState<Record<string, EditSchedule>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [savedMsg, setSavedMsg] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/bellessere/services').then(r => r.json()),
      fetch('/api/bellessere/user-availability').then(r => r.json()),
    ]).then(([svc, avail]) => {
      const fetchedUsers: GhlUser[] = svc.users ?? []
      const map: Record<string, UserSchedule> = avail.scheduleMap ?? {}
      setUsers(fetchedUsers)
      setScheduleMap(map)
      const initialEdits: Record<string, EditSchedule> = {}
      for (const u of fetchedUsers) {
        if (map[u.id]) initialEdits[u.id] = rulesToEdit(map[u.id].rules)
      }
      setEdits(initialEdits)
    }).catch(e => setError(String(e))).finally(() => setLoading(false))
  }, [])

  async function save(userId: string) {
    const sched = scheduleMap[userId]
    if (!sched) return
    const edit = edits[userId]
    if (!edit) return
    setSaving(p => ({ ...p, [userId]: true }))
    setSavedMsg(p => ({ ...p, [userId]: '' }))
    setError('')
    const res = await fetch('/api/bellessere/user-availability', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId: sched.scheduleId, rules: editToRules(edit), timezone: sched.timezone }),
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
            const hasSched = !!scheduleMap[u.id]
            const edit = edits[u.id]
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
                    {!hasSched && <span style={{ fontSize: 11.5, color: 'var(--bs-text-faint)', fontStyle: 'italic' }}>nessuno schedule GHL</span>}
                    <button
                      className="bs-btn-primary"
                      style={{ fontSize: 13 }}
                      disabled={saving[u.id] || !hasSched}
                      onClick={() => save(u.id)}
                    >
                      {saving[u.id] ? 'Salvataggio...' : 'Salva su GHL'}
                    </button>
                  </div>
                </div>
                {hasSched && edit ? (
                  <UserScheduleEditor
                    schedule={edit}
                    onChange={s => setEdits(p => ({ ...p, [u.id]: s }))}
                  />
                ) : (
                  <div style={{ padding: '16px 20px', fontSize: 12.5, color: 'var(--bs-text-faint)' }}>
                    Nessuno schedule trovato su GHL per questo utente.
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
