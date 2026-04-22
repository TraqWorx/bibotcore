'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ad } from '@/lib/admin/ui'

/** Format number as EUR without locale-dependent formatting (avoids hydration mismatch) */
function formatEur(n: number): string {
  const fixed = n.toFixed(2)
  const [int, dec] = fixed.split('.')
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${withDots},${dec}`
}
import ConnectButton from './ConnectButton'
import DisconnectButton from './DisconnectButton'
import ChangeDesignButton from './ChangeDesignButton'
import ReauthorizeButton from './ReauthorizeButton'
import SubscribeButton from './SubscribeButton'
import ConnectLocationButton from './ConnectLocationButton'
import CancelSubscriptionButton from './CancelSubscriptionButton'
import ActivateButton from './ActivateButton'

interface LocationRow {
  id: string
  name: string
  connected: boolean
  subscribed: boolean
  users: number
  design: string | null
  dashboard: { token: string; widgetCount: number } | null
  needsOAuth: boolean
  dateAdded: string | null
  planId: string | null
  planName: string | null
  planPrice: number | null
  totalPaid: number | null
  totalPaidVat: number | null
  churned: boolean
}

interface Props {
  rows: LocationRow[]
  designs: { slug: string; name: string }[]
  unconnectedLocations: { id: string; name: string }[]
  plans?: { ghl_plan_id: string; name: string; price_monthly: number | null }[]
}

type SortCol = 'name' | 'dateAdded' | 'connected' | 'users' | 'design' | 'plan' | 'price' | 'totalPaid' | 'totalPaidVat'
type SortDir = 'asc' | 'desc'

interface HeaderCellProps {
  col: SortCol
  children: React.ReactNode
  sortCol: SortCol
  sortDir: SortDir
  onToggle: (col: SortCol) => void
  align?: 'right'
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-0.5 text-gray-300">↕</span>
  return <span className="ml-0.5 text-brand">{dir === 'asc' ? '↑' : '↓'}</span>
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

function HeaderCell({ col, children, sortCol, sortDir, onToggle, align }: HeaderCellProps) {
  return (
    <th
      onClick={() => onToggle(col)}
      className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 cursor-pointer select-none hover:text-gray-600 whitespace-nowrap transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
      <SortIcon active={sortCol === col} dir={sortDir} />
    </th>
  )
}

export default function LocationsTable({ rows, designs, unconnectedLocations, plans }: Props) {
  const [search, setSearch] = useState('')
  const [connectedFilter, setConnectedFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [usersFilter, setUsersFilter] = useState<'all' | 'with' | 'without'>('all')
  const [designFilter, setDesignFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const uniqueDesigns = useMemo(
    () => [...new Set(rows.map((r) => r.design).filter(Boolean))] as string[],
    [rows]
  )
  const hasDesigns = uniqueDesigns.length > 0

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
    setPage(1)
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
      else if (sortCol === 'totalPaid') cmp = (a.totalPaid ?? 0) - (b.totalPaid ?? 0)
      else if (sortCol === 'totalPaidVat') cmp = (a.totalPaidVat ?? 0) - (b.totalPaidVat ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, search, connectedFilter, usersFilter, designFilter, planFilter, dateFrom, dateTo, sortCol, sortDir])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIdx = (safePage - 1) * pageSize
  const endIdx = Math.min(total, startIdx + pageSize)
  const pageRows = filtered.slice(startIdx, endIdx)

  const hasDateFilter = dateFrom || dateTo
  const selectClass = 'rounded-xl border border-gray-200/90 bg-white px-3 py-1.5 text-xs text-gray-700 outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/10'

  return (
    <div className={ad.tableShell}>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-2.5">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-gray-200/90 bg-white px-3 py-1.5 shadow-sm">
          <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1) }} className="text-sm leading-none text-gray-400 hover:text-gray-600">×</button>
          )}
        </div>

        <select value={connectedFilter} onChange={(e) => { setConnectedFilter(e.target.value as 'all' | 'yes' | 'no'); setPage(1) }} className={selectClass}>
          <option value="all">All Status</option>
          <option value="yes">Connected</option>
          <option value="no">Not Connected</option>
        </select>

        <select value={usersFilter} onChange={(e) => { setUsersFilter(e.target.value as 'all' | 'with' | 'without'); setPage(1) }} className={selectClass}>
          <option value="all">All Users</option>
          <option value="with">Has Users</option>
          <option value="without">No Users</option>
        </select>

        {hasDesigns && (
          <select value={designFilter} onChange={(e) => { setDesignFilter(e.target.value); setPage(1) }} className={selectClass}>
            <option value="all">All Designs</option>
            <option value="__none__">No Design</option>
            {uniqueDesigns.map((slug) => (
              <option key={slug} value={slug}>{slug}</option>
            ))}
          </select>
        )}

        <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1) }} className={selectClass}>
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
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="w-[112px] bg-transparent text-xs text-gray-600 outline-none" title="From date" />
          <span className="text-gray-300">–</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="w-[112px] bg-transparent text-xs text-gray-600 outline-none" title="To date" />
          {hasDateFilter && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }} className="ml-1 text-sm leading-none text-gray-400 hover:text-gray-600">×</button>
          )}
        </div>

        <span className="ml-auto shrink-0 text-xs text-gray-400">
          {filtered.length} / {rows.length}
        </span>
      </div>

      {/* Table */}
      {total === 0 ? (
        <p className="p-8 text-center text-sm text-gray-400">No results match your filters.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className={ad.tableHeadRow}>
                  <th className="w-9 px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-400">#</th>
                  <HeaderCell col="name" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort}>Location</HeaderCell>
                  <HeaderCell col="dateAdded" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort}>Added</HeaderCell>
                  <HeaderCell col="connected" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort}>Status</HeaderCell>
                  <HeaderCell col="users" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort}>Users</HeaderCell>
                  {hasDesigns && <HeaderCell col="design" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort}>Design</HeaderCell>}
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-400 whitespace-nowrap">Dashboard</th>
                  <HeaderCell col="plan" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort}>Plan</HeaderCell>
                  <HeaderCell col="price" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort} align="right">Price</HeaderCell>
                  <HeaderCell col="totalPaid" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort} align="right">Total Paid</HeaderCell>
                  <HeaderCell col="totalPaidVat" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort} align="right">+ VAT 22%</HeaderCell>
                  <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-gray-400 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`transition-colors hover:bg-gray-50/70 ${row.churned ? 'bg-red-50/25' : ''}`}
                  >
                    <td className="px-3 py-3 text-xs text-gray-300 tabular-nums">{startIdx + i + 1}</td>
                    <td className="px-3 py-3 max-w-[260px]">
                      <Link
                        href={`/admin/locations/${row.id}`}
                        className="block truncate font-semibold text-brand hover:underline"
                        style={{ color: 'var(--brand)' }}
                        title={row.name}
                      >
                        {row.name}
                      </Link>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-gray-400" title={row.id}>
                        {row.id}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(row.dateAdded)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                          row.connected && !row.needsOAuth
                            ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800'
                            : row.connected && row.needsOAuth
                            ? 'border-amber-200 bg-amber-50/80 text-amber-800'
                            : 'border-gray-200 bg-gray-50 text-gray-500'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            row.connected && !row.needsOAuth ? 'bg-emerald-500'
                            : row.connected && row.needsOAuth ? 'bg-amber-500'
                            : 'bg-gray-300'
                          }`}
                        />
                        {row.connected && row.needsOAuth ? 'OAuth' : row.connected ? 'Active' : 'Off'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-xs font-semibold tabular-nums text-gray-700">
                      {row.users > 0 ? row.users : <span className="text-gray-300">0</span>}
                    </td>
                    {hasDesigns && (
                      <td className="px-3 py-3">
                        {row.design ? (
                          <ChangeDesignButton locationId={row.id} currentSlug={row.design} designs={designs}>
                            {row.design}
                          </ChangeDesignButton>
                        ) : row.connected ? (
                          <ChangeDesignButton locationId={row.id} currentSlug="" designs={designs}>
                            <span className="text-xs text-gray-400">Assign</span>
                          </ChangeDesignButton>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                    )}
                    <td className="px-3 py-3">
                      {row.connected && row.subscribed ? (
                        <Link
                          href={`/admin/locations/${row.id}/widgets`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 shadow-sm transition hover:border-brand/25 hover:text-brand"
                        >
                          {row.dashboard && row.dashboard.widgetCount > 0 ? (
                            <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{row.dashboard.widgetCount} widgets</>
                          ) : (
                            'Configure'
                          )}
                        </Link>
                      ) : !hasDesigns && row.subscribed && !row.connected ? (
                        <ConnectLocationButton locationId={row.id} size="small" />
                      ) : !hasDesigns && !row.subscribed ? (
                        <SubscribeButton locationId={row.id} />
                      ) : (
                        <span className="text-[11px] text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">
                      {row.churned
                        ? <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">Churned</span>
                        : row.planName ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-3 py-3 text-right text-xs font-bold tabular-nums whitespace-nowrap ${row.planPrice != null ? 'text-emerald-700' : 'text-gray-400'}`}>
                      {row.planPrice != null
                        ? `€${formatEur(row.planPrice)}/mo`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-3 py-3 text-right text-xs font-bold tabular-nums whitespace-nowrap ${row.totalPaid != null && row.totalPaid > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                      {row.totalPaid != null
                        ? `€${formatEur(row.totalPaid)}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs tabular-nums text-right whitespace-nowrap text-gray-400">
                      {row.totalPaidVat != null
                        ? `€${formatEur(row.totalPaidVat)}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {hasDesigns ? (
                          <div className="flex items-center gap-1">
                            {!row.planId && <ActivateButton locationId={row.id} currentPlanId={row.planId} plans={plans ?? []} />}
                            {row.connected && row.needsOAuth && row.design && <ReauthorizeButton designSlug={row.design} />}
                            {row.connected && <DisconnectButton locationId={row.id} />}
                            {!row.connected && <ConnectButton designs={designs} unconnectedLocations={unconnectedLocations} preselectedId={row.id} />}
                          </div>
                        ) : row.subscribed ? (
                          <CancelSubscriptionButton locationId={row.id} />
                        ) : null}
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
