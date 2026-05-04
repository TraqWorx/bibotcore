'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createAdmin } from '../_actions'

export default function AddAdminPanel() {
  const [open, setOpen] = useState<'manual' | 'upload' | null>(null)

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => setOpen(open === 'manual' ? null : 'manual')} className="ap-btn ap-btn-primary">
        ＋ Nuovo amministratore
      </button>
      <button onClick={() => setOpen(open === 'upload' ? null : 'upload')} className="ap-btn ap-btn-ghost">
        📥 Carica file
      </button>
      {open === 'manual' && <ManualForm onClose={() => setOpen(null)} />}
      {open === 'upload' && <UploadDrop onClose={() => setOpen(null)} />}
    </div>
  )
}

function ManualForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const compenso = fd.get('compensoPerPod') as string
    startTransition(async () => {
      const res = await createAdmin({
        name: fd.get('name') as string,
        codiceAmministratore: fd.get('codiceAmministratore') as string,
        email: (fd.get('email') as string) || undefined,
        phone: (fd.get('phone') as string) || undefined,
        codiceFiscale: (fd.get('codiceFiscale') as string) || undefined,
        partitaIva: (fd.get('partitaIva') as string) || undefined,
        address: (fd.get('address') as string) || undefined,
        city: (fd.get('city') as string) || undefined,
        province: (fd.get('province') as string) || undefined,
        compensoPerPod: compenso ? Number(compenso.replace(',', '.')) : undefined,
        firstPaymentAt: (fd.get('firstPaymentAt') as string) || undefined,
      })
      if (res.error) setError(res.error)
      else { onClose(); router.refresh() }
    })
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Nuovo amministratore</h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field name="name" label="Nome / Ragione sociale *" required />
          <Field name="codiceAmministratore" label="Codice amministratore *" required mono />
          <Field name="email" label="Email" type="email" />
          <Field name="phone" label="Telefono" type="tel" />
          <Field name="codiceFiscale" label="Codice fiscale" mono />
          <Field name="partitaIva" label="Partita IVA" mono />
          <Field name="address" label="Indirizzo fatturazione" full />
          <Field name="city" label="Città" />
          <Field name="province" label="Provincia" />
          <Field name="compensoPerPod" label="Compenso per POD (€)" type="text" inputMode="decimal" />
          <Field name="firstPaymentAt" label="Data 1° pagamento" type="date" full />
        </div>
        {error && <div style={{ color: 'var(--ap-danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onClose} className="ap-btn ap-btn-ghost">Annulla</button>
          <button type="submit" disabled={pending} className="ap-btn ap-btn-primary">{pending ? 'Salvo…' : 'Crea amministratore'}</button>
        </div>
      </form>
    </div>
  )
}

interface FieldProps {
  name: string
  label: string
  required?: boolean
  type?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
  mono?: boolean
  full?: boolean
}

function Field({ name, label, required, type = 'text', inputMode, mono, full }: FieldProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: full ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        inputMode={inputMode}
        className="ap-input"
        style={{ height: 36, fontFamily: mono ? 'monospace' : undefined }}
      />
    </label>
  )
}

function UploadDrop({ onClose }: { onClose: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; phase: string }>({ done: 0, total: 0, phase: '' })
  const [summary, setSummary] = useState<{ created?: number; updated?: number; skipped?: number; durationMs?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handle(file: File) {
    setBusy(true); setError(null); setSummary(null); setProgress({ done: 0, total: 0, phase: 'Caricamento…' })
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await fetch('/api/apulia/import/admins', { method: 'POST', body: fd })
      if (!r.ok || !r.body) { setError(`HTTP ${r.status}: ${await r.text()}`); setBusy(false); return }
      const reader = r.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const evt = JSON.parse(line)
            if (evt.type === 'start') setProgress({ done: 0, total: evt.total, phase: 'Elaborazione…' })
            else if (evt.type === 'progress') setProgress({ done: evt.done, total: evt.total, phase: 'Elaborazione…' })
            else if (evt.type === 'done') setSummary(evt)
            else if (evt.type === 'error') setError(evt.message)
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    } finally {
      setBusy(false)
      router.refresh()
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalStyle, maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Carica amministratori da file</h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ap-text-muted)', marginBottom: 14 }}>
          File CSV con colonne: <code>Fornitura : Cliente : Amministratore condominio</code> (nome, obbligatorio),{' '}
          <code>Fornitura : Cliente : Codice amministratore</code> (obbligatorio), e opzionalmente CF, P.IVA, telefono, email,
          indirizzo, città, provincia, <code>compenso per ciascun pod</code>.
        </p>
        <div
          className="ap-drop"
          data-busy={busy}
          onClick={() => fileInput.current?.click()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handle(f) }}
          onDragOver={(e) => e.preventDefault()}
        >
          <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f) }} />
          <div style={{ fontSize: 32 }}>📥</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Trascina il CSV o clicca</div>
          {busy && (
            <div style={{ width: '100%', maxWidth: 360, marginTop: 8 }}>
              <div className="ap-progress"><div className="ap-progress-bar" style={{ width: `${pct}%` }} /></div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ap-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{progress.phase}</span>
                <span>{progress.total > 0 ? `${progress.done}/${progress.total}` : '…'}</span>
              </div>
            </div>
          )}
        </div>
        {summary && (
          <div className="ap-card ap-card-pad" style={{ marginTop: 12 }}>
            <div className="ap-pill" data-tone="green" style={{ marginBottom: 8 }}>✓ Completato</div>
            <div style={{ fontSize: 13 }}>
              Creati: <strong>{summary.created}</strong> · Aggiornati: <strong>{summary.updated}</strong> · Saltati: <strong>{summary.skipped}</strong>
              <span style={{ color: 'var(--ap-text-muted)', marginLeft: 8 }}>in {((summary.durationMs ?? 0) / 1000).toFixed(1)}s</span>
            </div>
          </div>
        )}
        {error && <div style={{ marginTop: 10, color: 'var(--ap-danger)', fontSize: 13 }}>{error}</div>}
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 37, 64, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  zIndex: 50,
}

const modalStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 18,
  padding: 24,
  width: '100%',
  maxWidth: 720,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 32px 72px -16px rgba(15, 37, 64, 0.4)',
}
