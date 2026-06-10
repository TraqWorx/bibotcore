'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setPodFirstPaymentDate } from '../_actions'

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

export default function PodPaymentField({
  contactId,
  firstPaymentAt,
  nextDueDate,
  paidCount,
  isDueNow,
  amount,
}: {
  contactId: string
  firstPaymentAt: string | null
  nextDueDate: string | null
  paidCount: number
  isDueNow: boolean
  amount: number
}) {
  const [pending, startTransition] = useTransition()
  const [val, setVal] = useState<string>(firstPaymentAt ? firstPaymentAt.slice(0, 10) : '')
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function commit() {
    if (!val) return
    if (firstPaymentAt && val === firstPaymentAt.slice(0, 10)) return
    setError(null)
    startTransition(async () => {
      const res = await setPodFirstPaymentDate(contactId, val)
      if (res?.error) setError(res.error)
      else {
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 1500)
        router.refresh()
      }
    })
  }

  return (
    <section className="ap-card" style={{ padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ap-text-muted)' }}>Pagamento</h3>
          <p style={{ fontSize: 12, color: 'var(--ap-text-faint)', margin: '4px 0 0', maxWidth: 540 }}>
            La data del 1° pagamento è la data di inizio fornitura del POD. Modificala se serve: tutte le scadenze successive sono ogni 6 mesi da qui.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)' }}>1° pagamento</span>
            <input
              type="date"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onBlur={commit}
              disabled={pending}
              className="ap-input"
              style={{ height: 32, width: 160, fontSize: 12 }}
            />
            {error && <span style={{ color: 'var(--ap-danger)', fontSize: 11 }}>{error}</span>}
            {savedFlash && <span style={{ color: 'var(--ap-success)', fontSize: 11 }}>✓ salvato</span>}
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)' }}>Prossima scadenza</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: isDueNow ? 'var(--ap-danger)' : 'var(--ap-text)' }}>
              {nextDueDate ? new Date(nextDueDate).toLocaleDateString('it-IT') : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)' }}>Compenso</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtEur(amount)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)' }}>Pagamenti</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{paidCount}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)' }}>Stato</span>
            {isDueNow
              ? <span className="ap-pill" data-tone="red">Da pagare ora</span>
              : firstPaymentAt
                ? <span className="ap-pill" data-tone="green">Programmato</span>
                : <span className="ap-pill" data-tone="gray">Da configurare</span>}
          </div>
        </div>
      </div>
    </section>
  )
}
