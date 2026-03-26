'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  locationId: string
  filterTags: string[]
  activeFilter: string | null
  dateFrom: string | null
  dateTo: string | null
  search: string | null
}

export default function ContactsFilters({ locationId, filterTags, activeFilter, dateFrom, dateTo, search }: Props) {
  const router = useRouter()
  const [from, setFrom] = useState(dateFrom ?? '')
  const [to, setTo] = useState(dateTo ?? '')
  const [query, setQuery] = useState(search ?? '')

  function buildUrl(overrides: { filter?: string | null; dateFrom?: string | null; dateTo?: string | null; search?: string | null }) {
    const params = new URLSearchParams({ locationId })
    const f = overrides.filter !== undefined ? overrides.filter : activeFilter
    const df = overrides.dateFrom !== undefined ? overrides.dateFrom : dateFrom
    const dt = overrides.dateTo !== undefined ? overrides.dateTo : dateTo
    const s = overrides.search !== undefined ? overrides.search : search
    if (f) params.set('filter', f)
    if (df) params.set('dateFrom', df)
    if (dt) params.set('dateTo', dt)
    if (s) params.set('search', s)
    return `/designs/simfonia/contacts?${params}`
  }

  function applyDateRange() {
    router.push(buildUrl({ dateFrom: from || null, dateTo: to || null }))
  }

  function clearDates() {
    setFrom('')
    setTo('')
    router.push(buildUrl({ dateFrom: null, dateTo: null }))
  }

  function handleSearch() {
    router.push(buildUrl({ search: query.trim() || null }))
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Cerca contatto per nome, email, telefono..."
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)] transition-all"
        />
        <button
          onClick={handleSearch}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: '#2A00CC' }}
        >
          Cerca
        </button>
        {search && (
          <button
            onClick={() => { setQuery(''); router.push(buildUrl({ search: null })) }}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-all"
          >
            Cancella
          </button>
        )}
      </div>

      {/* Tag chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => router.push(buildUrl({ filter: null }))}
          className="rounded-full border px-4 py-1.5 text-xs font-semibold transition-all"
          style={!activeFilter
            ? { background: '#2A00CC', color: 'white', borderColor: '#2A00CC' }
            : { background: 'white', color: '#374151', borderColor: '#e5e7eb' }
          }
        >
          Tutti
        </button>
        {filterTags.map((tag) => {
          const isActive = activeFilter?.toLowerCase() === tag.toLowerCase()
          return (
            <button
              key={tag}
              onClick={() => router.push(buildUrl({ filter: isActive ? null : tag }))}
              className="rounded-full border px-4 py-1.5 text-xs font-semibold transition-all capitalize"
              style={isActive
                ? { background: '#2A00CC', color: 'white', borderColor: '#2A00CC' }
                : { background: 'white', color: '#374151', borderColor: '#e5e7eb' }
              }
            >
              {tag}
            </button>
          )
        })}
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-400">Da</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#2A00CC] focus:ring-1 focus:ring-[rgba(42,0,204,0.15)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-400">A</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#2A00CC] focus:ring-1 focus:ring-[rgba(42,0,204,0.15)]"
          />
        </div>
        <button
          onClick={applyDateRange}
          disabled={!from && !to}
          className="rounded-lg px-4 py-1.5 text-xs font-bold text-black transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: '#00F0FF' }}
        >
          Filtra
        </button>
        {(dateFrom || dateTo) && (
          <button
            onClick={clearDates}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-all"
          >
            Cancella date
          </button>
        )}
      </div>
    </div>
  )
}
