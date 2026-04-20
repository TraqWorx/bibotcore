'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

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
    setPage(1)
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

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIdx = (safePage - 1) * pageSize
  const endIdx = Math.min(total, startIdx + pageSize)
  const pageRows = filtered.slice(startIdx, endIdx)

  const thClass = 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap'

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
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1) }} className="text-base leading-none text-gray-400 hover:text-gray-600">×</button>
          )}
        </div>

        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
          className="rounded-xl border border-gray-200/90 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
        >
          <option value="all">All Roles</option>
          {uniqueRoles.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>

        <select
          value={locationFilter}
          onChange={(e) => { setLocationFilter(e.target.value as 'all' | 'with' | 'without'); setPage(1) }}
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
      {total === 0 ? (
        <p className="p-6 text-sm text-gray-400">No results match your filters.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
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
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-400 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">{startIdx + i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{row.email ?? '—'}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-gray-400">{row.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        row.role === 'super_admin'
                          ? 'border-purple-200 bg-purple-50/80 text-purple-800'
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}>
                        {row.role ?? 'user'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.locations.length === 0 ? (
                        <span className="text-gray-300">—</span>
                      ) : row.locations.length === 1 ? (
                        <div className="min-w-0">
                          <div className="truncate font-medium text-gray-700">{row.locations[0].name}</div>
                          <div className="mt-0.5 truncate font-mono text-[10px] text-gray-400">{row.locations[0].id}</div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          <span className="rounded-full border border-brand/20 bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
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
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2 flex-nowrap">
                        {row.role !== 'super_admin' && (
                          <Link
                            href={`/agency?as=${row.id}`}
                            target="_blank"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-brand/25 bg-brand/5 px-3 py-1.5 text-xs font-bold text-brand shadow-sm transition hover:bg-brand/10"
                          >
                            Login as
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-white/70 px-4 py-3">
            <div className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-900">{startIdx + 1}</span>–<span className="font-semibold text-gray-900">{endIdx}</span> of{' '}
              <span className="font-semibold text-gray-900">{total}</span>
              {totalPages > 1 && (
                <>
                  {' '}• Page <span className="font-semibold text-gray-900">{safePage}</span> / <span className="font-semibold text-gray-900">{totalPages}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="rounded-xl border border-gray-200/90 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                aria-label="Rows per page"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}/page</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className={`${ad.btnSecondary} px-2.5 py-1.5 text-xs disabled:opacity-40`}
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className={`${ad.btnSecondary} px-2.5 py-1.5 text-xs disabled:opacity-40`}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
