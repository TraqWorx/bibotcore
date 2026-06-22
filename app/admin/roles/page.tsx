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

function roleBadgeClass(role: string): string {
  return role === 'location_admin' ? 'border-purple-200 bg-purple-50 text-purple-700'
    : role === 'viewer' ? 'border-gray-200 bg-gray-50 text-gray-600'
    : 'border-blue-200 bg-blue-50 text-blue-700'
}

export default function AdminRolesPage() {
  const [users, setUsers] = useState<LocationUser[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [loading, setLoading] = useState(true)

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
    const timer = setTimeout(() => { void loadData(false) }, 0)
    return () => clearTimeout(timer)
  }, [loadData])

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
        <h1 className={ad.pageTitle}>Ruoli</h1>
        <p className={ad.pageSubtitle}>Utenti e ruoli sono gestiti in GoHighLevel e sincronizzati automaticamente.</p>
      </div>

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

      {/* Users table (read-only) */}
      <div className={ad.tableShell}>
        <table className="w-full text-sm">
          <thead>
            <tr className={ad.tableHeadRow}>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Email</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Ruolo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredUsers.length === 0 && (
              <tr><td colSpan={2} className="px-5 py-8 text-center text-gray-400">Nessun utente per questa location</td></tr>
            )}
            {filteredUsers.map((u) => (
              <tr key={u.userId} className="hover:bg-gray-50/50">
                <td className="px-5 py-3 font-medium text-gray-800">{u.email}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${roleBadgeClass(u.role)}`}>
                    {u.role.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
