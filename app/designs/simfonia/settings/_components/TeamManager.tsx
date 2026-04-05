'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { sf } from '@/lib/simfonia/ui'

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

export default function TeamManager({
  locationId,
  demoUsers,
  demoMode = false,
}: {
  locationId: string
  demoUsers?: UserRole[]
  demoMode?: boolean
}) {
  const [users, setUsers] = useState<UserRole[]>(demoUsers ?? [])
  const [loading, setLoading] = useState(!demoUsers)
  const [updating, setUpdating] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

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

  async function handleRoleChange(userId: string, newRole: string) {
    if (demoMode) {
      setUsers((prev) => prev.map((u) => u.userId === userId ? { ...u, role: newRole } : u))
      setMessage('Ruolo aggiornato')
      setTimeout(() => setMessage(null), 2000)
      return
    }
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
    return <div className="h-20 animate-pulse rounded-2xl bg-gray-100/80" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Team</h3>
          <p className="text-xs text-gray-400">Gestisci i ruoli del tuo team. Sincronizzati automaticamente.</p>
        </div>
        {message && <span className="text-xs font-medium text-green-600">{message}</span>}
      </div>

      {users.length === 0 ? (
        <p className="text-xs text-gray-400">Nessun membro del team trovato.</p>
      ) : (
        <div className={`${sf.tableShell} divide-y divide-gray-100/90`}>
          {users.map((u) => (
            <div key={u.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <span className="text-sm font-medium text-gray-800">{u.email}</span>
              <select
                value={u.role}
                onChange={(e) => handleRoleChange(u.userId, e.target.value)}
                disabled={demoMode ? false : updating === u.userId}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15 ${
                  u.role === 'location_admin'
                    ? 'border-brand/30 bg-brand/8 text-brand'
                    : u.role === 'viewer'
                      ? 'border-gray-200/90 bg-gray-50/90 text-gray-600'
                      : 'border-sky-200/80 bg-sky-50/90 text-sky-800'
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
