'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { type CategoryDef } from '@/lib/utils/categoryFields'

interface Props {
  locationId: string
  categories: CategoryDef[]
  allTags: string[]
  gestoreOptions: string[]
  activeCategory: string | null
  activeTag: string | null  // comma-separated for multi-select
  activeGestore: string | null
  dateFrom: string | null
  dateTo: string | null
  scadenzaFrom: string | null
  scadenzaTo: string | null
  search: string | null
}

const CATEGORY_STYLES: Record<string, { bg: string; activeBg: string; text: string; activeText: string; border: string; dot: string }> = {
  telefonia:           { bg: 'bg-blue-50/60',   activeBg: 'bg-blue-100',   text: 'text-blue-600',   activeText: 'text-blue-800',   border: 'border-blue-200',   dot: 'bg-blue-400' },
  energia:             { bg: 'bg-amber-50/60',  activeBg: 'bg-amber-100',  text: 'text-amber-600',  activeText: 'text-amber-800',  border: 'border-amber-200',  dot: 'bg-amber-400' },
  'connettivita-casa': { bg: 'bg-emerald-50/60', activeBg: 'bg-emerald-100', text: 'text-emerald-600', activeText: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-400' },
  connettivita:        { bg: 'bg-emerald-50/60', activeBg: 'bg-emerald-100', text: 'text-emerald-600', activeText: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-400' },
  intrattenimento:     { bg: 'bg-purple-50/60', activeBg: 'bg-purple-100', text: 'text-purple-600', activeText: 'text-purple-800', border: 'border-purple-200', dot: 'bg-purple-400' },
}

const DEFAULT_CAT_STYLE = { bg: 'bg-gray-50/60', activeBg: 'bg-gray-100', text: 'text-gray-500', activeText: 'text-gray-800', border: 'border-gray-200', dot: 'bg-gray-400' }

export default function ContactsFilters({
  locationId, categories, allTags, gestoreOptions,
  activeCategory, activeTag, activeGestore,
  dateFrom, dateTo, scadenzaFrom, scadenzaTo, search,
}: Props) {
  const router = useRouter()
  const [from, setFrom] = useState(dateFrom ?? '')
  const [to, setTo] = useState(dateTo ?? '')
  const [scFrom, setScFrom] = useState(scadenzaFrom ?? '')
  const [scTo, setScTo] = useState(scadenzaTo ?? '')
  const [query, setQuery] = useState(search ?? '')
  const [showDates, setShowDates] = useState(!!(dateFrom || dateTo || scadenzaFrom || scadenzaTo))

  function buildUrl(overrides: Record<string, string | null | undefined>) {
    const params = new URLSearchParams({ locationId })
    const vals: Record<string, string | null> = {
      category: activeCategory,
      tag: activeTag,
      gestore: activeGestore,
      dateFrom,
      dateTo,
      scadenzaFrom,
      scadenzaTo,
      search,
    }
    for (const [k, v] of Object.entries(overrides)) {
      vals[k] = v ?? null
    }
    for (const [k, v] of Object.entries(vals)) {
      if (v) params.set(k, v)
    }
    return `/designs/simfonia/contacts?${params}`
  }

  function handleSearch() {
    router.push(buildUrl({ search: query.trim() || null }))
  }

  const selectedTags = activeTag ? activeTag.split(',') : []
  const hasFilters = !!(activeCategory || activeTag || activeGestore || dateFrom || dateTo || scadenzaFrom || scadenzaTo || search)

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Cerca per nome, email, telefono..."
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-24 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.1)]"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-1.5">
          {search && (
            <button
              onClick={() => { setQuery(''); router.push(buildUrl({ search: null })) }}
              className="rounded-lg px-2 py-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={handleSearch}
            className="rounded-lg bg-[#2A00CC] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#2200aa]"
          >
            Cerca
          </button>
        </div>
      </div>

      {/* Category pills — multi-select */}
      <div className="flex flex-wrap items-center gap-2">
        {(() => {
          const selectedSlugs = activeCategory ? activeCategory.split(',').filter(Boolean) : []
          return (
            <>
              <button
                onClick={() => router.push(buildUrl({ category: null, tag: null, gestore: null, scadenzaFrom: null, scadenzaTo: null }))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  selectedSlugs.length === 0
                    ? 'border-[#2A00CC] bg-[#2A00CC] text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                Tutte
              </button>
              {categories.map((cat) => {
                const isActive = selectedSlugs.includes(cat.slug)
                const s = CATEGORY_STYLES[cat.slug] ?? DEFAULT_CAT_STYLE
                return (
                  <button
                    key={cat.slug}
                    onClick={() => {
                      const next = isActive
                        ? selectedSlugs.filter((s) => s !== cat.slug)
                        : [...selectedSlugs, cat.slug]
                      router.push(buildUrl({
                        category: next.length > 0 ? next.join(',') : null,
                        tag: null, gestore: null, scadenzaFrom: null, scadenzaTo: null,
                      }))
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      isActive
                        ? `${s.activeBg} ${s.activeText} ${s.border} shadow-sm`
                        : `border-gray-200 bg-white ${s.text} hover:${s.bg}`
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                    {cat.label}
                  </button>
                )
              })}
            </>
          )
        })()}

        {/* Separator */}
        {(allTags.length > 0 || gestoreOptions.length > 0) && (
          <div className="mx-1 h-5 w-px bg-gray-200" />
        )}

        {/* Tag multi-select */}
        {allTags.length > 0 && (
          <TagMultiSelect
            allTags={allTags}
            selectedTags={selectedTags}
            onChange={(tags) => router.push(buildUrl({ tag: tags.length > 0 ? tags.join(',') : null }))}
          />
        )}

        {/* Gestore dropdown */}
        {gestoreOptions.length > 0 && (
          <div className="relative">
            <select
              value={activeGestore ?? ''}
              onChange={(e) => router.push(buildUrl({ gestore: e.target.value || null }))}
              className={`appearance-none rounded-full border py-1.5 pl-3 pr-7 text-xs font-semibold outline-none transition-all ${
                activeGestore
                  ? 'border-[#2A00CC] bg-[rgba(42,0,204,0.05)] text-[#2A00CC]'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <option value="">Gestore</option>
              {gestoreOptions.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        )}

        {/* Date toggle */}
        <button
          onClick={() => setShowDates(!showDates)}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
            dateFrom || dateTo || scadenzaFrom || scadenzaTo
              ? 'border-[#2A00CC] bg-[rgba(42,0,204,0.05)] text-[#2A00CC]'
              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          Date
          {showDates && (
            <svg className="h-3 w-3 rotate-180" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          )}
        </button>

        {/* Clear all */}
        {hasFilters && (
          <button
            onClick={() => router.push(buildUrl({
              category: null, tag: null, gestore: null,
              dateFrom: null, dateTo: null, scadenzaFrom: null, scadenzaTo: null, search: null,
            }))}
            className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-all hover:bg-red-100"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            Rimuovi filtri
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {search && (
            <FilterChip
              label={`"${search}"`}
              onRemove={() => { setQuery(''); router.push(buildUrl({ search: null })) }}
            />
          )}
          {activeGestore && (
            <FilterChip
              label={`Gestore: ${activeGestore}`}
              onRemove={() => router.push(buildUrl({ gestore: null }))}
            />
          )}
          {selectedTags.map((tag) => (
            <FilterChip
              key={tag}
              label={tag}
              onRemove={() => {
                const next = selectedTags.filter((t) => t !== tag)
                router.push(buildUrl({ tag: next.length > 0 ? next.join(',') : null }))
              }}
            />
          ))}
          {dateFrom && (
            <FilterChip
              label={`Da: ${formatDateLabel(dateFrom)}`}
              onRemove={() => { setFrom(''); router.push(buildUrl({ dateFrom: null })) }}
            />
          )}
          {dateTo && (
            <FilterChip
              label={`A: ${formatDateLabel(dateTo)}`}
              onRemove={() => { setTo(''); router.push(buildUrl({ dateTo: null })) }}
            />
          )}
          {scadenzaFrom && (
            <FilterChip
              label={`Scadenza da: ${formatDateLabel(scadenzaFrom)}`}
              onRemove={() => { setScFrom(''); router.push(buildUrl({ scadenzaFrom: null })) }}
            />
          )}
          {scadenzaTo && (
            <FilterChip
              label={`Scadenza a: ${formatDateLabel(scadenzaTo)}`}
              onRemove={() => { setScTo(''); router.push(buildUrl({ scadenzaTo: null })) }}
            />
          )}
        </div>
      )}

      {/* Collapsible date ranges */}
      {showDates && (
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
          <DateRangeGroup
            label="Data creazione"
            fromValue={from}
            toValue={to}
            onFromChange={setFrom}
            onToChange={setTo}
            onApply={() => router.push(buildUrl({ dateFrom: from || null, dateTo: to || null }))}
            onReset={(dateFrom || dateTo) ? () => { setFrom(''); setTo(''); router.push(buildUrl({ dateFrom: null, dateTo: null })) } : undefined}
            canApply={!!(from || to)}
          />
          <div className="mx-2 hidden h-8 w-px bg-gray-200 sm:block" />
          <DateRangeGroup
            label="Scadenza"
            fromValue={scFrom}
            toValue={scTo}
            onFromChange={setScFrom}
            onToChange={setScTo}
            onApply={() => router.push(buildUrl({ scadenzaFrom: scFrom || null, scadenzaTo: scTo || null }))}
            onReset={(scadenzaFrom || scadenzaTo) ? () => { setScFrom(''); setScTo(''); router.push(buildUrl({ scadenzaFrom: null, scadenzaTo: null })) } : undefined}
            canApply={!!(scFrom || scTo)}
          />
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-gray-600">
      {label}
      <button
        onClick={onRemove}
        className="flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
      >
        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  )
}

function DateRangeGroup({
  label, fromValue, toValue, onFromChange, onToChange, onApply, onReset, canApply,
}: {
  label: string
  fromValue: string
  toValue: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onApply: () => void
  onReset?: () => void
  canApply: boolean
}) {
  return (
    <div className="flex items-end gap-2">
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={fromValue}
            onChange={(e) => onFromChange(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs outline-none transition-all focus:border-[#2A00CC] focus:ring-1 focus:ring-[rgba(42,0,204,0.1)]"
          />
          <span className="text-[10px] text-gray-400">—</span>
          <input
            type="date"
            value={toValue}
            onChange={(e) => onToChange(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs outline-none transition-all focus:border-[#2A00CC] focus:ring-1 focus:ring-[rgba(42,0,204,0.1)]"
          />
        </div>
      </div>
      <button
        onClick={onApply}
        disabled={!canApply}
        className="rounded-lg bg-[#2A00CC] px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-[#2200aa] disabled:opacity-30"
      >
        Applica
      </button>
      {onReset && (
        <button
          onClick={onReset}
          className="rounded-lg px-2 py-1.5 text-[11px] text-gray-400 transition-colors hover:text-gray-600"
        >
          Reset
        </button>
      )}
    </div>
  )
}

function formatDateLabel(d: string): string {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  } catch {
    return d
  }
}

function TagMultiSelect({
  allTags,
  selectedTags,
  onChange,
}: {
  allTags: string[]
  selectedTags: string[]
  onChange: (tags: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function toggle(tag: string) {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag]
    onChange(next)
  }

  const filteredTags = tagSearch
    ? allTags.filter((t) => t.toLowerCase().includes(tagSearch.toLowerCase()))
    : allTags

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
          selectedTags.length > 0
            ? 'border-[#2A00CC] bg-[rgba(42,0,204,0.05)] text-[#2A00CC]'
            : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
        }`}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
        </svg>
        {selectedTags.length > 0 ? `${selectedTags.length} tag` : 'Tag'}
        <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-xl">
          {/* Search within tags */}
          <div className="border-b border-gray-100 px-3 py-2">
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="Cerca tag..."
              className="w-full rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1.5 text-xs outline-none placeholder:text-gray-400 focus:border-[#2A00CC]"
              autoFocus
            />
          </div>

          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full items-center gap-1.5 border-b border-gray-100 px-3 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Rimuovi tutti
            </button>
          )}

          <div className="max-h-56 overflow-y-auto py-1">
            {filteredTags.length === 0 && (
              <p className="px-3 py-3 text-center text-xs text-gray-400 italic">Nessun tag trovato</p>
            )}
            {filteredTags.map((tag) => {
              const isSelected = selectedTags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors hover:bg-gray-50 ${
                    isSelected ? 'font-semibold' : ''
                  }`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] transition-colors ${
                    isSelected ? 'border-[#2A00CC] bg-[#2A00CC] text-white' : 'border-gray-300'
                  }`}>
                    {isSelected ? '✓' : ''}
                  </span>
                  <span className={isSelected ? 'text-[#2A00CC]' : 'text-gray-700'}>{tag}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
