'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startImpersonation } from '../_actions'

export default function ImpersonateButton({ adminContactId }: { adminContactId: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function go() {
    startTransition(async () => {
      const r = await startImpersonation(adminContactId)
      if (r?.error) alert(r.error)
      else router.push('/designs/apulia-power/dashboard')
    })
  }

  return (
    <button onClick={go} disabled={pending} className="ap-btn ap-btn-ghost" style={{ marginLeft: 8 }}>
      {pending ? '…' : '👤 Entra come questo amministratore'}
    </button>
  )
}
