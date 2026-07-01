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

const DEFAULT_EDIT: EditSchedule = {
  sunday:    { open: false, start: '09:00', end: '18:00' },
  monday:    { open: false, start: '09:00', end: '18:00' },
  tuesday:   { open: false, start: '09:00', end: '18:00' },
  wednesday: { open: false, start: '09:00', end: '18:00' },
  thursday:  { open: false, start: '09:00', end: '18:00' },
  friday:    { open: false, start: '09:00', end: '18:00' },
  saturday:  { open: false, start: '09:00', end: '18:00' },
}

export default function ImpostazioniPage() {
  const [users, setUsers] = useState<GhlUser[]>([])
  const [scheduleMap, setScheduleMap] = useState<Record<string, UserSchedule>>({})
  const [edits, setEdits] = useState<Record<string, EditSchedule>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [savedMsg, setSavedMsg] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reminderTemplate, setReminderTemplate] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('bellessere_reminder_template') ?? ''
    return ''
  })
  const [reminderSaved, setReminderSaved] = useState(false)

  function saveReminderTemplate() {
    localStorage.setItem('bellessere_reminder_template', reminderTemplate)
    setReminderSaved(true)
    setTimeout(() => setReminderSaved(false), 2000)
  }

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
        initialEdits[u.id] = map[u.id] ? rulesToEdit(map[u.id].rules) : { ...DEFAULT_EDIT }
      }
      setEdits(initialEdits)
    }).catch(e => setError(String(e))).finally(() => setLoading(false))
  }, [])

  async function save(u: GhlUser) {
    const edit = edits[u.id]
    if (!edit) return
    setSaving(p => ({ ...p, [u.id]: true }))
    setSavedMsg(p => ({ ...p, [u.id]: '' }))
    setError('')

    const sched = scheduleMap[u.id]
    const rules = editToRules(edit)
    let res: Response

    if (sched) {
      // Update existing schedule
      res = await fetch('/api/bellessere/user-availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: sched.scheduleId, rules, timezone: sched.timezone }),
      })
    } else {
      // Create new schedule
      res = await fetch('/api/bellessere/user-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id, userName: u.name, rules, timezone: 'Europe/Rome' }),
      })
      if (res.ok) {
        const created = await res.json()
        const newSchedId = created.schedule?.id ?? created.id
        if (newSchedId) {
          setScheduleMap(p => ({ ...p, [u.id]: { scheduleId: newSchedId, rules, timezone: 'Europe/Rome' } }))
        }
      }
    }

    setSaving(p => ({ ...p, [u.id]: false }))
    if (res.ok) {
      setSavedMsg(p => ({ ...p, [u.id]: 'Salvato' }))
      setTimeout(() => setSavedMsg(p => ({ ...p, [u.id]: '' })), 3000)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.message ?? d.error ?? 'Errore durante il salvataggio')
    }
  }

  async function deleteSchedule(userId: string) {
    const sched = scheduleMap[userId]
    if (!sched) return
    if (!confirm('Eliminare lo schedule di disponibilità su GHL?')) return
    setSaving(p => ({ ...p, [userId]: true }))
    setError('')
    const res = await fetch('/api/bellessere/user-availability', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId: sched.scheduleId }),
    })
    setSaving(p => ({ ...p, [userId]: false }))
    if (res.ok) {
      setScheduleMap(p => { const n = { ...p }; delete n[userId]; return n })
      setEdits(p => ({ ...p, [userId]: { ...DEFAULT_EDIT } }))
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.message ?? d.error ?? 'Errore durante l\'eliminazione')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {savedMsg[u.id] && <span style={{ fontSize: 12.5, color: '#16a34a' }}>{savedMsg[u.id]}</span>}
                    {!hasSched && <span style={{ fontSize: 11.5, color: 'var(--bs-text-faint)', fontStyle: 'italic' }}>nessuno schedule</span>}
                    {hasSched && (
                      <button
                        onClick={() => deleteSchedule(u.id)}
                        disabled={saving[u.id]}
                        title="Elimina schedule"
                        style={{ background: 'none', border: '1.5px solid var(--bs-line)', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', color: '#DC2626', fontSize: 14, lineHeight: 1 }}
                      >
                        🗑
                      </button>
                    )}
                    <button
                      className="bs-btn-primary"
                      style={{ fontSize: 13 }}
                      disabled={saving[u.id]}
                      onClick={() => save(u)}
                    >
                      {saving[u.id] ? 'Salvataggio...' : hasSched ? 'Salva' : 'Aggiungi'}
                    </button>
                  </div>
                </div>
                <UserScheduleEditor
                  schedule={edit ?? DEFAULT_EDIT}
                  onChange={s => setEdits(p => ({ ...p, [u.id]: s }))}
                />
              </div>
            )
          })}
        </div>
      )}

      <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bs-gold-tint)', border: '1px solid var(--bs-line)', fontSize: 12.5, color: 'var(--bs-text-muted)', lineHeight: 1.6 }}>
        Le modifiche agli orari vengono sincronizzate con il calendario e influenzano la disponibilità di prenotazione in tempo reale.
      </div>

      {/* Reminder template */}
      <div className="bs-card" style={{ padding: '22px 24px' }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Testo del reminder</div>
        <div style={{ fontSize: 13, color: 'var(--bs-text-muted)', marginBottom: 14 }}>
          Testo predefinito per i reminder SMS. Usa <code style={{ background: 'var(--bs-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{nome}}'}</code>, <code style={{ background: 'var(--bs-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{servizio}}'}</code>, <code style={{ background: 'var(--bs-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{data}}'}</code>, <code style={{ background: 'var(--bs-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{ora}}'}</code> come segnaposto.
        </div>
        <textarea
          className="bs-input"
          rows={4}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13.5 }}
          placeholder={`Ciao {{nome}}, ti ricordiamo il tuo appuntamento per {{servizio}} il {{data}} alle {{ora}}. Per info chiama il salone. Grazie!`}
          value={reminderTemplate}
          onChange={e => setReminderTemplate(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <button className="bs-btn-primary" onClick={saveReminderTemplate}>
            {reminderSaved ? 'Salvato ✓' : 'Salva'}
          </button>
          {reminderTemplate && (
            <button className="bs-btn-ghost" onClick={() => { setReminderTemplate(''); localStorage.removeItem('bellessere_reminder_template') }} style={{ fontSize: 12.5 }}>
              Ripristina default
            </button>
          )}
        </div>
      </div>

      {/* Stripe */}
      <div className="bs-card" style={{ padding: '22px 24px', display: 'flex', alignItems: 'flex-start', gap: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#635BFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Pagamenti Stripe</div>
          <div style={{ fontSize: 13, color: 'var(--bs-text-muted)', lineHeight: 1.65, marginBottom: 16 }}>
            Per accettare pagamenti online e gestire le transazioni, collega il tuo account Stripe direttamente da GoHighLevel.<br />
            Vai su <strong>GHL → Impostazioni → Pagamenti → Integrazioni</strong> e clicca <strong>Connect with Stripe</strong>. Una volta collegato, i pagamenti per gli appuntamenti vengono gestiti automaticamente.
          </div>
          <a
            href="https://app.gohighlevel.com/settings/payments/integrations"
            target="_blank"
            rel="noopener noreferrer"
            className="bs-btn-primary"
            style={{ display: 'inline-flex', textDecoration: 'none', background: '#635BFF' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Apri impostazioni pagamenti in GHL
          </a>
        </div>
      </div>
    </div>
  )
}
