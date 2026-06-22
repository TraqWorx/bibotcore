'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { sf } from '@/lib/simfonia/ui'

interface UserRole {
  userId: string
  email: string
  role: string
}

const ROLE_LABELS: Record<string, string> = {
  location_admin: 'Admin',
  team_member: 'Membro',
  viewer: 'Solo lettura',
}

function roleBadgeClass(role: string): string {
  return role === 'location_admin'
    ? 'border-brand/30 bg-brand/8 text-brand'
    : role === 'viewer'
      ? 'border-gray-200/90 bg-gray-50/90 text-gray-600'
      : 'border-sky-200/80 bg-sky-50/90 text-sky-800'
}

export default function TeamManager({
  locationId,
  demoUsers,
}: {
  locationId: string
  demoUsers?: UserRole[]
  demoMode?: boolean
}) {
  const [users, setUsers] = useState<UserRole[]>(demoUsers ?? [])
  const [loading, setLoading] = useState(!demoUsers)

  const loadRoles = useEffectEvent(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    const res = await fetch('/api/admin/roles')
    if (res.ok) {
      const data = await res.json()
      setUsers((data.users ?? []).filter((u: { locationId: string }) => u.locationId === locationId))
    }
    setLoading(false)
  })

  useEffect(() => {
    if (demoUsers) return
    void loadRoles(false)
  }, [locationId, demoUsers])

  if (loading) {
    return <div className="h-20 animate-pulse rounded-2xl bg-gray-100/80" />
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-800">Team</h3>
        <p className="text-xs text-gray-400">Utenti e ruoli sono gestiti in GoHighLevel e sincronizzati automaticamente.</p>
      </div>

      {users.length === 0 ? (
        <p className="text-xs text-gray-400">Nessun membro del team trovato.</p>
      ) : (
        <div className={`${sf.tableShell} divide-y divide-gray-100/90`}>
          {users.map((u) => (
            <div key={u.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <span className="text-sm font-medium text-gray-800">{u.email}</span>
              <span className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${roleBadgeClass(u.role)}`}>
                {ROLE_LABELS[u.role] ?? u.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
