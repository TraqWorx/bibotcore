'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createAdmin } from '../_actions'

export default function AddAdminPanel() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} className="ap-btn ap-btn-primary">
        ＋ Nuovo amministratore
      </button>
      {open && <ManualForm onClose={() => setOpen(false)} />}
    </>
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
