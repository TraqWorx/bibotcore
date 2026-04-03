'use client'

import { useState, useEffect, useTransition, useRef, useMemo, useDeferredValue, memo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { deleteContact } from '../_actions'
import { isSwitchOutOn } from '@/lib/utils/categoryFields'
import type { ContactColumn } from '../../settings/_actions'

const ContactDrawer = dynamic(() => import('./ContactDrawer'), {
  ssr: false,
  loading: () => null,
})

type Contact = Record<string, unknown> & { id: string }

/* ─── Tag colors ─── */

const TAG_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  energia:      { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  telefonia:    { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  windtre:      { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400' },
  wind:         { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400' },
  fastweb:      { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
  kena:         { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-400' },
  connettivita: { bg: 'bg-teal-50',   text: 'text-teal-700',   dot: 'bg-teal-400' },
  luce:         { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  gas:          { bg: 'bg-amber-50',  text: 'text-amber-800',  dot: 'bg-amber-500' },
}

const PASTEL_PALETTE: { bg: string; text: string; dot: string }[] = [
  { bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-400' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-400' },
  { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-400' },
  { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-400' },
  { bg: 'bg-teal-50',    text: 'text-teal-700',    dot: 'bg-teal-400' },
  { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  { bg: 'bg-pink-50',    text: 'text-pink-700',    dot: 'bg-pink-400' },
  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-400' },
  { bg: 'bg-lime-50',    text: 'text-lime-700',    dot: 'bg-lime-400' },
  { bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-400' },
  { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', dot: 'bg-fuchsia-400' },
  { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  { bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-400' },
  { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-400' },
  { bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-400' },
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

function getTagColors(tag: string): { bg: string; text: string; dot: string } {
  const explicit = TAG_COLORS[tag.toLowerCase()]
  if (explicit) return explicit
  return PASTEL_PALETTE[hashString(tag.toLowerCase()) % PASTEL_PALETTE.length]
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  telefonia:             { bg: 'bg-blue-100/80',    text: 'text-blue-800',    border: 'border-blue-200/80',    dot: 'bg-blue-500' },
  energia:               { bg: 'bg-amber-100/80',   text: 'text-amber-800',   border: 'border-amber-200/80',   dot: 'bg-amber-500' },
  'connettività casa':   { bg: 'bg-emerald-100/80', text: 'text-emerald-800', border: 'border-emerald-200/80', dot: 'bg-emerald-500' },
  connettivita:          { bg: 'bg-emerald-100/80', text: 'text-emerald-800', border: 'border-emerald-200/80', dot: 'bg-emerald-500' },
  intrattenimento:       { bg: 'bg-purple-100/80',  text: 'text-purple-800',  border: 'border-purple-200/80',  dot: 'bg-purple-500' },
}
const DEFAULT_CAT = { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', dot: 'bg-gray-400' }

/* ─── Types ─── */

interface CustomFieldDef {
  id: string
  name: string
  fieldKey: string
  dataType: string
  placeholder?: string
  picklistOptions?: string[]
}

interface Props {
  contacts: Contact[]
  locationId: string
  columns: ContactColumn[]
  customFields?: CustomFieldDef[]
  availableTags?: string[]
  categoryTags?: Record<string, string[]>
}

/* ─── Filter types ─── */

type ColumnFilter =
  | { type: 'text'; value: string }
  | { type: 'multi'; values: string[] }
  | { type: 'date'; from: string; to: string }

const DATE_FIELDS = new Set(['dateAdded', 'lastActivity', 'dateOfBirth', 'dateUpdated'])

function isFilterActive(f: ColumnFilter | undefined): boolean {
  if (!f) return false
  if (f.type === 'text') return f.value.trim() !== ''
  if (f.type === 'multi') return f.values.length > 0
  if (f.type === 'date') return f.from !== '' || f.to !== ''
  return false
}

function filterSummary(f: ColumnFilter): string {
  if (f.type === 'text') return f.value
  if (f.type === 'multi') return f.values.length === 1 ? f.values[0] : `${f.values.length} selezionati`
  if (f.type === 'date') {
    if (f.from && f.to) return `${fmtDateShort(f.from)} — ${fmtDateShort(f.to)}`
    if (f.from) return `da ${fmtDateShort(f.from)}`
    if (f.to) return `fino a ${fmtDateShort(f.to)}`
  }
  return ''
}

function fmtDateShort(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/* ─── Helpers ─── */

function formatDate(val: unknown): string {
  if (!val || typeof val !== 'string') return '—'
  const d = new Date(val)
  if (isNaN(d.getTime())) return String(val)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getCustomFieldValue(contact: Contact, fieldId: string): string {
  const cfArray = contact.customFields
  if (!Array.isArray(cfArray)) return ''
  const field = cfArray.find((f: Record<string, unknown>) => f.id === fieldId)
  if (!field) return ''
  const val = field.value ?? field.field_value ?? field.fieldValue ?? ''
  return String(val)
}

function formatCustomFieldValue(val: string): string {
  if (!val) return '—'
  if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-')
    return `${d}/${m}/${y}`
  }
  return val
}

/** Determine what kind of filter a column should use */
function getColumnFilterKind(col: ContactColumn, customFields: CustomFieldDef[]): 'multi' | 'text' | 'date' {
  // Built-in date fields
  if (DATE_FIELDS.has(col.key)) return 'date'
  // Tags always multi-select
  if (col.key === 'tags') return 'multi'
  // DND is boolean → multi
  if (col.key === 'dnd') return 'multi'
  // Custom fields
  if (col.type === 'custom') {
    const def = customFields.find((d) => d.id === col.key)
    if (def) {
      if (def.dataType === 'DATE') return 'date'
      if (def.dataType === 'SINGLE_OPTIONS' || def.dataType === 'CHECKBOX') return 'multi'
      // Categoria (comma-separated multi) → multi
      if (col.label === 'Categoria') return 'multi'
    }
  }
  // Everything else → text search
  return 'text'
}

/* ─── Cell rendering ─── */

function getCellValue(contact: Contact, col: ContactColumn, customFields?: CustomFieldDef[]): React.ReactNode {
  if (col.type === 'custom') {
    const raw = getCustomFieldValue(contact, col.key)
    if (col.label === 'Categoria' && raw) {
      const catValues = raw.split(',').map(s => s.trim()).filter(Boolean)
      return (
        <div className="flex flex-wrap gap-1">
          {catValues.map((cat) => {
            const soFieldName = `[${cat}] Switch Out`
            const cfArray = contact.customFields
            let isSo = false
            if (Array.isArray(cfArray)) {
              const soField = (cfArray as { id: string; value?: unknown; field_value?: unknown; fieldValue?: unknown; key?: string }[])
                .find((f) => {
                  const fieldDef = customFields?.find((d) => d.id === f.id)
                  return fieldDef?.name === soFieldName
                })
              if (soField) {
                isSo = isSwitchOutOn(soField.value ?? soField.field_value ?? soField.fieldValue)
              }
            }
            if (isSo) {
              return (
                <span key={cat} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold tracking-wide bg-red-100 text-red-700 border-red-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {cat}
                </span>
              )
            }
            const colors = CATEGORY_COLORS[cat.toLowerCase()] ?? DEFAULT_CAT
            return (
              <span key={cat} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${colors.bg} ${colors.text} ${colors.border}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                {cat}
              </span>
            )
          })}
        </div>
      )
    }
    return formatCustomFieldValue(raw)
  }

  if (col.key === 'contactName') {
    const name = String(
      contact.contactName ?? contact.name ?? ([contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—')
    )
    const initials = name.slice(0, 2).toUpperCase()
    return (
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-indigo-500 text-[10px] font-bold text-white">
          {initials !== '—' ? initials : '?'}
        </span>
        <span className="font-semibold text-gray-900">{name}</span>
      </div>
    )
  }

  if (col.key === 'tags') {
    const tags = Array.isArray(contact.tags) ? contact.tags : []
    if (tags.length === 0) return <span className="text-gray-300">—</span>
    const maxVisible = 3
    const visible = tags.slice(0, maxVisible)
    const remaining = tags.length - maxVisible
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((tag: string) => {
          const colors = getTagColors(tag)
          return (
            <span key={tag} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-5 ${colors.bg} ${colors.text} ring-1 ring-inset ring-current/10`}>
              <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
              {tag}
            </span>
          )
        })}
        {remaining > 0 && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500 ring-1 ring-inset ring-gray-200/60" title={tags.slice(maxVisible).join(', ')}>
            +{remaining}
          </span>
        )}
      </div>
    )
  }

  if (col.key === 'dnd') {
    return contact.dnd
      ? <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-inset ring-red-100">DND</span>
      : <span className="text-gray-300/60">—</span>
  }

  if (DATE_FIELDS.has(col.key)) return formatDate(contact[col.key])

  if (col.key === 'email') {
    const val = contact[col.key]
    if (!val) return <span className="text-gray-300/60">—</span>
    return (
      <span className="inline-flex items-center gap-1.5 text-gray-600">
        <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
        <span className="truncate">{String(val)}</span>
      </span>
    )
  }

  if (col.key === 'phone') {
    const val = contact[col.key]
    if (!val) return <span className="text-gray-300/60">—</span>
    return (
      <span className="inline-flex items-center gap-1.5 text-gray-600">
        <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
        </svg>
        <span className="font-mono text-xs tabular-nums">{String(val)}</span>
      </span>
    )
  }

  const val = contact[col.key]
  if (val === null || val === undefined || val === '') return <span className="text-gray-300/60">—</span>
  return String(val)
}

/* ─── Filter dropdown component ─── */

function ColumnFilterDropdown({
  col,
  filter,
  uniqueValues,
  kind,
  onUpdate,
  onClose,
}: {
  col: ContactColumn
  filter: ColumnFilter | undefined
  uniqueValues: string[]
  kind: 'multi' | 'text' | 'date'
  onUpdate: (f: ColumnFilter | null) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')

  if (kind === 'date') {
    const df = filter?.type === 'date' ? filter : { from: '', to: '' }
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-700">Filtra per data</p>
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-gray-400">Da</label>
            <input
              type="date"
              value={df.from}
              onChange={(e) => {
                const next = { type: 'date' as const, from: e.target.value, to: df.to }
                if (!next.from && !next.to) onUpdate(null)
                else onUpdate(next)
              }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-gray-400">A</label>
            <input
              type="date"
              value={df.to}
              onChange={(e) => {
                const next = { type: 'date' as const, from: df.from, to: e.target.value }
                if (!next.from && !next.to) onUpdate(null)
                else onUpdate(next)
              }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
            />
          </div>
        </div>
        {(df.from || df.to) && (
          <button type="button" onClick={() => { onUpdate(null); onClose() }} className="text-[11px] font-medium text-red-500 hover:text-red-600">
            Cancella filtro
          </button>
        )}
      </div>
    )
  }

  if (kind === 'multi') {
    const selected = filter?.type === 'multi' ? filter.values : []
    const filtered = search
      ? uniqueValues.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
      : uniqueValues

    function toggle(val: string) {
      const next = selected.includes(val)
        ? selected.filter((s) => s !== val)
        : [...selected, val]
      if (next.length === 0) onUpdate(null)
      else onUpdate({ type: 'multi', values: next })
    }

    return (
      <div className="space-y-2">
        {/* Search within options */}
        {uniqueValues.length > 6 && (
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Cerca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
            />
          </div>
        )}

        {/* Selected count */}
        {selected.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-brand">{selected.length} selezionati</span>
            <button type="button" onClick={() => { onUpdate(null) }} className="text-[11px] font-medium text-red-500 hover:text-red-600">
              Deseleziona
            </button>
          </div>
        )}

        {/* Vertical checkbox list */}
        <div className="max-h-56 overflow-y-auto -mx-1 space-y-0.5">
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">Nessun risultato</p>
          )}
          {filtered.map((val) => {
            const isChecked = selected.includes(val)
            return (
              <label
                key={val}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors ${isChecked ? 'bg-brand/5' : 'hover:bg-gray-50'}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(val)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand focus:ring-offset-0"
                />
                <span className={`truncate ${isChecked ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{val}</span>
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  // Text search
  const tv = filter?.type === 'text' ? filter.value : ''
  return (
    <div className="space-y-2">
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder={`Cerca ${col.label.toLowerCase()}...`}
          value={tv}
          onChange={(e) => {
            if (e.target.value.trim() === '') onUpdate(null)
            else onUpdate({ type: 'text', value: e.target.value })
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') onClose() }}
          autoFocus
          className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
        />
      </div>
      {tv && (
        <button type="button" onClick={() => { onUpdate(null); onClose() }} className="text-[11px] font-medium text-red-500 hover:text-red-600">
          Cancella filtro
        </button>
      )}
    </div>
  )
}

/* ─── Main component ─── */

export default memo(function ContactsList({ contacts: serverContacts, locationId, columns, customFields = [], availableTags = [], categoryTags = {} }: Props) {
  const router = useRouter()
  const deferredContacts = useDeferredValue(serverContacts)
  const [localContacts, setLocalContacts] = useState<Contact[]>(deferredContacts)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [editContactId, setEditContactId] = useState<string | null>(null)
  const skipSyncUntil = useRef(0)

  // Column filters: colKey → ColumnFilter
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({})
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  // Close filter dropdown on click outside
  useEffect(() => {
    if (!activeFilter) return
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setActiveFilter(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [activeFilter])

  // Determine filter kind for each column
  const columnFilterKinds = useMemo(() => {
    const map: Record<string, 'multi' | 'text' | 'date'> = {}
    for (const col of columns) {
      map[col.key] = getColumnFilterKind(col, customFields)
    }
    return map
  }, [columns, customFields])

  const columnsByKey = useMemo(() => {
    const map: Record<string, ContactColumn> = {}
    for (const col of columns) {
      map[col.key] = col
    }
    return map
  }, [columns])

  const activeFilterValues = useMemo(() => {
    if (!activeFilter) return []
    const col = columnsByKey[activeFilter]
    if (!col || columnFilterKinds[activeFilter] !== 'multi') return []

    const valSet = new Set<string>()
    for (const c of localContacts) {
      if (col.type === 'custom') {
        const raw = getCustomFieldValue(c, col.key)
        if (!raw) continue
        if (col.label === 'Categoria' || raw.includes(',')) {
          raw.split(',').map((s) => s.trim()).filter(Boolean).forEach((v) => valSet.add(v))
        } else {
          valSet.add(raw)
        }
        continue
      }

      if (col.key === 'tags') {
        const tags = Array.isArray(c.tags) ? (c.tags as string[]) : []
        tags.forEach((t) => valSet.add(t))
        continue
      }

      if (col.key === 'dnd') {
        valSet.add(c.dnd ? 'Si' : 'No')
        continue
      }

      const val = c[col.key]
      if (val !== null && val !== undefined && val !== '') {
        valSet.add(String(val))
      }
    }

    return Array.from(valSet).sort((a, b) => a.localeCompare(b, 'it'))
  }, [activeFilter, columnsByKey, columnFilterKinds, localContacts])

  // Apply filters to contacts
  const filteredContacts = useMemo(() => {
    const activeFilters = Object.entries(columnFilters).filter(([, f]) => isFilterActive(f))
    if (activeFilters.length === 0) return localContacts
    return localContacts.filter((contact) => {
      return activeFilters.every(([colKey, filter]) => {
        const col = columnsByKey[colKey]
        if (!col) return true

        if (filter.type === 'text') {
          const lower = filter.value.toLowerCase()
          if (col.type === 'custom') {
            return getCustomFieldValue(contact, col.key).toLowerCase().includes(lower)
          }
          if (col.key === 'contactName') {
            const name = String(
              contact.contactName ?? contact.name ?? ([contact.firstName, contact.lastName].filter(Boolean).join(' ') || '')
            )
            return name.toLowerCase().includes(lower)
          }
          if (col.key === 'tags') {
            const tags = Array.isArray(contact.tags) ? contact.tags as string[] : []
            return tags.some(t => t.toLowerCase().includes(lower))
          }
          const val = contact[col.key]
          return val !== null && val !== undefined && String(val).toLowerCase().includes(lower)
        }

        if (filter.type === 'multi') {
          const selected = filter.values.map(v => v.toLowerCase())
          if (col.type === 'custom') {
            const raw = getCustomFieldValue(contact, col.key).toLowerCase()
            // For comma-separated values (Categoria), check if ANY selected value matches
            const contactVals = raw.split(',').map(s => s.trim())
            return selected.some(s => contactVals.includes(s))
          }
          if (col.key === 'tags') {
            const tags = Array.isArray(contact.tags) ? (contact.tags as string[]).map(t => t.toLowerCase()) : []
            return selected.some(s => tags.includes(s))
          }
          if (col.key === 'dnd') {
            const isDnd = !!contact.dnd
            return selected.includes(isDnd ? 'si' : 'no')
          }
          const val = String(contact[col.key] ?? '').toLowerCase()
          return selected.includes(val)
        }

        if (filter.type === 'date') {
          let rawDate: string | null = null
          if (col.type === 'custom') {
            rawDate = getCustomFieldValue(contact, col.key)
          } else {
            const val = contact[col.key]
            rawDate = val ? String(val) : null
          }
          if (!rawDate) return false
          // Normalize to YYYY-MM-DD for comparison
          const iso = rawDate.slice(0, 10) // handles both "2025-01-15" and "2025-01-15T..."
          if (filter.from && iso < filter.from) return false
          if (filter.to && iso > filter.to) return false
          return true
        }

        return true
      })
    })
  }, [localContacts, columnFilters, columnsByKey])

  const activeFilterCount = Object.values(columnFilters).filter(isFilterActive).length

  // Pagination (client-side)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const total = filteredContacts.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIdx = (safePage - 1) * pageSize
  const endIdx = Math.min(total, startIdx + pageSize)
  const pageContacts = filteredContacts.slice(startIdx, endIdx)

  function updateFilter(colKey: string, f: ColumnFilter | null) {
    setPage(1)
    setColumnFilters((prev) => {
      const next = { ...prev }
      if (!f) delete next[colKey]
      else next[colKey] = f
      return next
    })
  }

  function clearAllFilters() {
    setPage(1)
    setColumnFilters({})
    setActiveFilter(null)
  }

  // Sync with server when props change (deferred to avoid blocking UI)
  useEffect(() => {
    if (Date.now() < skipSyncUntil.current) return
    Promise.resolve().then(() => setLocalContacts(deferredContacts))
  }, [deferredContacts])

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [, startDelete] = useTransition()

  function handleDelete(contactId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (confirmDeleteId === contactId) {
      setDeletingId(contactId)
      startDelete(async () => {
        const result = await deleteContact(locationId, contactId)
        if (!result.error) {
          setConfirmDeleteId(null)
          setLocalContacts((prev) => prev.filter((c) => c.id !== contactId))
          router.refresh()
        }
        setDeletingId(null)
      })
    } else {
      setConfirmDeleteId(contactId)
      setTimeout(() => setConfirmDeleteId((prev) => prev === contactId ? null : prev), 3000)
    }
  }

  function handleEdit(contactId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setEditContactId(contactId)
  }

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-gray-200/70 bg-white/95 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        {/* Active filters bar */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/50 px-4 py-2.5">
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
            {Object.entries(columnFilters).filter(([, f]) => isFilterActive(f)).map(([colKey, f]) => {
              const col = columns.find(c => c.key === colKey)
              return (
                <span key={colKey} className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
                  <span className="text-brand/50">{col?.label}:</span> {filterSummary(f)}
                  <button type="button" onClick={() => updateFilter(colKey, null)} className="ml-0.5 text-current opacity-50 hover:opacity-100">&times;</button>
                </span>
              )
            })}
            <button type="button" onClick={clearAllFilters} className="ml-auto text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors">
              Cancella tutti
            </button>
            <span className="text-[11px] text-gray-400">{filteredContacts.length} / {localContacts.length}</span>
          </div>
        )}

        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-medium text-gray-500">Nessun contatto trovato.</p>
            <p className="mt-1 text-xs text-gray-400">
              {activeFilterCount > 0 ? 'Prova a modificare i filtri.' : 'Prova a modificare i filtri o crea un nuovo contatto.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[calc(100vh-330px)] overflow-y-auto">
              <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200/60 bg-gray-50">
                  <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-12 bg-gray-50 border-r border-gray-200/40">
                    #
                  </th>
                  {columns.map((col, colIdx) => {
                    const hasFilter = isFilterActive(columnFilters[col.key])
                    const isOpen = activeFilter === col.key
                    const kind = columnFilterKinds[col.key]
                    const isLast = colIdx === columns.length - 1
                    return (
                      <th
                        key={col.key}
                        className={`relative px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap bg-gray-50 ${isLast ? '' : 'border-r border-gray-200/40'}`}
                      >
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setActiveFilter(isOpen ? null : col.key) }}
                          className={`inline-flex items-center gap-1 transition-colors ${hasFilter ? 'text-brand' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          {col.label}
                          <svg className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                          </svg>
                          {hasFilter && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                        </button>
                        {/* Filter dropdown */}
                        {isOpen && (
                          <div
                            ref={filterRef}
                            className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-xl z-20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ColumnFilterDropdown
                              col={col}
                              filter={columnFilters[col.key]}
                              uniqueValues={activeFilter === col.key ? activeFilterValues : []}
                              kind={kind}
                              onUpdate={(f) => updateFilter(col.key, f)}
                              onClose={() => setActiveFilter(null)}
                            />
                          </div>
                        )}
                      </th>
                    )
                  })}
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-20 bg-gray-50 border-l border-gray-200/40">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageContacts.map((c, index) => (
                  <tr
                    key={c.id}
                    className="group cursor-pointer border-b border-gray-100/70 bg-white transition-colors duration-150 hover:bg-indigo-50/30"
                    onClick={() => setSelectedContactId(c.id)}
                  >
                    <td className="px-3 py-3.5 text-center border-r border-gray-100/60">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-100/80 text-[10px] font-bold tabular-nums text-gray-400">
                        {startIdx + index + 1}
                      </span>
                    </td>
                    {columns.map((col, colIdx) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3.5 ${
                          DATE_FIELDS.has(col.key) || col.key === 'phone' ? 'whitespace-nowrap' : ''
                        } ${col.key === 'contactName' ? '' : 'text-gray-500'} ${colIdx < columns.length - 1 ? 'border-r border-gray-100/60' : ''}`}
                      >
                        {getCellValue(c, col, customFields)}
                      </td>
                    ))}
                    <td className="px-3 py-3.5 text-right whitespace-nowrap border-l border-gray-100/60">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => handleEdit(c.id, e)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand/10 hover:text-brand"
                          title="Modifica"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M10.5 1.5l2 2-8 8H2.5v-2l8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDelete(c.id, e)}
                          disabled={deletingId === c.id}
                          className={`flex h-7 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                            confirmDeleteId === c.id
                              ? 'bg-red-600 text-white px-2.5 opacity-100'
                              : 'w-7 text-gray-400 hover:bg-red-50 hover:text-red-500'
                          } disabled:opacity-50`}
                          title={confirmDeleteId === c.id ? 'Conferma' : 'Elimina'}
                        >
                          {deletingId === c.id ? (
                            <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                          ) : confirmDeleteId === c.id ? (
                            'Conferma'
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M2 4h10M5 4V2.5h4V4M3.5 4v7.5a1 1 0 001 1h5a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
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
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200/90 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-white disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200/90 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {(selectedContactId || editContactId) && (
        <ContactDrawer
          contactId={editContactId ?? selectedContactId}
          locationId={locationId}
          customFieldDefs={customFields}
          availableTags={availableTags}
          categoryTags={categoryTags}
          initialTab={editContactId ? 'edit' : 'info'}
          onClose={() => { setSelectedContactId(null); setEditContactId(null) }}
          onContactUpdated={(id, data) => {
            skipSyncUntil.current = Date.now() + 5000
            setLocalContacts((prev) => prev.map((c) => {
              if (c.id !== id) return c
              return {
                ...c,
                ...data,
                contactName: [data.firstName, data.lastName].filter(Boolean).join(' ') || (c as Record<string, unknown>).contactName,
                name: [data.firstName, data.lastName].filter(Boolean).join(' ') || (c as Record<string, unknown>).name,
              } as Contact
            }))
          }}
        />
      )}
    </>
  )
})
