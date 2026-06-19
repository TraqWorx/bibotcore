'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SyncReviewsButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function sync() {
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/farmacia/reviews/sync', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(data.error ?? `Errore (${res.status})`); return }
      setMsg(`Sincronizzate ${data.count ?? 0} recensioni.`)
      router.refresh()
    } catch {
      setMsg('Errore di rete.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button className="fc-btn-primary" onClick={sync} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Sincronizzazione…' : 'Sincronizza recensioni'}
      </button>
      {msg && <span style={{ fontSize: 13, color: 'var(--fc-text-muted)' }}>{msg}</span>}
    </div>
  )
}
