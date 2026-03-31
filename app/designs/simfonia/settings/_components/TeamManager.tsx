'use client'

import { useState, useEffect } from 'react'

interface UserRole {
  userId: string
  email: string
  role: string
}

const ROLES = ['location_admin', 'team_member', 'viewer'] as const
const ROLE_LABELS: Record<string, string> = {
  location_admin: 'Admin',
  team_member: 'Membro',
  viewer: 'Solo lettura',
}

export default function TeamManager({ locationId }: { locationId: string }) {
  const [users, setUsers] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => { loadRoles() }, [locationId])

  async function loadRoles() {
    setLoading(true)
    const res = await fetch('/api/admin/roles')
    if (res.ok) {
      const data = await res.json()
      setUsers((data.users ?? []).filter((u: { locationId: string }) => u.locationId === locationId))
    }
    setLoading(false)
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdating(userId)
    setMessage(null)
    const res = await fetch('/api/admin/roles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, locationId, role: newRole }),
    })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.userId === userId ? { ...u, role: newRole } : u))
      setMessage('Ruolo aggiornato')
    } else {
      setMessage('Errore')
    }
    setUpdating(null)
    setTimeout(() => setMessage(null), 2000)
  }

  if (loading) {
    return <div className="h-20 animate-pulse rounded-xl bg-gray-50" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Team</h3>
          <p className="text-xs text-gray-400">Gestisci i ruoli del tuo team. Sincronizzati da GHL.</p>
        </div>
        {message && <span className="text-xs font-medium text-green-600">{message}</span>}
      </div>

      {users.length === 0 ? (
        <p className="text-xs text-gray-400">Nessun membro del team trovato.</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {users.map((u) => (
            <div key={u.userId} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium text-gray-700">{u.email}</span>
              <select
                value={u.role}
                onChange={(e) => handleRoleChange(u.userId, e.target.value)}
                disabled={updating === u.userId}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold outline-none ${
                  u.role === 'location_admin' ? 'border-purple-200 bg-purple-50 text-purple-700' :
                  u.role === 'viewer' ? 'border-gray-200 bg-gray-50 text-gray-600' :
                  'border-blue-200 bg-blue-50 text-blue-700'
                }`}
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
