'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  contactId: string
  /** Server action. May be called twice — first time without `force`, then with `force=true` if it returned a warn. */
  action: (contactId: string, force?: boolean) => Promise<{ error?: string; warn?: string; redirect?: string } | undefined>
  label?: string
  confirmText?: string
  redirectAfter?: string
}

export default function DeleteContactButton({ contactId, action, label = 'Elimina', confirmText = 'Sei sicuro? Questa azione non si può annullare.', redirectAfter }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function run(force: boolean) {
    setError(null)
    startTransition(async () => {
      const res = await action(contactId, force)
      if (res?.error) {
        setError(res.error)
        return
      }
      if (res?.warn) {
        if (window.confirm(res.warn)) run(true)
        return
      }
      const target = res?.redirect ?? redirectAfter
      if (target) router.push(target)
      else router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        onClick={() => { if (window.confirm(confirmText)) run(false) }}
        disabled={pending}
        className="ap-btn"
        style={{
          background: 'var(--ap-danger, #dc2626)',
          color: '#fff',
          fontSize: 12,
          height: 32,
          padding: '0 14px',
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? 'Eliminazione…' : `🗑 ${label}`}
      </button>
      {error && <div style={{ fontSize: 11, color: 'var(--ap-danger)' }}>{error}</div>}
    </div>
  )
}
