'use client'

import { useCallback, useEffect, useState } from 'react'
import { ad } from '@/lib/admin/ui'

interface UserRole {
  userId: string
  email: string
  role: string
}

function roleBadgeClass(role: string): string {
  return role === 'location_admin' ? 'border-purple-200 bg-purple-50 text-purple-700'
    : role === 'viewer' ? 'border-gray-200 bg-gray-50 text-gray-600'
    : 'border-blue-200 bg-blue-50 text-blue-700'
}

export default function RolesManager({ locationId, locationName: _locationName }: { locationId: string; locationName: string }) {
  const [users, setUsers] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)

  const loadRoles = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    const res = await fetch('/api/admin/roles')
    if (res.ok) {
      const data = await res.json()
      setUsers((data.users ?? []).filter((u: { locationId: string }) => u.locationId === locationId))
    }
    setLoading(false)
  }, [locationId])

  useEffect(() => {
    const timer = setTimeout(() => { void loadRoles(false) }, 0)
    return () => clearTimeout(timer)
  }, [loadRoles])

  return (
    <div className={ad.panel}>
      <div className="mb-4">
        <h2 className="text-sm font-bold text-gray-900">Ruoli CRM</h2>
        <p className="text-xs text-gray-500">
          Utenti e ruoli sono gestiti in GoHighLevel e sincronizzati automaticamente.
        </p>
      </div>

      {loading ? (
        <div className="h-12 animate-pulse rounded-lg bg-gray-50" />
      ) : users.length === 0 ? (
        <p className="text-xs text-gray-400">Nessun utente sincronizzato da GHL per questa location.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {users.map((u) => (
            <div key={u.userId} className="flex items-center justify-between py-2.5">
              <span className="text-xs font-medium text-gray-700">{u.email}</span>
              <span className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${roleBadgeClass(u.role)}`}>
                {u.role.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
