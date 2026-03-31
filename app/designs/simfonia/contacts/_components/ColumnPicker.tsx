'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { saveContactColumns, type ContactColumn } from '../../settings/_actions'
import { parseFieldCategory, isHiddenCategory, SHARED_CATEGORIES, getCategoriaField, discoverCategories, SWITCH_OUT_FIELD_NAME, CATEGORIA_FIELD_NAME, type CustomFieldDef } from '@/lib/utils/categoryFields'

// All standard GHL contact fields
const ALL_STANDARD_FIELDS: { key: string; label: string }[] = [
  { key: 'contactName', label: 'Contact Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'companyName', label: 'Business Name' },
  { key: 'dateAdded', label: 'Created' },
  { key: 'lastActivity', label: 'Last Activity' },
  { key: 'tags', label: 'Tags' },
  { key: 'source', label: 'Source' },
  { key: 'address1', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
  { key: 'postalCode', label: 'Postal Code' },
  { key: 'website', label: 'Website' },
  { key: 'assignedTo', label: 'Assigned To' },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'dnd', label: 'DND' },
  { key: 'type', label: 'Type' },
  { key: 'dateUpdated', label: 'Date Updated' },
]

interface GhlCustomField {
  id: string
  name: string
  dataType?: string
  fieldKey?: string
  placeholder?: string
  picklistOptions?: string[]
}

interface Props {
  locationId: string
  savedColumns: ContactColumn[]
  customFields: GhlCustomField[]
  /** When set, only show custom fields matching this category label (+ Anagrafica). When null, show all. */
  activeCategoryLabel?: string | null
}

export default function ColumnPicker({ locationId, savedColumns, customFields, activeCategoryLabel }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [columns, setColumns] = useState<ContactColumn[]>(savedColumns)
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Sync columns when savedColumns change (e.g. switching category)
  useEffect(() => {
    setColumns(savedColumns)
  }, [savedColumns])

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selectedKeys = new Set(columns.map((c) => c.key))

  function toggle(key: string, label: string, type: 'standard' | 'custom') {
    if (selectedKeys.has(key)) {
      setColumns((prev) => prev.filter((c) => c.key !== key))
    } else {
      setColumns((prev) => [...prev, { key, label, type }])
    }
  }

  function moveUp(i: number) {
    if (i === 0) return
    setColumns((prev) => {
      const next = [...prev]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      return next
    })
  }

  function moveDown(i: number) {
    setColumns((prev) => {
      if (i >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      return next
    })
  }

  // Drag and drop
  function handleDragStart(i: number) {
    setDragIndex(i)
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === i) return
    setColumns((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(i, 0, moved)
      return next
    })
    setDragIndex(i)
  }

  function handleDragEnd() {
    setDragIndex(null)
  }

  async function handleSave() {
    setSaving(true)
    await saveContactColumns(locationId, columns, activeCategoryLabel ?? null)
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-50"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        Colonne
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-96 rounded-2xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-bold text-gray-800">Colonne visibili</p>
            <p className="text-xs text-gray-400">Trascina per riordinare, clicca per aggiungere/rimuovere</p>
          </div>

          {/* Selected columns — reorderable */}
          <div className="max-h-60 overflow-y-auto border-b border-gray-100 px-2 py-2">
            {columns.length === 0 && (
              <p className="px-2 py-3 text-xs text-gray-400 italic text-center">Nessuna colonna selezionata</p>
            )}
            {columns.map((col, i) => (
              <div
                key={col.key}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing transition-colors ${
                  dragIndex === i ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <span className="text-gray-300 text-xs select-none">&#x2630;</span>
                <span className="flex-1 text-sm text-gray-800">{col.label}</span>
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    className="text-[10px] text-gray-300 hover:text-gray-600 disabled:opacity-20 px-1"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(i)}
                    disabled={i === columns.length - 1}
                    className="text-[10px] text-gray-300 hover:text-gray-600 disabled:opacity-20 px-1"
                  >
                    ▼
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(col.key, col.label, col.type)}
                  className="text-gray-300 hover:text-red-500 transition-colors text-sm"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          {/* Available fields to add */}
          <div className="max-h-48 overflow-y-auto px-3 py-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-300">Campi standard</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {ALL_STANDARD_FIELDS.map((f) => {
                const selected = selectedKeys.has(f.key)
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggle(f.key, f.label, 'standard')}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                      selected
                        ? 'border-[#2A00CC] bg-[rgba(42,0,204,0.08)] text-[#2A00CC]'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {selected ? '✓ ' : '+ '}{f.label}
                  </button>
                )
              })}
            </div>

            {/* Categoria column — only when viewing all categories */}
            {!activeCategoryLabel && (() => {
              const catField = getCategoriaField(customFields as { id: string; name: string; dataType: string; fieldKey: string }[])
              if (!catField) return null
              const selected = selectedKeys.has(catField.id)
              return (
                <div className="mb-3">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-300">Categoria</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggle(catField.id, 'Categoria', 'custom')}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                        selected
                          ? 'border-[#2A00CC] bg-[rgba(42,0,204,0.08)] text-[#2A00CC]'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {selected ? '✓ ' : '+ '}Categoria
                    </button>
                  </div>
                </div>
              )
            })()}

            {customFields.length > 0 && (() => {
              // Filter out global Switch Out (each category has its own) and Categoria dropdown
              const baseCf = customFields.filter(
                (cf) => cf.name !== SWITCH_OUT_FIELD_NAME && cf.name !== CATEGORIA_FIELD_NAME
              )
              // Filter custom fields by active category if set
              const visibleCf = activeCategoryLabel
                ? baseCf.filter((cf) => {
                    const { category } = parseFieldCategory(cf.name)
                    if (!category) return true
                    if (SHARED_CATEGORIES.includes(category)) return true
                    return (
                      category === activeCategoryLabel ||
                      activeCategoryLabel.startsWith(category) ||
                      category.startsWith(activeCategoryLabel)
                    )
                  })
                : baseCf

              if (visibleCf.length === 0) return null

              // Group by category when showing all categories
              if (!activeCategoryLabel) {
                const categories = discoverCategories(customFields as CustomFieldDef[])
                const groups = new Map<string, typeof visibleCf>()
                for (const cf of visibleCf) {
                  const { category: prefix } = parseFieldCategory(cf.name)
                  if (!prefix) {
                    if (!groups.has('Altro')) groups.set('Altro', [])
                    groups.get('Altro')!.push(cf)
                    continue
                  }
                  if (isHiddenCategory(prefix)) continue
                  // Normalize: find the canonical category label that matches this prefix
                  const canonical = categories.find(
                    (c) => c.label === prefix || c.label.startsWith(prefix) || prefix.startsWith(c.label)
                  )
                  const key = canonical?.label ?? (SHARED_CATEGORIES.includes(prefix) ? prefix : prefix)
                  if (!groups.has(key)) groups.set(key, [])
                  groups.get(key)!.push(cf)
                }
                return Array.from(groups.entries()).map(([groupName, fields]) => (
                  <div key={groupName} className="mb-2">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-300">{groupName}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {fields.map((cf) => {
                        const selected = selectedKeys.has(cf.id)
                        const { displayName } = parseFieldCategory(cf.name)
                        return (
                          <button
                            key={cf.id}
                            type="button"
                            onClick={() => toggle(cf.id, displayName, 'custom')}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                              selected
                                ? 'border-[#2A00CC] bg-[rgba(42,0,204,0.08)] text-[#2A00CC]'
                                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {selected ? '✓ ' : '+ '}{displayName}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))
              }

              return (
                <>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-300">Campi personalizzati</p>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleCf.map((cf) => {
                      const selected = selectedKeys.has(cf.id)
                      const { displayName } = parseFieldCategory(cf.name)
                      return (
                        <button
                          key={cf.id}
                          type="button"
                          onClick={() => toggle(cf.id, displayName, 'custom')}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                            selected
                              ? 'border-[#2A00CC] bg-[rgba(42,0,204,0.08)] text-[#2A00CC]'
                              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {selected ? '✓ ' : '+ '}{displayName}
                        </button>
                      )
                    })}
                  </div>
                </>
              )
            })()}
          </div>

          {/* Save */}
          <div className="border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl py-2 text-sm font-bold text-black transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: '#00F0FF' }}
            >
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
