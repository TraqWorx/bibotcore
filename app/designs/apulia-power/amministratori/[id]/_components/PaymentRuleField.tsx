'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setAdminPaymentOffset } from '../../_actions'

function offsetShort(days: number): string {
  return days === 30 ? '+30 giorni' : 'Inizio fornitura'
}

export default function PaymentRuleField({
  contactId,
  offsetDays,
  defaultOffset,
}: {
  contactId: string
  offsetDays: number | null
  defaultOffset: number
}) {
  const [pending, startTransition] = useTransition()
  const [val, setVal] = useState<string>(offsetDays == null ? 'default' : String(offsetDays))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function commit(next: string) {
    setVal(next)
    setError(null)
    const days = next === 'default' ? null : Number(next)
    startTransition(async () => {
      const res = await setAdminPaymentOffset(contactId, days)
      if (res?.error) setError(res.error)
      else { setSaved(true); setTimeout(() => setSaved(false), 1500); router.refresh() }
    })
  }

  return (
    <section className="ap-card" style={{ padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ap-text-muted)' }}>Regola di pagamento</h3>
          <p style={{ fontSize: 12, color: 'var(--ap-text-faint)', margin: '4px 0 0', maxWidth: 540 }}>
            Quando matura la prima commissione di ogni POD: alla data di inizio fornitura o 30 giorni dopo, poi ogni 6 mesi.
          </p>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)' }}>Regola</span>
          <select
            value={val}
            onChange={(e) => commit(e.target.value)}
            disabled={pending}
            className="ap-input"
            style={{ height: 32, width: 240, fontSize: 12 }}
          >
            <option value="default">{`Default (${offsetShort(defaultOffset)})`}</option>
            <option value="0">{offsetShort(0)}</option>
            <option value="30">{offsetShort(30)}</option>
          </select>
          {error && <span style={{ color: 'var(--ap-danger)', fontSize: 11 }}>{error}</span>}
          {saved && <span style={{ color: 'var(--ap-success)', fontSize: 11 }}>✓ salvato</span>}
        </label>
      </div>
    </section>
  )
}
