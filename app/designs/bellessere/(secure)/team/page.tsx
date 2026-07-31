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

type Interval = { start: string; end: string }
type EditDay = { open: boolean; intervals: Interval[] }
type EditSchedule = Record<string, EditDay>

function rulesToEdit(rules: ScheduleRule[]): EditSchedule {
  const edit: EditSchedule = {}
  for (const k of DAY_KEYS) edit[k] = { open: false, intervals: [{ start: '09:00', end: '18:00' }] }
  for (const rule of rules) {
    if (rule.type !== 'wday' || !rule.day || !rule.intervals?.length) continue
    edit[rule.day] = { open: true, intervals: rule.intervals.map(i => ({ start: i.from, end: i.to })) }
  }
  return edit
}

function editToRules(edit: EditSchedule): ScheduleRule[] {
  return DAY_KEYS
    .filter(k => edit[k]?.open && edit[k].intervals.length > 0)
    .map(k => ({ type: 'wday' as const, day: k, intervals: edit[k].intervals.map(i => ({ from: i.start, to: i.end })) }))
}

function UserScheduleEditor({ schedule, onChange, canWrite }: { schedule: EditSchedule; onChange: (s: EditSchedule) => void; canWrite: boolean }) {
  function toggle(key: string) {
    onChange({ ...schedule, [key]: { ...schedule[key], open: !schedule[key]?.open } })
  }
  function setTime(key: string, idx: number, field: 'start' | 'end', val: string) {
    const day = schedule[key]
    const intervals = day.intervals.map((iv, i) => i === idx ? { ...iv, [field]: val } : iv)
    onChange({ ...schedule, [key]: { ...day, intervals } })
  }
  function addInterval(key: string) {
    const day = schedule[key]
    // Sensible split default: afternoon shift after the morning one.
    onChange({ ...schedule, [key]: { ...day, intervals: [...day.intervals, { start: '15:00', end: '19:00' }] } })
  }
  function removeInterval(key: string, idx: number) {
    const day = schedule[key]
    onChange({ ...schedule, [key]: { ...day, intervals: day.intervals.filter((_, i) => i !== idx) } })
  }

  const timeStyle = { border: '1.5px solid var(--bs-line)', borderRadius: 8, padding: '4px 8px', fontSize: 13, fontFamily: 'inherit', color: 'var(--bs-text)' } as const

  return (
    <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {DAY_KEYS.map(key => {
        const day = schedule[key] ?? { open: false, intervals: [{ start: '09:00', end: '18:00' }] }
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <button onClick={() => canWrite && toggle(key)} disabled={!canWrite} style={{
              width: 36, height: 20, borderRadius: 10, border: 'none', cursor: canWrite ? 'pointer' : 'default', flexShrink: 0, marginTop: 4,
              background: day.open ? 'var(--bs-black)' : 'var(--bs-line)', position: 'relative', transition: 'background 0.2s',
            }}>
              <span style={{
                position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%', background: 'white',
                transition: 'left 0.2s', left: day.open ? 18 : 2,
              }} />
            </button>
            <span style={{ width: 34, fontSize: 13, fontWeight: 700, marginTop: 6, color: day.open ? 'var(--bs-text)' : 'var(--bs-text-faint)' }}>
              {DAY_LABELS_IT[key]}
            </span>
            {day.open ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {day.intervals.map((iv, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="time" value={iv.start} disabled={!canWrite} onChange={e => setTime(key, idx, 'start', e.target.value)} style={timeStyle} />
                    <span style={{ color: 'var(--bs-text-faint)', fontSize: 12 }}>→</span>
                    <input type="time" value={iv.end} disabled={!canWrite} onChange={e => setTime(key, idx, 'end', e.target.value)} style={timeStyle} />
                    {canWrite && idx > 0 && (
                      <button onClick={() => removeInterval(key, idx)} title="Rimuovi fascia"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bs-text-faint)', fontSize: 15, padding: '0 4px' }}>×</button>
                    )}
                    {canWrite && idx === day.intervals.length - 1 && day.intervals.length < 3 && (
                      <button onClick={() => addInterval(key)}
                        style={{ background: 'none', border: '1px dashed var(--bs-line)', borderRadius: 7, cursor: 'pointer', color: 'var(--bs-text-muted)', fontSize: 11.5, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                        + Pausa
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 12.5, color: 'var(--bs-text-faint)', marginTop: 6 }}>Chiuso</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function defaultEdit(): EditSchedule {
  const e: EditSchedule = {}
  for (const k of DAY_KEYS) e[k] = { open: false, intervals: [{ start: '09:00', end: '18:00' }] }
  return e
}
const DEFAULT_EDIT: EditSchedule = defaultEdit()

interface Absence { id: string; userId: string | null; title: string | null; startTime: string; endTime: string }

function fmtAbsence(a: Absence): string {
  const s = new Date(a.startTime); const e = new Date(a.endTime)
  const fmtDay = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Rome' })
  const isoDay = (d: Date) => new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Rome' }).format(d)
  if (isoDay(s) !== isoDay(e)) {
    return `${fmtDay(s)} → ${fmtDay(e)} — giornata intera`
  }
  const sh = s.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
  const eh = e.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
  const wholeDay = sh === '00:00' && (eh === '23:59' || eh === '00:00')
  return wholeDay ? `${fmtDay(s)} — giornata intera` : `${fmtDay(s)} · ${sh}–${eh}`
}

function AbsenceSection({ userId, canWrite, absences, onAdd, onDelete }: {
  userId: string
  canWrite: boolean
  absences: Absence[]
  onAdd: (date: string, endDate?: string, from?: string, to?: string) => Promise<boolean>
  onDelete: (eventId: string) => void
}) {
  const [date, setDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [partial, setPartial] = useState(false)
  const [from, setFrom] = useState('09:00')
  const [to, setTo] = useState('13:00')
  const [saving, setSaving] = useState(false)

  // Time ranges only make sense for a single day.
  const multiDay = !!endDate && endDate !== date

  const upcoming = absences.filter(a => new Date(a.endTime).getTime() > Date.now())
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  if (!canWrite && upcoming.length === 0) return null

  async function submit() {
    if (!date) return
    setSaving(true)
    const ok = await onAdd(
      date,
      multiDay ? endDate : undefined,
      partial && !multiDay ? from : undefined,
      partial && !multiDay ? to : undefined,
    )
    setSaving(false)
    if (ok) { setDate(''); setEndDate(''); setPartial(false) }
  }

  const timeStyle = { border: '1.5px solid var(--bs-line)', borderRadius: 8, padding: '4px 8px', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--bs-text)' } as const

  return (
    <div style={{ padding: '12px 20px', borderTop: '1px solid var(--bs-line)' }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--bs-text-muted)', marginBottom: 8 }}>Assenze</div>
      {upcoming.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--bs-text-faint)', marginBottom: canWrite ? 10 : 0 }}>Nessuna assenza programmata</div>}
      {upcoming.map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--bs-gold)', flexShrink: 0 }} />
          <span>{fmtAbsence(a)}</span>
          {canWrite && (
            <button onClick={() => onDelete(a.id)} title="Annulla assenza"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bs-text-faint)', fontSize: 14, padding: '0 4px' }}>×</button>
          )}
        </div>
      ))}
      {canWrite && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--bs-text-muted)' }}>Dal</span>
          <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} style={timeStyle} />
          <span style={{ fontSize: 12.5, color: 'var(--bs-text-muted)' }}>al</span>
          <input type="date" value={endDate} min={date || new Date().toISOString().slice(0, 10)} onChange={e => setEndDate(e.target.value)} style={timeStyle} />
          {!multiDay && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--bs-text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={partial} onChange={e => setPartial(e.target.checked)} />
              Solo una fascia
            </label>
          )}
          {partial && !multiDay && (
            <>
              <input type="time" value={from} onChange={e => setFrom(e.target.value)} style={timeStyle} />
              <span style={{ color: 'var(--bs-text-faint)', fontSize: 12 }}>→</span>
              <input type="time" value={to} onChange={e => setTo(e.target.value)} style={timeStyle} />
            </>
          )}
          <button className="bs-btn-ghost" onClick={submit} disabled={!date || saving} style={{ fontSize: 12.5 }}>
            {saving ? 'Salvataggio…' : 'Aggiungi assenza'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function TeamPage() {
  const [users, setUsers] = useState<GhlUser[]>([])
  const [scheduleMap, setScheduleMap] = useState<Record<string, UserSchedule>>({})
  const [edits, setEdits] = useState<Record<string, EditSchedule>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [savedMsg, setSavedMsg] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ── Team member add/remove ──────────────────────────────────────────────
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberForm, setMemberForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [addingMember, setAddingMember] = useState(false)
  const [removingMember, setRemovingMember] = useState<Record<string, boolean>>({})
  const [canWrite, setCanWrite] = useState(true)
  const [absences, setAbsences] = useState<Record<string, Absence[]>>({})

  function loadTeam(initial = false) {
    return Promise.all([
      fetch('/api/bellessere/services').then(r => r.json()),
      fetch('/api/bellessere/user-availability').then(r => r.json()),
    ]).then(([svc, avail]) => {
      const fetchedUsers: GhlUser[] = svc.users ?? []
      const map: Record<string, UserSchedule> = avail.scheduleMap ?? {}
      setCanWrite(svc.canWrite !== false)
      setUsers(fetchedUsers)
      setScheduleMap(map)
      setEdits(prev => {
        const next = initial ? {} : { ...prev }
        for (const u of fetchedUsers) if (!next[u.id]) next[u.id] = map[u.id] ? rulesToEdit(map[u.id].rules) : { ...DEFAULT_EDIT }
        return next
      })
    })
  }

  const [refreshing, setRefreshing] = useState(false)

  // Pull the latest roster from GHL, then reload the cache-backed view
  function syncRoster() {
    setRefreshing(true)
    return fetch('/api/bellessere/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'users' }),
    }).then(() => loadTeam()).catch(() => {}).finally(() => setRefreshing(false))
  }

  function loadAbsences() {
    return fetch('/api/bellessere/absences').then(r => r.json()).then(d => {
      const byUser: Record<string, Absence[]> = {}
      for (const a of (d.absences ?? []) as Absence[]) {
        if (!a.userId) continue
        ;(byUser[a.userId] ??= []).push(a)
      }
      setAbsences(byUser)
    }).catch(() => {})
  }

  async function addAbsence(userId: string, date: string, endDate?: string, from?: string, to?: string) {
    const res = await fetch('/api/bellessere/absences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, date, endDate, from, to }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Errore durante il salvataggio dell\'assenza')
      return false
    }
    await loadAbsences()
    return true
  }

  async function deleteAbsence(userId: string, eventId: string) {
    const res = await fetch('/api/bellessere/absences', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Errore durante l\'eliminazione dell\'assenza')
      return
    }
    setAbsences(p => ({ ...p, [userId]: (p[userId] ?? []).filter(a => a.id !== eventId) }))
  }

  useEffect(() => {
    loadTeam(true)
      .then(() => syncRoster()) // catch members added directly in GHL
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
    loadAbsences()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    setAddingMember(true); setError('')
    try {
      const res = await fetch('/api/bellessere/team', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberForm),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error ?? 'Errore durante l\'aggiunta del membro'); return }
      setShowAddMember(false)
      setMemberForm({ firstName: '', lastName: '', email: '', phone: '' })
      await loadTeam()
    } catch (err) { setError(err instanceof Error ? err.message : 'Errore di rete') }
    finally { setAddingMember(false) }
  }

  async function removeMember(u: GhlUser) {
    if (!confirm(`Rimuovere ${u.name} dal team? L'accesso GHL dell'utente verrà eliminato.`)) return
    setRemovingMember(p => ({ ...p, [u.id]: true })); setError('')
    try {
      const res = await fetch('/api/bellessere/team', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error ?? 'Errore durante la rimozione'); return }
      setUsers(prev => prev.filter(x => x.id !== u.id))
    } catch (err) { setError(err instanceof Error ? err.message : 'Errore di rete') }
    finally { setRemovingMember(p => ({ ...p, [u.id]: false })) }
  }

  async function save(u: GhlUser) {
    const edit = edits[u.id]
    if (!edit) return
    setSaving(p => ({ ...p, [u.id]: true }))
    setSavedMsg(p => ({ ...p, [u.id]: '' }))
    setError('')

    const sched = scheduleMap[u.id]
    // Preserve any non-weekday rules (e.g. date-specific overrides set in GHL)
    // instead of erasing them on every save.
    const extraRules = (sched?.rules ?? []).filter(r => r.type !== 'wday')
    const rules = [...editToRules(edit), ...extraRules]
    let res: Response

    if (sched) {
      res = await fetch('/api/bellessere/user-availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: sched.scheduleId, rules, timezone: sched.timezone }),
      })
    } else {
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
    <div className="bs-page-stack">
      <div className="bs-page-header">
        <div className="bs-page-header-start">
          <div className="bs-page-eyebrow">Gestione</div>
          <h1 className="bs-page-title">Team</h1>
          <div className="bs-page-subtitle">Aggiungi o rimuovi operatori e imposta i loro orari di lavoro.</div>
        </div>
        <div className="bs-page-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="bs-btn-ghost" onClick={syncRoster} disabled={refreshing} style={{ fontSize: 13 }}>
            {refreshing ? 'Aggiornamento...' : 'Aggiorna'}
          </button>
          {canWrite && (
          <button className="bs-btn-primary" onClick={() => setShowAddMember(v => !v)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Aggiungi membro
          </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: 9, fontSize: 13 }}>
          {error}
        </div>
      )}

      {showAddMember && (
        <form onSubmit={addMember} className="bs-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="bs-field-label">Nome *</label>
              <input className="bs-input" value={memberForm.firstName} onChange={e => setMemberForm(p => ({ ...p, firstName: e.target.value }))} required />
            </div>
            <div>
              <label className="bs-field-label">Cognome *</label>
              <input className="bs-input" value={memberForm.lastName} onChange={e => setMemberForm(p => ({ ...p, lastName: e.target.value }))} required />
            </div>
            <div>
              <label className="bs-field-label">Email *</label>
              <input className="bs-input" type="email" value={memberForm.email} onChange={e => setMemberForm(p => ({ ...p, email: e.target.value }))} required />
            </div>
            <div>
              <label className="bs-field-label">Telefono</label>
              <input className="bs-input" value={memberForm.phone} onChange={e => setMemberForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="bs-btn-ghost" onClick={() => setShowAddMember(false)}>Annulla</button>
            <button type="submit" className="bs-btn-primary" disabled={addingMember}>{addingMember ? 'Creazione...' : 'Crea membro'}</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--bs-text-faint)' }}>Riceverà un invito via email da GoHighLevel per impostare la password.</div>
        </form>
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
                    {canWrite && hasSched && (
                      <button
                        onClick={() => deleteSchedule(u.id)}
                        disabled={saving[u.id]}
                        title="Elimina schedule"
                        style={{ background: 'none', border: '1.5px solid var(--bs-line)', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', color: '#DC2626', fontSize: 14, lineHeight: 1 }}
                      >
                        🗑
                      </button>
                    )}
                    {canWrite && <>
                    <button
                      className="bs-btn-primary"
                      style={{ fontSize: 13 }}
                      disabled={saving[u.id]}
                      onClick={() => save(u)}
                    >
                      {saving[u.id] ? 'Salvataggio...' : hasSched ? 'Salva orari' : 'Imposta orari'}
                    </button>
                    <button
                      onClick={() => removeMember(u)}
                      disabled={removingMember[u.id]}
                      title="Rimuovi membro dal team"
                      style={{ background: 'none', border: '1.5px solid var(--bs-line)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'var(--bs-text-muted)', fontSize: 12.5, lineHeight: 1 }}
                    >
                      {removingMember[u.id] ? '...' : 'Rimuovi'}
                    </button>
                    </>}
                  </div>
                </div>
                <UserScheduleEditor
                  schedule={edit ?? DEFAULT_EDIT}
                  onChange={s => setEdits(p => ({ ...p, [u.id]: s }))}
                  canWrite={canWrite}
                />
                <AbsenceSection
                  userId={u.id}
                  canWrite={canWrite}
                  absences={absences[u.id] ?? []}
                  onAdd={(date, endDate, from, to) => addAbsence(u.id, date, endDate, from, to)}
                  onDelete={id => deleteAbsence(u.id, id)}
                />
              </div>
            )
          })}
        </div>
      )}

      <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bs-gold-tint)', border: '1px solid var(--bs-line)', fontSize: 12.5, color: 'var(--bs-text-muted)', lineHeight: 1.6 }}>
        Le modifiche agli orari vengono sincronizzate con il calendario e influenzano la disponibilità di prenotazione in tempo reale.
      </div>
    </div>
  )
}
