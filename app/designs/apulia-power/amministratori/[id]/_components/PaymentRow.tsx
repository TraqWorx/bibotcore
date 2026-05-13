'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePaymentNote, attachPaymentProof, removePaymentProof } from '../_actions'

export interface PaymentRowData {
  id: string
  paid_at: string
  amount_cents: number
  paid_by: string | null
  note: string | null
  pod_contact_id: string | null
  proof_url: string | null
  proof_name: string | null
}

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

export default function PaymentRow({
  payment,
  podLabel,
  adminContactId,
}: {
  payment: PaymentRowData
  podLabel: string | null
  adminContactId: string
}) {
  const [note, setNote] = useState(payment.note ?? '')
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()

  function saveNote() {
    if (note === (payment.note ?? '')) { setEditing(false); return }
    setError(null)
    startTransition(async () => {
      const r = await updatePaymentNote(payment.id, note, adminContactId)
      if (r?.error) setError(r.error)
      else {
        setEditing(false)
        setFlash('Nota salvata')
        setTimeout(() => setFlash(null), 1500)
        router.refresh()
      }
    })
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)
    if (f.size > 10 * 1024 * 1024) {
      setError('File troppo grande (max 10MB)')
      return
    }
    startTransition(async () => {
      try {
        const base64 = await fileToBase64(f)
        const r = await attachPaymentProof(payment.id, f.name, base64, f.type || 'application/octet-stream', adminContactId)
        if (r.error) setError(r.error)
        else {
          setFlash('Allegato caricato')
          setTimeout(() => setFlash(null), 1500)
          router.refresh()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Caricamento fallito')
      }
      if (fileRef.current) fileRef.current.value = ''
    })
  }

  function removeProof() {
    if (!window.confirm('Eliminare l\'allegato di pagamento?')) return
    startTransition(async () => {
      const r = await removePaymentProof(payment.id, adminContactId)
      if (r?.error) setError(r.error)
      else router.refresh()
    })
  }

  return (
    <tr>
      <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {new Date(payment.paid_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
      </td>
      <td style={{ fontFamily: payment.pod_contact_id ? 'monospace' : undefined, fontSize: 12 }}>
        {podLabel ?? <span style={{ color: 'var(--ap-text-muted)', fontStyle: 'italic' }}>tutto l&apos;amministratore</span>}
      </td>
      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {fmtEur(payment.amount_cents / 100)}
      </td>
      <td style={{ color: 'var(--ap-text-muted)', fontSize: 12 }}>{payment.paid_by ?? '—'}</td>
      <td style={{ minWidth: 200, maxWidth: 320 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setNote(payment.note ?? ''); setEditing(false) }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote()
              }}
              autoFocus
              rows={2}
              className="ap-input"
              style={{ fontSize: 12, resize: 'vertical', minHeight: 36, padding: 6 }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={saveNote} disabled={pending} className="ap-btn ap-btn-primary" style={{ height: 24, fontSize: 11, padding: '0 10px' }}>
                {pending ? 'Salvo…' : 'Salva'}
              </button>
              <button onClick={() => { setNote(payment.note ?? ''); setEditing(false) }} className="ap-btn ap-btn-ghost" style={{ height: 24, fontSize: 11, padding: '0 10px' }}>
                Annulla
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setEditing(true)}
            style={{
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: 4,
              fontSize: 12,
              color: payment.note ? 'var(--ap-text)' : 'var(--ap-text-faint)',
              minHeight: 24,
              fontStyle: payment.note ? undefined : 'italic',
            }}
            title="Clicca per modificare"
          >
            {payment.note || '+ aggiungi nota'}
          </div>
        )}
        {error && <div style={{ color: 'var(--ap-danger)', fontSize: 11, marginTop: 4 }}>{error}</div>}
        {flash && <div style={{ color: 'var(--ap-success)', fontSize: 11, marginTop: 4 }}>{flash}</div>}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {payment.proof_url ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <a
              href={payment.proof_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--ap-blue)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
              title={payment.proof_name ?? ''}
            >
              📎 {payment.proof_name ?? 'Allegato'}
            </a>
            <button
              onClick={removeProof}
              disabled={pending}
              className="ap-btn ap-btn-ghost"
              style={{ height: 22, fontSize: 10, padding: '0 6px', color: 'var(--ap-danger)' }}
              title="Rimuovi allegato"
            >
              ✕
            </button>
          </div>
        ) : (
          <label
            className="ap-btn ap-btn-ghost"
            style={{ height: 24, fontSize: 11, padding: '0 10px', cursor: pending ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*"
              onChange={onPickFile}
              disabled={pending}
              style={{ display: 'none' }}
            />
            📎 {pending ? 'Carico…' : 'Carica'}
          </label>
        )}
      </td>
    </tr>
  )
}
