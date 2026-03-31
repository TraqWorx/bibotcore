'use client'

import { useState, useEffect } from 'react'

interface UserRole {
  userId: string
  email: string
  role: string
}

const ROLES = ['location_admin', 'team_member', 'viewer'] as const

export default function RolesManager({ locationId, locationName }: { locationId: string; locationName: string }) {
  const [users, setUsers] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('team_member')
  const [inviting, setInviting] = useState(false)

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
      setMessage('Ruolo aggiornato')
      loadRoles()
    } else {
      setMessage('Errore nell\'aggiornamento')
    }
    setUpdating(null)
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setMessage(null)
    const res = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), locationId, role: inviteRole }),
    })
    if (res.ok) {
      setMessage(`${inviteEmail} aggiunto`)
      setInviteEmail('')
      loadRoles()
    } else {
      const data = await res.json()
      setMessage(`Errore: ${data.error}`)
    }
    setInviting(false)
  }

  async function handleRemove(userId: string) {
    if (!confirm('Rimuovere questo utente?')) return
    setUpdating(userId)
    await fetch('/api/admin/roles', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, locationId }),
    })
    loadRoles()
    setUpdating(null)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-800">Ruoli Utenti</h2>
        <p className="text-xs text-gray-400">Gestisci chi ha accesso a {locationName}</p>
      </div>

      {message && (
        <p className={`mb-3 text-xs font-medium ${message.includes('Errore') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>
      )}

      {/* Invite */}
      <div className="flex gap-2 mb-4">
        <input
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="email@esempio.com"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-[#2A00CC]"
        />
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
        >
          {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
        </select>
        <button
          onClick={handleInvite}
          disabled={inviting || !inviteEmail.trim()}
          className="rounded-lg bg-[#2A00CC] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2200aa] disabled:opacity-50"
        >
          {inviting ? '...' : 'Aggiungi'}
        </button>
      </div>

      {/* Users list */}
      {loading ? (
        <div className="h-12 animate-pulse rounded-lg bg-gray-50" />
      ) : users.length === 0 ? (
        <p className="text-xs text-gray-400">Nessun utente con ruolo assegnato.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {users.map((u) => (
            <div key={u.userId} className="flex items-center justify-between py-2">
              <span className="text-xs font-medium text-gray-700">{u.email}</span>
              <div className="flex items-center gap-2">
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
                <button
                  onClick={() => handleRemove(u.userId)}
                  disabled={updating === u.userId}
                  className="text-[10px] text-red-400 hover:text-red-600"
                >
                  Rimuovi
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
