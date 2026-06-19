'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ImportResult {
  orders?: number
  contactsCreated?: number
  contactsUpdated?: number
  ordersUpserted?: number
  itemsInserted?: number
  conversions?: number
  ordersUnlinked?: number
  error?: string
}

export default function DropZone() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  async function upload(file: File) {
    setBusy(true); setError(''); setResult(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/farmacia/import/orders', { method: 'POST', body })
      const data = (await res.json().catch(() => ({}))) as ImportResult
      if (!res.ok) { setError(data.error ?? `Errore (${res.status})`); return }
      setResult(data)
      router.refresh()
    } catch {
      setError('Errore di rete durante il caricamento.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div
        className="fc-card"
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false)
          const f = e.dataTransfer.files?.[0]
          if (f) upload(f)
        }}
        style={{
          border: `2px dashed ${dragging ? 'var(--fc-blue)' : 'var(--fc-line-strong)'}`,
          background: dragging ? 'var(--fc-blue-soft)' : 'var(--fc-surface)',
          padding: 32, textAlign: 'center', cursor: busy ? 'wait' : 'pointer',
          transition: 'all .15s',
        }}
        onClick={() => !busy && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xlsm,.xlsb"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }}
        />
        <p style={{ fontWeight: 600, color: 'var(--fc-text)' }}>
          {busy ? 'Caricamento e importazione…' : 'Trascina qui il file ordini (ShippyPro / Market Rock)'}
        </p>
        <p style={{ fontSize: 13, color: 'var(--fc-text-muted)', marginTop: 4 }}>
          CSV o Excel · oppure clicca per selezionare
        </p>
      </div>

      {error && (
        <p style={{ color: 'var(--fc-danger)', marginTop: 12, fontSize: 14 }}>{error}</p>
      )}

      {result && (
        <div className="fc-card" style={{ marginTop: 12, padding: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Importazione completata</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, fontSize: 14 }}>
            <Stat label="Ordini" value={result.ordersUpserted} />
            <Stat label="Articoli" value={result.itemsInserted} />
            <Stat label="Clienti nuovi" value={result.contactsCreated} />
            <Stat label="Clienti agg." value={result.contactsUpdated} />
            <Stat label="Conversioni" value={result.conversions} />
            <Stat label="Senza cliente" value={result.ordersUnlinked} />
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fc-text)' }}>{value ?? 0}</div>
      <div style={{ fontSize: 12, color: 'var(--fc-text-muted)' }}>{label}</div>
    </div>
  )
}
