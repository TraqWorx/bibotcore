'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setAgencyActive } from '../_actions'

export default function AgencyActiveToggle({ agencyId, agencyName, deactivated, disabled }: { agencyId: string; agencyName: string; deactivated: boolean; disabled?: boolean }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  if (disabled) return null

  const toggle = () => {
    const reactivate = deactivated
    const msg = reactivate
      ? `Reactivate "${agencyName}"? Its users will be able to log in again.`
      : `Deactivate "${agencyName}"? Its users will be blocked from logging in. Nothing is deleted — you can reactivate anytime.`
    if (!window.confirm(msg)) return
    start(async () => {
      const r = await setAgencyActive(agencyId, reactivate)
      if (r.error) window.alert('Error: ' + r.error)
      else router.refresh()
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`text-xs font-semibold hover:underline disabled:opacity-50 ${deactivated ? 'text-emerald-600' : 'text-amber-600'}`}
    >
      {pending ? '…' : deactivated ? 'Reactivate' : 'Deactivate'}
    </button>
  )
}
