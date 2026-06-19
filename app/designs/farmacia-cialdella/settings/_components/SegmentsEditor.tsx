'use client'

import { useState, useTransition } from 'react'
import { saveSegmentsAction } from '../_actions'
import type { Segment } from '@/lib/farmacia/segments'

export default function SegmentsEditor({ initial }: { initial: Segment[] }) {
  const [rows, setRows] = useState<Segment[]>(initial)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')

  function update(i: number, patch: Partial<Segment>) {
    setRows((r) => r.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  function add() { setRows((r) => [...r, { name: '', minOrders: 0 }]) }
  function remove(i: number) { setRows((r) => r.filter((_, idx) => idx !== i)) }

  function save() {
    start(async () => {
      setMsg('')
      const res = await saveSegmentsAction(rows)
      setMsg(res?.error ?? 'Salvato. I conteggi si aggiornano automaticamente.')
    })
  }

  return (
    <div>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {rows.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={s.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Nome (es. Oro)"
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--fc-line-strong)' }}
            />
            <label style={{ fontSize: 13, color: 'var(--fc-text-muted)' }}>da</label>
            <input
              type="number"
              min={0}
              value={s.minOrders}
              onChange={(e) => update(i, { minOrders: Number(e.target.value) })}
              style={{ width: 90, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--fc-line-strong)' }}
            />
            <span style={{ fontSize: 13, color: 'var(--fc-text-muted)' }}>ordini</span>
            <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: 'var(--fc-danger)', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <button onClick={add} className="fc-btn-ghost" style={{ border: '1px solid var(--fc-line-strong)', borderRadius: 8, padding: '8px 12px', background: 'transparent', cursor: 'pointer' }}>+ Livello</button>
        <button onClick={save} disabled={pending} className="fc-btn-primary">{pending ? '…' : 'Salva livelli'}</button>
        {msg && <span style={{ fontSize: 13, color: 'var(--fc-text-muted)' }}>{msg}</span>}
      </div>
    </div>
  )
}
