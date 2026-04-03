'use client'

import { useEffect, useState } from 'react'
import { ad } from '@/lib/admin/ui'

interface UserRole {
  userId: string
  email: string
  role: string
}

const ROLES = ['location_admin', 'team_member', 'viewer'] as const

export default function RolesManager({ locationId, locationName: _locationName }: { locationId: string; locationName: string }) {
  const [users, setUsers] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function loadRoles(showLoading = true) {
    if (showLoading) setLoading(true)
    const res = await fetch('/api/admin/roles')
    if (res.ok) {
      const data = await res.json()
      setUsers((data.users ?? []).filter((u: { locationId: string }) => u.locationId === locationId))
    }
    setLoading(false)
  }

  useEffect(() => {
    async function loadInitialRoles() {
      const res = await fetch('/api/admin/roles')
      if (!res.ok) return
      const data = await res.json()
      setUsers((data.users ?? []).filter((u: { locationId: string }) => u.locationId === locationId))
      setLoading(false)
    }

    const timer = setTimeout(() => {
      void loadInitialRoles()
    }, 0)
    return () => clearTimeout(timer)
  }, [locationId])

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdating(userId)
    setMessage(null)
    const res = await fetch('/api/admin/roles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, locationId, role: newRole }),
    })
    if (res.ok) {
      setMessage('Ruolo aggiornato')
      void loadRoles(false)
    } else {
      setMessage('Errore nell\'aggiornamento')
    }
    setUpdating(null)
  }

  return (
    <div className={ad.panel}>
      <div className="mb-4">
        <h2 className="text-sm font-bold text-gray-900">Ruoli CRM</h2>
        <p className="text-xs text-gray-500">
          Utenti sincronizzati da GHL. I ruoli qui controllano solo il nostro CRM, non GHL.
        </p>
      </div>

      {message && (
        <p className={`mb-3 text-xs font-medium ${message.includes('Errore') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>
      )}

      {loading ? (
        <div className="h-12 animate-pulse rounded-lg bg-gray-50" />
      ) : users.length === 0 ? (
        <p className="text-xs text-gray-400">Nessun utente sincronizzato da GHL per questa location.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {users.map((u) => (
            <div key={u.userId} className="flex items-center justify-between py-2.5">
              <span className="text-xs font-medium text-gray-700">{u.email}</span>
              <select
                value={u.role}
                onChange={(e) => handleRoleChange(u.userId, e.target.value)}
                disabled={updating === u.userId}
                className={`rounded-lg border px-2 py-1 text-[11px] font-semibold outline-none ${
                  u.role === 'location_admin' ? 'border-purple-200 bg-purple-50 text-purple-700' :
                  u.role === 'viewer' ? 'border-gray-200 bg-gray-50 text-gray-600' :
                  'border-blue-200 bg-blue-50 text-blue-700'
                }`}
              >
                {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
