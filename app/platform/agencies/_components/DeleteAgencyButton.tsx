'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteAgency } from '../_actions'

export default function DeleteAgencyButton({ agencyId, agencyName, disabled }: { agencyId: string; agencyName: string; disabled?: boolean }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  if (disabled) return <span className="text-xs text-gray-300" title="Protected">—</span>

  const onClick = () => {
    const typed = window.prompt(
      `This PERMANENTLY deletes "${agencyName}" and ALL of its locations, subscriptions, dashboards, GHL connections and user accounts. This cannot be undone.\n\nType the agency name to confirm:`,
    )
    if (typed == null) return
    if (typed.trim() !== agencyName) { window.alert('Name did not match — cancelled.'); return }
    start(async () => {
      const r = await deleteAgency(agencyId)
      if (r.error) window.alert('Error: ' + r.error)
      else router.refresh()
    })
  }

  return (
    <button onClick={onClick} disabled={pending} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
      {pending ? 'Removing…' : 'Remove'}
    </button>
  )
}
