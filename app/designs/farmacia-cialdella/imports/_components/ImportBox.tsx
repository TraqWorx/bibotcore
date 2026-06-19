'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Result {
  imported?: number
  created?: number
  updated?: number
  discarded?: number
  ordersUpserted?: number
  conversions?: number
  reasons?: Record<string, number>
  error?: string
}

export default function ImportBox({ label, hint, endpoint, tone }: { label: string; hint: string; endpoint: string; tone: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<Result | null>(null)

  async function upload(file: File) {
    setBusy(true); setRes(null)
    try {
      const body = new FormData(); body.append('file', file)
      const r = await fetch(endpoint, { method: 'POST', body })
      const data = (await r.json().catch(() => ({}))) as Result
      setRes(r.ok ? data : { error: data.error ?? `Errore (${r.status})` })
      if (r.ok) router.refresh()
    } catch { setRes({ error: 'Errore di rete' }) } finally { setBusy(false) }
  }

  return (
    <div className="fc-card" style={{ padding: 16, borderTop: `3px solid var(--fc-blue)` }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--fc-text-muted)', marginBottom: 12 }}>{hint}</div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f) }}
        onClick={() => !busy && inputRef.current?.click()}
        style={{ border: `2px dashed ${drag ? 'var(--fc-blue)' : 'var(--fc-line-strong)'}`, background: drag ? 'var(--fc-blue-soft)' : 'transparent', borderRadius: 10, padding: 20, textAlign: 'center', cursor: busy ? 'wait' : 'pointer', fontSize: 13 }}
      >
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xlsm,.xlsb" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }} />
        {busy ? 'Importazione…' : 'Trascina o clicca per caricare'}
      </div>
      {res?.error && <p style={{ color: 'var(--fc-danger)', fontSize: 13, marginTop: 8 }}>{res.error}</p>}
      {res && !res.error && (
        <div style={{ fontSize: 13, marginTop: 8, color: 'var(--fc-text)' }}>
          ✓ {res.imported ?? res.ordersUpserted ?? 0} importati
          {res.discarded ? ` · ${res.discarded} scartati` : ''}
          {res.conversions ? ` · ${res.conversions} conversioni` : ''}
          {res.reasons && Object.keys(res.reasons).length > 0 && (
            <div style={{ color: 'var(--fc-text-muted)', fontSize: 12, marginTop: 2 }}>
              {Object.entries(res.reasons).map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
