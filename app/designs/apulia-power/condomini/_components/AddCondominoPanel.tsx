'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCondomino } from '../_actions'
import AdminPicker, { type AdminOption } from '../../_components/AdminPicker'

export default function AddCondominoPanel({ adminOptions }: { adminOptions: AdminOption[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} className="ap-btn ap-btn-primary">＋ Nuovo condominio</button>
      {open && <Modal onClose={() => setOpen(false)} adminOptions={adminOptions} />}
    </>
  )
}

function Modal({ onClose, adminOptions }: { onClose: () => void; adminOptions: AdminOption[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [adminCode, setAdminCode] = useState('')
  const [adminName, setAdminName] = useState('')

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createCondomino({
        podPdr: (fd.get('podPdr') as string) ?? '',
        cliente: (fd.get('cliente') as string) ?? '',
        codiceAmministratore: adminCode || undefined,
        email: (fd.get('email') as string) || undefined,
        phone: (fd.get('phone') as string) || undefined,
        comune: (fd.get('comune') as string) || undefined,
        indirizzo: (fd.get('indirizzo') as string) || undefined,
        provincia: (fd.get('provincia') as string) || undefined,
        cap: (fd.get('cap') as string) || undefined,
        codiceFiscale: (fd.get('codiceFiscale') as string) || undefined,
      })
      if (res.error) setError(res.error)
      else if (res.id) {
        onClose()
        router.push(`/designs/apulia-power/condomini/${res.id}`)
      }
    })
  }

  return (
    <div style={overlay} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Nuovo condominio</h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ap-text-muted)', marginBottom: 12 }}>
          Compila almeno POD/PDR e Cliente. Gli altri campi puoi modificarli dopo nella scheda di dettaglio.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field name="podPdr" label="POD/PDR *" required mono />
          <Field name="cliente" label="Cliente *" required />
          <div style={{ gridColumn: '1 / -1' }}>
            <AdminPicker
              options={adminOptions}
              initialCode=""
              onSelect={async () => undefined}
              controlled
              onChange={(c, n) => { setAdminCode(c); setAdminName(n) }}
              label="Amministratore (opzionale, cerca per codice o nome)"
            />
            {adminName && <div style={{ fontSize: 11, color: 'var(--ap-text-faint)', marginTop: 4 }}>Selezionato: <strong>{adminCode}</strong> · {adminName}</div>}
          </div>
          <Field name="codiceFiscale" label="Codice fiscale" mono />
          <Field name="email" label="Email" type="email" />
          <Field name="phone" label="Telefono" type="tel" />
          <Field name="indirizzo" label="Indirizzo" full />
          <Field name="comune" label="Città" />
          <Field name="provincia" label="Provincia" />
          <Field name="cap" label="CAP" />
        </div>
        {error && <div style={{ color: 'var(--ap-danger)', marginTop: 12, fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onClose} className="ap-btn ap-btn-ghost">Annulla</button>
          <button type="submit" disabled={pending} className="ap-btn ap-btn-primary">
            {pending ? 'Salvo…' : 'Crea condominio'}
          </button>
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
  mono?: boolean
  full?: boolean
}

function Field({ name, label, required, type = 'text', mono, full }: FieldProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: full ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="ap-input"
        style={{ height: 36, fontFamily: mono ? 'monospace' : undefined }}
      />
    </label>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 37, 64, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  zIndex: 50,
}

const modal: React.CSSProperties = {
  background: 'white',
  borderRadius: 18,
  padding: 24,
  width: '100%',
  maxWidth: 720,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 32px 72px -16px rgba(15, 37, 64, 0.4)',
}
