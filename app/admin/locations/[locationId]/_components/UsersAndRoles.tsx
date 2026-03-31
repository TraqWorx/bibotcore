'use client'

import { useState, useEffect } from 'react'
import LoginAsButton from './LoginAsButton'

interface Profile {
  id: string
  email: string | null
  role: string | null
  created_at: string | null
}

interface LocationRole {
  userId: string
  role: string
}

const CRM_ROLES = ['location_admin', 'team_member', 'viewer'] as const

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function UsersAndRoles({ locationId, profiles }: { locationId: string; profiles: Profile[] }) {
  const [roles, setRoles] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => { loadRoles() }, [locationId])

  async function loadRoles() {
    setLoading(true)
    const res = await fetch('/api/admin/roles')
    if (res.ok) {
      const data = await res.json()
      const map = new Map<string, string>()
      for (const u of (data.users ?? []) as { userId: string; locationId: string; role: string }[]) {
        if (u.locationId === locationId) map.set(u.userId, u.role)
      }
      setRoles(map)
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
      setRoles((prev) => new Map(prev).set(userId, newRole))
      setMessage('Ruolo aggiornato')
    } else {
      setMessage('Errore')
    }
    setUpdating(null)
    setTimeout(() => setMessage(null), 2000)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">
            Utenti
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              {profiles.length}
            </span>
          </h2>
          <p className="text-[10px] text-gray-400 mt-0.5">Sincronizzati da GHL. Ruoli CRM modificabili qui.</p>
        </div>
        {message && (
          <span className="text-xs font-medium text-green-600">{message}</span>
        )}
      </div>
      {profiles.length === 0 ? (
        <p className="p-6 text-sm text-gray-400">Nessun utente per questa location.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Email</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Piattaforma</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Ruolo CRM</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Registrato</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {profiles.map((p) => {
              const crmRole = roles.get(p.id)
              return (
                <tr key={p.id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3 font-medium text-gray-800">{p.email ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.role === 'super_admin' ? 'bg-red-50 text-red-600' :
                      p.role === 'agency' ? 'bg-amber-50 text-amber-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {p.role ?? 'client'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {loading ? (
                      <span className="inline-block h-6 w-20 animate-pulse rounded-lg bg-gray-100" />
                    ) : crmRole ? (
                      <select
                        value={crmRole}
                        onChange={(e) => handleRoleChange(p.id, e.target.value)}
                        disabled={updating === p.id || p.role === 'super_admin'}
                        className={`rounded-lg border px-2 py-1 text-[11px] font-semibold outline-none ${
                          crmRole === 'location_admin' ? 'border-purple-200 bg-purple-50 text-purple-700' :
                          crmRole === 'viewer' ? 'border-gray-200 bg-gray-50 text-gray-600' :
                          'border-blue-200 bg-blue-50 text-blue-700'
                        }`}
                      >
                        {CRM_ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {p.created_at ? formatDate(p.created_at) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <LoginAsButton userId={p.id} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
