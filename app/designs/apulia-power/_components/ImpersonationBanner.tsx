'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { exitImpersonation } from '../amministratori/[id]/_actions'

export default function ImpersonationBanner({ email }: { email: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function exit() {
    startTransition(async () => {
      await exitImpersonation()
      router.push('/designs/apulia-power/amministratori')
    })
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #d18b1f 0%, #e8a73a 100%)',
        color: 'white',
        padding: '10px 18px',
        borderRadius: 12,
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        boxShadow: '0 4px 16px -8px rgba(209, 139, 31, 0.6)',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600 }}>
        👤 Stai visualizzando la dashboard come <strong>{email}</strong>
      </span>
      <button
        onClick={exit}
        disabled={pending}
        style={{
          background: 'rgba(255,255,255,0.18)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.3)',
          padding: '6px 14px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {pending ? '…' : '↩ Torna al pannello titolare'}
      </button>
    </div>
  )
}
