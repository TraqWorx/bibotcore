'use client'

import { useState, useTransition } from 'react'
import { saveSegmentsAction } from '../_actions'
import type { Segment, MatchMode } from '@/lib/farmacia/segments'

export default function SegmentsEditor({ initial, initialMode }: { initial: Segment[]; initialMode: MatchMode }) {
  const [rows, setRows] = useState<Segment[]>(initial)
  const [mode, setMode] = useState<MatchMode>(initialMode)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')

  function update(i: number, patch: Partial<Segment>) {
    setRows((r) => r.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  function add() { setRows((r) => [...r, { name: '', minOrders: 0, minSpendCents: 0 }]) }
  function remove(i: number) { setRows((r) => r.filter((_, idx) => idx !== i)) }

  function save() {
    start(async () => {
      setMsg('')
      const res = await saveSegmentsAction(rows, mode)
      setMsg(res?.error ?? 'Salvato. I tag livello su GHL si aggiornano in background entro un minuto.')
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 13 }}>
        <span style={{ color: 'var(--fc-text-muted)' }}>Un cliente raggiunge un livello se soddisfa</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as MatchMode)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--fc-line-strong)' }}>
          <option value="any">almeno un requisito</option>
          <option value="all">tutti i requisiti</option>
        </select>
        <span style={{ color: 'var(--fc-text-muted)' }}>(ordini / spesa). Soglia 0 = ignorata.</span>
      </div>

      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {rows.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={s.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Nome (es. Oro)" style={{ flex: 1, minWidth: 120, ...inp }} />
            <label style={lbl}>da</label>
            <input type="number" min={0} value={s.minOrders} onChange={(e) => update(i, { minOrders: Number(e.target.value) })} style={{ width: 80, ...inp }} />
            <span style={lbl}>ordini</span>
            <label style={lbl}>e/o</label>
            <input type="number" min={0} step="0.01" value={(s.minSpendCents ?? 0) / 100} onChange={(e) => update(i, { minSpendCents: Math.round(Number(e.target.value) * 100) })} style={{ width: 90, ...inp }} />
            <span style={lbl}>€ spesi</span>
            <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: 'var(--fc-danger)', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <button onClick={add} style={{ border: '1px solid var(--fc-line-strong)', borderRadius: 8, padding: '8px 12px', background: 'transparent', cursor: 'pointer' }}>+ Livello</button>
        <button onClick={save} disabled={pending} className="fc-btn-primary">{pending ? '…' : 'Salva livelli'}</button>
        {msg && <span style={{ fontSize: 13, color: 'var(--fc-text-muted)' }}>{msg}</span>}
      </div>
    </div>
  )
}

const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--fc-line-strong)', fontSize: 14 }
const lbl: React.CSSProperties = { fontSize: 13, color: 'var(--fc-text-muted)' }
