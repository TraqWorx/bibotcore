'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { deleteUser } from '../_actions'
import { ad } from '@/lib/admin/ui'

interface UserLocation {
  id: string
  name: string
}

interface UserRow {
  id: string
  email: string | null
  role: string | null
  locations: UserLocation[]
  createdAt: string | null
}

type SortCol = 'email' | 'role' | 'location' | 'joined'
type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-gray-300">↕</span>
  return <span className="ml-1 text-brand">{dir === 'asc' ? '↑' : '↓'}</span>
}

export default function UsersTable({ rows }: { rows: UserRow[] }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState<'all' | 'with' | 'without'>('all')
  const [sortCol, setSortCol] = useState<SortCol>('email')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const uniqueRoles = useMemo(
    () => [...new Set(rows.map((r) => r.role).filter(Boolean))] as string[],
    [rows]
  )

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const base = rows.filter((row) => {
      if (q) {
        const emailMatch = row.email?.toLowerCase().includes(q) ?? false
        const locMatch = row.locations.some((l) => l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q))
        if (!emailMatch && !locMatch) return false
      }
      if (roleFilter !== 'all' && row.role !== roleFilter) return false
      if (locationFilter === 'with' && row.locations.length === 0) return false
      if (locationFilter === 'without' && row.locations.length > 0) return false
      return true
    })

    return [...base].sort((a, b) => {
      let aVal = ''
      let bVal = ''
      if (sortCol === 'email') { aVal = a.email ?? ''; bVal = b.email ?? '' }
      else if (sortCol === 'role') { aVal = a.role ?? ''; bVal = b.role ?? '' }
      else if (sortCol === 'location') { aVal = a.locations[0]?.name ?? ''; bVal = b.locations[0]?.name ?? '' }
      else if (sortCol === 'joined') { aVal = a.createdAt ?? ''; bVal = b.createdAt ?? '' }
      const cmp = aVal.localeCompare(bVal)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, search, roleFilter, locationFilter, sortCol, sortDir])

  const thClass = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap'

  return (
    <div className={ad.tableShell}>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/50 px-4 py-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-gray-200/90 bg-white px-3 py-1.5 shadow-sm">
          <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            placeholder="Search by email or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-base leading-none text-gray-400 hover:text-gray-600">×</button>
          )}
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl border border-gray-200/90 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
        >
          <option value="all">All Roles</option>
          {uniqueRoles.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>

        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value as 'all' | 'with' | 'without')}
          className="rounded-xl border border-gray-200/90 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
        >
          <option value="all">All Locations</option>
          <option value="with">Has Location</option>
          <option value="without">No Location</option>
        </select>

        <span className="ml-auto shrink-0 text-xs text-gray-400">
          {filtered.length} / {rows.length}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="p-6 text-sm text-gray-400">No results match your filters.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className={ad.tableHeadRow}>
              <th className="w-10 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">#</th>
              <th className={thClass} onClick={() => toggleSort('email')}>
                User <SortIcon active={sortCol === 'email'} dir={sortDir} />
              </th>
              <th className={thClass} onClick={() => toggleSort('role')}>
                Role <SortIcon active={sortCol === 'role'} dir={sortDir} />
              </th>
              <th className={thClass} onClick={() => toggleSort('location')}>
                Locations <SortIcon active={sortCol === 'location'} dir={sortDir} />
              </th>
              <th className={thClass} onClick={() => toggleSort('joined')}>
                Joined <SortIcon active={sortCol === 'joined'} dir={sortDir} />
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={row.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{row.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    row.role === 'super_admin' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {row.role ?? 'user'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {row.locations.length === 0 ? (
                    <span className="text-gray-300">—</span>
                  ) : row.locations.length === 1 ? (
                    <span className="text-gray-500">{row.locations[0].name}</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                        {row.locations.length} locations
                      </span>
                      <span className="text-xs text-gray-400 truncate max-w-[200px]">
                        {row.locations.map((l) => l.name).join(', ')}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    {row.role !== 'super_admin' && (
                      <Link
                        href={`/agency?as=${row.id}`}
                        target="_blank"
                        className="text-xs font-medium text-violet-600 transition-colors hover:text-violet-900"
                      >
                        Login
                      </Link>
                    )}
                    {row.role !== 'super_admin' && (
                      <Link
                        href={`/admin/users/${row.id}`}
                        className="text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
                      >
                        View →
                      </Link>
                    )}
                    {row.role !== 'super_admin' && (
                      <form action={deleteUser.bind(null, row.id) as unknown as string}>
                        <button
                          type="submit"
                          className="text-xs font-medium text-gray-400 transition-colors hover:text-red-600"
                        >
                          Delete
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
