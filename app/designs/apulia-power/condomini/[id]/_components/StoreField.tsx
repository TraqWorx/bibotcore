'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setPodStore } from '../_actions'

export default function StoreField({
  contactId,
  store,
  options,
}: {
  contactId: string
  store: string | null
  options: { slug: string; name: string }[]
}) {
  const [pending, startTransition] = useTransition()
  const [val, setVal] = useState<string>(store ?? '')
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function commit(next: string) {
    setVal(next)
    if (next === (store ?? '')) return
    setError(null)
    startTransition(async () => {
      const res = await setPodStore(contactId, next)
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
          <h3 style={{ fontSize: 13, fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ap-text-muted)' }}>Store</h3>
          <p style={{ fontSize: 12, color: 'var(--ap-text-faint)', margin: '4px 0 0', maxWidth: 540 }}>
            Store associato a questo POD (dalla colonna Note del file PDP). Assegnalo o correggilo a mano qui.
          </p>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)' }}>Store</span>
          <select
            value={val}
            onChange={(e) => commit(e.target.value)}
            disabled={pending}
            className="ap-input"
            style={{ height: 32, width: 200, fontSize: 12 }}
          >
            <option value="">— Nessuno —</option>
            {options.map((o) => (
              <option key={o.slug} value={o.slug}>{o.name}</option>
            ))}
          </select>
          {error && <span style={{ color: 'var(--ap-danger)', fontSize: 11 }}>{error}</span>}
          {savedFlash && <span style={{ color: 'var(--ap-success)', fontSize: 11 }}>✓ salvato</span>}
        </label>
      </div>
    </section>
  )
}
