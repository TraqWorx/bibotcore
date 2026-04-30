'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setPayoutSchedule, resyncCache } from '../_actions'

export function PayoutScheduleForm({ initial }: { initial: { H1: string; H2: string } }) {
  const [h1, setH1] = useState(initial.H1)
  const [h2, setH2] = useState(initial.H2)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()

  function save() {
    setMsg(null)
    startTransition(async () => {
      const r = await setPayoutSchedule(h1, h2)
      if (r?.error) setMsg(`Errore: ${r.error}`)
      else { setMsg('Date salvate'); router.refresh(); setTimeout(() => setMsg(null), 2500) }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pagamento H1 (gennaio-giugno)</label>
          <input className="ap-input" value={h1} onChange={(e) => setH1(e.target.value)} placeholder="01-01" pattern="\d{2}-\d{2}" style={{ marginTop: 4 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pagamento H2 (luglio-dicembre)</label>
          <input className="ap-input" value={h2} onChange={(e) => setH2(e.target.value)} placeholder="07-01" pattern="\d{2}-\d{2}" style={{ marginTop: 4 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="ap-btn ap-btn-primary" onClick={save} disabled={pending}>{pending ? 'Salvo…' : 'Salva date'}</button>
        {msg && <span style={{ fontSize: 12, fontWeight: 600, color: msg.startsWith('Errore') ? 'var(--ap-danger)' : 'var(--ap-success)' }}>{msg}</span>}
      </div>
      <p style={{ fontSize: 12, color: 'var(--ap-text-muted)', margin: 0 }}>
        Formato MM-DD. La data è applicata all&apos;anno corrente: H1 al primo giorno indicato del periodo gennaio-giugno, H2 nel periodo luglio-dicembre.
      </p>
    </div>
  )
}

export function ResyncButton() {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function go() {
    setMsg('Sincronizzo da Bibot…')
    startTransition(async () => {
      const r = await resyncCache()
      if (r?.error) setMsg(`Errore: ${r.error}`)
      else setMsg(`✓ ${r?.total} contatti sincronizzati${r?.deleted ? `, ${r.deleted} rimossi` : ''}`)
    })
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <button className="ap-btn ap-btn-ghost" onClick={go} disabled={pending}>{pending ? '…' : '↻ Sincronizza ora'}</button>
      {msg && <span style={{ fontSize: 12, fontWeight: 600, color: msg.startsWith('Errore') ? 'var(--ap-danger)' : 'var(--ap-text-muted)' }}>{msg}</span>}
    </div>
  )
}
