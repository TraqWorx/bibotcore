'use client'

import { useCallback, useEffect, useState } from 'react'
import { ad } from '@/lib/admin/ui'

interface LocationUser {
  userId: string
  email: string
  role: string
  locationId: string
  locationName: string
}

const ROLES = ['location_admin', 'team_member', 'viewer'] as const

export default function AdminRolesPage() {
  const [users, setUsers] = useState<LocationUser[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('team_member')
  const [inviting, setInviting] = useState(false)

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    const res = await fetch('/api/admin/roles')
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users ?? [])
      setLocations(data.locations ?? [])
      if (data.locations?.length > 0) {
        setSelectedLocation((current) => current || data.locations[0].id)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [loadData])

  async function handleRoleChange(userId: string, locationId: string, newRole: string) {
    setUpdating(userId)
    setMessage(null)
    const res = await fetch('/api/admin/roles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, locationId, role: newRole }),
    })
    if (res.ok) {
      setMessage('Ruolo aggiornato')
      void loadData(false)
    } else {
      const data = await res.json()
      setMessage(`Errore: ${data.error}`)
    }
    setUpdating(null)
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !selectedLocation) return
    setInviting(true)
    setMessage(null)
    const res = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), locationId: selectedLocation, role: inviteRole }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(`Utente ${inviteEmail} aggiunto come ${inviteRole}`)
      setInviteEmail('')
      void loadData(false)
    } else {
      setMessage(`Errore: ${data.error}`)
    }
    setInviting(false)
  }

  async function handleRemove(userId: string, locationId: string) {
    if (!confirm('Rimuovere questo utente dalla location?')) return
    setUpdating(userId)
    const res = await fetch('/api/admin/roles', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, locationId }),
    })
    if (res.ok) {
      setMessage('Utente rimosso')
      void loadData(false)
    }
    setUpdating(null)
  }

  const filteredUsers = selectedLocation
    ? users.filter((u) => u.locationId === selectedLocation)
    : users

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={ad.pageTitle}>Gestione ruoli</h1>
        <p className={ad.pageSubtitle}>Gestisci i ruoli degli utenti per ogni location.</p>
      </div>

      {message && (
        <div className={`rounded-xl border p-3 text-sm ${message.includes('Errore') ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Location selector */}
      <div className="flex items-center gap-4">
        <select
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          className={ad.input}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Invite user */}
      <div className={ad.panel}>
        <h3 className="mb-3 text-sm font-bold text-gray-900">Aggiungi utente</h3>
        <div className="flex flex-wrap gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@esempio.com"
            className={`${ad.input} flex-1 min-w-[16rem]`}
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className={`${ad.input} w-auto`}
          >
            {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
          </select>
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            className={ad.btnPrimary}
          >
            {inviting ? '...' : 'Aggiungi'}
          </button>
        </div>
      </div>

      {/* Users table */}
      <div className={ad.tableShell}>
        <table className="w-full text-sm">
          <thead>
            <tr className={ad.tableHeadRow}>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Email</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Ruolo</th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-widest text-gray-400">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredUsers.length === 0 && (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400">Nessun utente per questa location</td></tr>
            )}
            {filteredUsers.map((u) => (
              <tr key={u.userId} className="hover:bg-gray-50/50">
                <td className="px-5 py-3 font-medium text-gray-800">{u.email}</td>
                <td className="px-5 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.userId, u.locationId, e.target.value)}
                    disabled={updating === u.userId}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold outline-none ${
                      u.role === 'location_admin' ? 'border-purple-200 bg-purple-50 text-purple-700' :
                      u.role === 'viewer' ? 'border-gray-200 bg-gray-50 text-gray-600' :
                      'border-blue-200 bg-blue-50 text-blue-700'
                    }`}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => handleRemove(u.userId, u.locationId)}
                    disabled={updating === u.userId}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Rimuovi
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
