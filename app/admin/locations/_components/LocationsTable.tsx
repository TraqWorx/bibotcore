'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import ConnectButton from './ConnectButton'
import DisconnectButton from './DisconnectButton'
import ChangeDesignButton from './ChangeDesignButton'
import ReauthorizeButton from './ReauthorizeButton'

interface LocationRow {
  id: string
  name: string
  connected: boolean
  users: number
  design: string | null
  needsOAuth: boolean
  dateAdded: string | null
  planId: string | null
  planName: string | null
  planPrice: number | null
  churned: boolean
}

interface Props {
  rows: LocationRow[]
  designs: { slug: string; name: string }[]
  unconnectedLocations: { id: string; name: string }[]
}

type SortCol = 'name' | 'dateAdded' | 'connected' | 'users' | 'design' | 'plan' | 'price'
type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-gray-300">↕</span>
  return <span className="ml-1" style={{ color: '#2A00CC' }}>{dir === 'asc' ? '↑' : '↓'}</span>
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function LocationsTable({ rows, designs, unconnectedLocations }: Props) {
  const [search, setSearch] = useState('')
  const [connectedFilter, setConnectedFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [usersFilter, setUsersFilter] = useState<'all' | 'with' | 'without'>('all')
  const [designFilter, setDesignFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const uniqueDesigns = useMemo(
    () => [...new Set(rows.map((r) => r.design).filter(Boolean))] as string[],
    [rows]
  )

  const uniquePlans = useMemo(
    () => [...new Map(rows.filter((r) => r.planId && r.planName).map((r) => [r.planId, r.planName])).entries()]
      .map(([id, name]) => ({ id: id!, name: name! }))
      .sort((a, b) => a.name.localeCompare(b.name)),
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
    const from = dateFrom ? new Date(dateFrom) : null
    const to = dateTo ? new Date(dateTo + 'T23:59:59') : null

    const base = rows.filter((row) => {
      if (q && !row.name.toLowerCase().includes(q) && !row.id.toLowerCase().includes(q)) return false
      if (connectedFilter === 'yes' && !row.connected) return false
      if (connectedFilter === 'no' && row.connected) return false
      if (usersFilter === 'with' && row.users === 0) return false
      if (usersFilter === 'without' && row.users > 0) return false
      if (designFilter === '__none__' && row.design !== null) return false
      if (designFilter !== 'all' && designFilter !== '__none__' && row.design !== designFilter) return false
      if (planFilter === '__none__' && row.planId !== null) return false
      if (planFilter !== 'all' && planFilter !== '__none__' && row.planId !== planFilter) return false
      if (from || to) {
        const d = row.dateAdded ? new Date(row.dateAdded) : null
        if (!d || isNaN(d.getTime())) return false
        if (from && d < from) return false
        if (to && d > to) return false
      }
      return true
    })

    return [...base].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortCol === 'dateAdded') cmp = (a.dateAdded ?? '').localeCompare(b.dateAdded ?? '')
      else if (sortCol === 'connected') cmp = Number(b.connected) - Number(a.connected)
      else if (sortCol === 'users') cmp = a.users - b.users
      else if (sortCol === 'design') cmp = (a.design ?? '').localeCompare(b.design ?? '')
      else if (sortCol === 'plan') cmp = (a.planName ?? '').localeCompare(b.planName ?? '')
      else if (sortCol === 'price') cmp = (a.planPrice ?? 0) - (b.planPrice ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, search, connectedFilter, usersFilter, designFilter, planFilter, dateFrom, dateTo, sortCol, sortDir])

  const hasDateFilter = dateFrom || dateTo
  const thClass = 'px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap transition-colors'
  const selectClass = 'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 outline-none'

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
          <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-base leading-none text-gray-400 hover:text-gray-600">×</button>
          )}
        </div>

        <select value={connectedFilter} onChange={(e) => setConnectedFilter(e.target.value as 'all' | 'yes' | 'no')} className={selectClass}>
          <option value="all">All Status</option>
          <option value="yes">Connected</option>
          <option value="no">Not Connected</option>
        </select>

        <select value={usersFilter} onChange={(e) => setUsersFilter(e.target.value as 'all' | 'with' | 'without')} className={selectClass}>
          <option value="all">All Users</option>
          <option value="with">Has Users</option>
          <option value="without">No Users</option>
        </select>

        <select value={designFilter} onChange={(e) => setDesignFilter(e.target.value)} className={selectClass}>
          <option value="all">All Designs</option>
          <option value="__none__">No Design</option>
          {uniqueDesigns.map((slug) => (
            <option key={slug} value={slug}>{slug}</option>
          ))}
        </select>

        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className={selectClass}>
          <option value="all">All Plans</option>
          <option value="__none__">No Plan</option>
          {uniquePlans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
          <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
          </svg>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[112px] bg-transparent text-xs text-gray-600 outline-none" title="From date" />
          <span className="text-gray-300">–</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[112px] bg-transparent text-xs text-gray-600 outline-none" title="To date" />
          {hasDateFilter && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }} className="ml-1 text-base leading-none text-gray-400 hover:text-gray-600">×</button>
          )}
        </div>

        <span className="ml-auto shrink-0 text-xs text-gray-400">
          {filtered.length} / {rows.length}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="p-8 text-center text-sm text-gray-400">No results match your filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-10 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">#</th>
                <th className={thClass} onClick={() => toggleSort('name')}>
                  Location <SortIcon active={sortCol === 'name'} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort('dateAdded')}>
                  Added <SortIcon active={sortCol === 'dateAdded'} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort('connected')}>
                  Status <SortIcon active={sortCol === 'connected'} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort('users')}>
                  Users <SortIcon active={sortCol === 'users'} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort('design')}>
                  Design <SortIcon active={sortCol === 'design'} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort('plan')}>
                  Plan <SortIcon active={sortCol === 'plan'} dir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort('price')}>
                  Price <SortIcon active={sortCol === 'price'} dir={sortDir} />
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3.5 text-xs text-gray-400 tabular-nums">{i + 1}</td>
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/admin/locations/${row.id}`}
                      className="font-medium hover:underline"
                      style={{ color: '#2A00CC' }}
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(row.dateAdded)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      row.connected && !row.needsOAuth
                        ? 'bg-emerald-50 text-emerald-700'
                        : row.connected && row.needsOAuth
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        row.connected && !row.needsOAuth ? 'bg-emerald-500'
                        : row.connected && row.needsOAuth ? 'bg-amber-500'
                        : 'bg-gray-300'
                      }`} />
                      {row.connected && row.needsOAuth ? 'Needs OAuth' : row.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs tabular-nums text-gray-600">
                    {row.users > 0 ? row.users : <span className="text-gray-300">0</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {row.design ? (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                        {row.design}
                      </span>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-600">
                    {row.churned
                      ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">Churned</span>
                      : row.planName ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-semibold tabular-nums" style={{ color: row.planPrice != null ? '#0e9f6e' : undefined }}>
                    {row.planPrice != null
                      ? `€${row.planPrice.toLocaleString('it-IT')}/mo`
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.connected ? (
                        <>
                          {row.needsOAuth && row.design && (
                            <ReauthorizeButton designSlug={row.design} />
                          )}
                          <ChangeDesignButton locationId={row.id} currentSlug={row.design} designs={designs} />
                          <DisconnectButton locationId={row.id} />
                        </>
                      ) : (
                        <ConnectButton designs={designs} unconnectedLocations={unconnectedLocations} preselectedId={row.id} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
