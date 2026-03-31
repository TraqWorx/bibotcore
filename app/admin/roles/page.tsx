'use client'

import { useState, useEffect } from 'react'

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

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const res = await fetch('/api/admin/roles')
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users ?? [])
      setLocations(data.locations ?? [])
      if (!selectedLocation && data.locations?.length > 0) {
        setSelectedLocation(data.locations[0].id)
      }
    }
    setLoading(false)
  }

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
      loadData()
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
      loadData()
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
      loadData()
    }
    setUpdating(null)
  }

  const filteredUsers = selectedLocation
    ? users.filter((u) => u.locationId === selectedLocation)
    : users

  if (loading) {
    return <div className="p-8"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#2A00CC]" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestione Ruoli</h1>
        <p className="mt-1 text-sm text-gray-500">Gestisci i ruoli degli utenti per ogni location</p>
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
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-[#2A00CC]"
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Invite user */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Aggiungi Utente</h3>
        <div className="flex gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@esempio.com"
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#2A00CC]"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
          </select>
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="rounded-xl bg-[#2A00CC] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2200aa] disabled:opacity-50"
          >
            {inviting ? '...' : 'Aggiungi'}
          </button>
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
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
