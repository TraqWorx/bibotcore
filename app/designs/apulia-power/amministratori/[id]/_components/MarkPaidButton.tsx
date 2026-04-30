'use client'

import { useState, useTransition } from 'react'
import { markPaid, unmarkPaid } from '../_actions'

export default function MarkPaidButton({ adminContactId, amount, alreadyPaid }: { adminContactId: string; amount: number; alreadyPaid: boolean }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const cents = Math.round(amount * 100)

  function pay() {
    setError(null)
    if (!cents) return
    if (!confirm(`Confermi il pagamento di € ${amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}?`)) return
    startTransition(async () => {
      const r = await markPaid(adminContactId, cents)
      if (r?.error) setError(r.error)
    })
  }
  function unpay() {
    setError(null)
    if (!confirm('Annullare il pagamento del periodo corrente?')) return
    startTransition(async () => {
      const r = await unmarkPaid(adminContactId)
      if (r?.error) setError(r.error)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      {alreadyPaid ? (
        <button className="ap-btn ap-btn-ghost" onClick={unpay} disabled={pending}>
          ↶ Annulla pagamento
        </button>
      ) : (
        <button className="ap-btn ap-btn-primary" onClick={pay} disabled={pending || !cents}>
          {pending ? 'Salvataggio…' : `Segna come pagato — € ${amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
        </button>
      )}
      {error && <span style={{ color: 'var(--ap-danger)', fontSize: 12 }}>{error}</span>}
    </div>
  )
}
