'use client'

import { useState, useTransition } from 'react'
import { setSwitchOutDate } from '../_actions'

export default function SwitchOutDateField({
  contactId,
  switchedOutAt,
}: {
  contactId: string
  switchedOutAt: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [val, setVal] = useState<string>(switchedOutAt ? switchedOutAt.slice(0, 10) : '')
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function commit() {
    const cur = switchedOutAt ? switchedOutAt.slice(0, 10) : ''
    if (val === cur) return
    setError(null)
    startTransition(async () => {
      const res = await setSwitchOutDate(contactId, val)
      if (res?.error) setError(res.error)
      else {
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 1500)
      }
    })
  }

  return (
    <section className="ap-card" style={{ padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ap-text-muted)' }}>Switch-out</h3>
          <p style={{ fontSize: 12, color: 'var(--ap-text-faint)', margin: '4px 0 0', maxWidth: 540 }}>
            Data reale di switch-out (Data esecuzione attività dal file). Impostata all&apos;import; correggila qui se necessario.
          </p>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)' }}>Data switch-out</span>
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
      </div>
    </section>
  )
}
