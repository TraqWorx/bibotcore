'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createContact } from '../_actions'
import { checkUniqueFieldDuplicates } from '../../_actions'
import {
  discoverCategories,
  getCategoriaField,
  getDropdownFields,
  getFieldsForCategory,
  parseFieldCategory,
  filterVisibleFields,
  parseCategoriaValue,
  isSwitchOutOn,
  SHARED_CATEGORIES,
  type CustomFieldDef,
} from '@/lib/utils/categoryFields'

interface Props {
  locationId: string
  tags?: string[]
  customFields?: CustomFieldDef[]
  categoryTags?: Record<string, string[]>
}

export default function NewContactForm({ locationId, tags: ghlTags = [], customFields = [], categoryTags = {} }: Props) {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [cfValues, setCfValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [cfTab, setCfTab] = useState<string | null>(null)

  // Discover categories dynamically from the Categoria dropdown field
  const categories = useMemo(() => discoverCategories(customFields), [customFields])
  const categoriaField = useMemo(() => getCategoriaField(customFields), [customFields])

  // Resolved selected category labels
  const selectedCatLabels = useMemo(() =>
    selectedCategories
      .map((slug) => categories.find((c) => c.slug === slug)?.label)
      .filter((l): l is string => !!l),
    [selectedCategories, categories]
  )

  // Get dropdown (SINGLE_OPTIONS) fields grouped by category
  const dropdownFieldsByCategory = useMemo(() => {
    if (selectedCategories.length === 0) return [] as { label: string; fields: CustomFieldDef[] }[]
    const globalSeen = new Set<string>()
    return selectedCategories
      .map((slug) => {
        const cat = categories.find((c) => c.slug === slug)
        if (!cat) return null
        const fields = getDropdownFields(customFields, cat.label)
          .filter((df) => !globalSeen.has(df.id))
        for (const f of fields) globalSeen.add(f.id)
        return fields.length > 0 ? { label: cat.label, fields } : null
      })
      .filter((g): g is { label: string; fields: CustomFieldDef[] } => g !== null)
  }, [customFields, selectedCategories, categories])

  // Flat list of all dropdown field IDs (for exclusion in other fields)
  const dropdownFields = useMemo(() =>
    dropdownFieldsByCategory.flatMap((g) => g.fields),
    [dropdownFieldsByCategory]
  )

  // Per-category visible tags
  const tagsForCategory = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const slug of selectedCategories) {
      const cat = categories.find((c) => c.slug === slug)
      if (!cat) continue
      const associated = categoryTags[cat.label] ?? []
      map[cat.label] = ghlTags.filter((t) => associated.includes(t))
    }
    return map
  }, [ghlTags, selectedCategories, categories, categoryTags])

  // Group custom fields by category (excluding dropdowns and Switch Out fields)
  const dropdownFieldIds = useMemo(() => new Set(dropdownFields.map((f) => f.id)), [dropdownFields])

  // Find per-category Switch Out fields
  const switchOutFieldForCategory = useMemo(() => {
    const map: Record<string, CustomFieldDef> = {}
    for (const slug of selectedCategories) {
      const cat = categories.find((c) => c.slug === slug)
      if (!cat) continue
      const soField = getFieldsForCategory(customFields, cat.label).find((f) => {
        const { displayName } = parseFieldCategory(f.name)
        return displayName.toLowerCase().includes('switch out')
      })
      if (soField) map[cat.label] = soField
    }
    return map
  }, [customFields, selectedCategories, categories])
  const soFieldIds = useMemo(() => new Set(Object.values(switchOutFieldForCategory).map((f) => f.id)), [switchOutFieldForCategory])

  // Anagrafica (shared) fields — always shown, independent of Categoria
  const anagraficaFields = useMemo(() => {
    const filtered = filterVisibleFields(customFields, false)
    return filtered.filter((f) => {
      const { category, displayName } = parseFieldCategory(f.name)
      if (!category || !SHARED_CATEGORIES.includes(category)) return false
      if (dropdownFieldIds.has(f.id) || soFieldIds.has(f.id)) return false
      if (displayName.toLowerCase().includes('switch out')) return false
      return true
    })
  }, [customFields, selectedCategories, dropdownFieldIds, soFieldIds])
  const anagraficaFieldIds = useMemo(() => new Set(anagraficaFields.map((f) => f.id)), [anagraficaFields])

  // Per-category custom fields (excluding Anagrafica, dropdowns, Switch Out)
  const fieldsByCategory = useMemo(() => {
    const filtered = filterVisibleFields(customFields, false)
    if (selectedCategories.length === 0) return [] as { label: string; fields: CustomFieldDef[] }[]
    return selectedCategories
      .map((slug) => {
        const cat = categories.find((c) => c.slug === slug)
        if (!cat) return null
        const fields = getFieldsForCategory(filtered, cat.label)
          .filter((f) => !dropdownFieldIds.has(f.id) && !soFieldIds.has(f.id) && !anagraficaFieldIds.has(f.id))
        return fields.length > 0 ? { label: cat.label, fields } : null
      })
      .filter((g): g is { label: string; fields: CustomFieldDef[] } => g !== null)
  }, [customFields, selectedCategories, categories, dropdownFieldIds, soFieldIds, anagraficaFieldIds])

  function toggleTag(tag: string) {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
  }

  function addNewTag() {
    const t = newTag.trim()
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t])
      setNewTag('')
    }
  }

  function setCfValue(fieldKey: string, value: string) {
    setCfValues((prev) => ({ ...prev, [fieldKey]: value }))
  }

  function toggleCategory(slug: string) {
    setSelectedCategories((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
      // Update the Categoria custom field value as comma-separated labels
      if (categoriaField) {
        const labels = next
          .map((s) => categories.find((c) => c.slug === s)?.label)
          .filter((l): l is string => !!l)
        setCfValues((p) => ({ ...p, [categoriaField.id]: labels.join(',') }))
      }
      setFieldErrors((p) => { const { category, ...rest } = p; return rest })
      // Auto-select first category tab
      if (next.length > 0) {
        const firstLabel = categories.find((c) => c.slug === next[0])?.label ?? null
        setCfTab(firstLabel)
      } else {
        setCfTab(null)
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (selectedCategories.length === 0) errors.category = 'Seleziona almeno una categoria'
    if (!firstName.trim()) errors.firstName = 'Il nome è obbligatorio'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    setError(null)

    const customFieldValues = Object.entries(cfValues)
      .filter(([, v]) => v.trim() !== '')
      .map(([key, value]) => ({ id: key, field_value: value }))

    // Check unique field constraints before creating
    const uniqueErrors = await checkUniqueFieldDuplicates(
      locationId,
      customFieldValues.map((f) => ({ id: f.id, value: f.field_value }))
    )
    if (Object.keys(uniqueErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...uniqueErrors }))
      setSaving(false)
      return
    }

    // Only send non-empty optional fields — GHL rejects empty strings for email/phone
    const payload: Record<string, unknown> = { firstName: firstName.trim(), tags }
    if (lastName.trim()) payload.lastName = lastName.trim()
    if (email.trim()) payload.email = email.trim()
    if (phone.trim()) payload.phone = phone.trim()
    if (customFieldValues.length > 0) payload.customFields = customFieldValues

    const result = await createContact(payload as Parameters<typeof createContact>[0], locationId)

    if ('error' in result) {
      setError(result.error)
      setSaving(false)
    } else {
      router.push(`/designs/simfonia/contacts?locationId=${locationId}&newContact=${result.contactId}`)
    }
  }

  const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)] transition-all'

  const CATEGORY_ACCENT: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    telefonia:       { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    dot: 'bg-blue-400' },
    energia:         { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400' },
    connettivita:    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400' },
    intrattenimento: { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-700',  dot: 'bg-purple-400' },
  }
  const DEFAULT_ACCENT = { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', dot: 'bg-gray-400' }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuovo Contatto</h1>
        <p className="mt-0.5 text-sm text-gray-500">Crea un nuovo contatto in GHL</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
          {/* LEFT PANEL — Dati Generali + Anagrafica (3 cols) */}
          <div className="lg:col-span-3 space-y-5">
            <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-gray-800">Dati Generali</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">Nome *</label>
                    <input type="text" className={`${inputClass} ${fieldErrors.firstName ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`} placeholder="Nome" value={firstName} onChange={(e) => { setFirstName(e.target.value); setFieldErrors((p) => { const { firstName, ...rest } = p; return rest }) }} />
                    {fieldErrors.firstName && <p className="mt-1 text-xs font-medium text-red-500">{fieldErrors.firstName}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">Cognome</label>
                    <input type="text" className={inputClass} placeholder="Cognome" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">Email</label>
                    <input type="email" className={inputClass} placeholder="email@esempio.it" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">Telefono</label>
                    <input type="tel" className={inputClass} placeholder="+39 000 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">Business Name</label>
                  <input type="text" className={inputClass} placeholder="Nome azienda" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Anagrafica card */}
            {anagraficaFields.length > 0 && (
              <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-bold text-gray-800">Anagrafica</h3>
                <div className="space-y-4">
                  {anagraficaFields.map((cf) => {
                    const { displayName } = parseFieldCategory(cf.name)
                    return (
                      <div key={cf.id}>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">{displayName}</label>
                        {cf.dataType === 'SINGLE_OPTIONS' && cf.picklistOptions?.length ? (
                          <select className={inputClass} value={cfValues[cf.id] ?? ''} onChange={(e) => setCfValue(cf.id, e.target.value)}>
                            <option value="">Seleziona...</option>
                            {cf.picklistOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : cf.dataType === 'LARGE_TEXT' || cf.dataType === 'TEXTAREA' ? (
                          <textarea className={inputClass} rows={3} placeholder={cf.placeholder ?? displayName} value={cfValues[cf.id] ?? ''} onChange={(e) => setCfValue(cf.id, e.target.value)} />
                        ) : (
                          <input type={cf.dataType === 'NUMBER' || cf.dataType === 'MONETARY' ? 'number' : cf.dataType === 'DATE' ? 'date' : 'text'} className={inputClass} placeholder={cf.placeholder ?? displayName} value={cfValues[cf.id] ?? ''} onChange={(e) => setCfValue(cf.id, e.target.value)} />
                        )}
                        {fieldErrors[cf.id] && <p className="mt-1 text-xs font-medium text-red-500">{fieldErrors[cf.id]}</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL — Categoria + Category fields (2 cols) */}
          <div className="lg:col-span-2 space-y-5">
            {/* Categoria picker card */}
            <div className="rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-gray-800">Categoria *</h3>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => {
                  const isChecked = selectedCategories.includes(cat.slug)
                  const accent = CATEGORY_ACCENT[cat.slug] ?? DEFAULT_ACCENT
                  return (
                    <label
                      key={cat.slug}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-2.5 transition-all ${
                        isChecked ? `${accent.bg} ${accent.border}` : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input type="checkbox" checked={isChecked} onChange={() => toggleCategory(cat.slug)} className="sr-only" />
                      <span className={`h-2.5 w-2.5 rounded-full transition-all ${isChecked ? accent.dot : 'bg-gray-300'}`} />
                      <span className={`text-sm font-semibold ${isChecked ? accent.text : 'text-gray-500'}`}>{cat.label}</span>
                    </label>
                  )
                })}
              </div>
              {fieldErrors.category && <p className="mt-2 text-xs font-medium text-red-500">{fieldErrors.category}</p>}
            </div>

            {/* Category-specific fields — appears when categories selected */}
            {selectedCategories.length > 0 && (
              <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm space-y-4">
                {/* Category tabs */}
                {selectedCategories.length > 1 && (
                  <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                    {selectedCategories.map((slug) => {
                      const cat = categories.find((c) => c.slug === slug)
                      if (!cat) return null
                      return (
                        <button key={slug} type="button" onClick={() => setCfTab(cat.label)} className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap" style={cfTab === cat.label ? { background: '#2A00CC', color: 'white' } : { color: '#6B7280' }}>
                          {cat.label}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Dropdown fields */}
                {dropdownFieldsByCategory
                  .filter((g) => selectedCategories.length <= 1 || g.label === cfTab)
                  .map((group) => (
                  <div key={`dd-${group.label}`} className="space-y-3">
                    {group.fields.map((df) =>
                      df.picklistOptions && df.picklistOptions.length > 0 ? (
                        <div key={df.id}>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">{parseFieldCategory(df.name).displayName}</label>
                          <select value={cfValues[df.id] ?? ''} onChange={(e) => setCfValue(df.id, e.target.value)} className={inputClass}>
                            <option value="">Seleziona...</option>
                            {df.picklistOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                          </select>
                        </div>
                      ) : null
                    )}
                  </div>
                ))}

                {/* Custom fields + tags + Switch Out */}
                {fieldsByCategory
                  .filter((g) => selectedCategories.length <= 1 || g.label === cfTab)
                  .map((group) => {
                    const soField = switchOutFieldForCategory[group.label]
                    const soIsOn = soField ? isSwitchOutOn(cfValues[soField.id]) : false
                    return (
                  <div key={`cf-${group.label}`} className="space-y-3">
                    {group.fields.map((cf) => {
                      const { displayName } = parseFieldCategory(cf.name)
                      return (
                        <div key={cf.id}>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">{displayName}</label>
                          {cf.dataType === 'CHECKBOX' ? (
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={cfValues[cf.id] === 'true'} onChange={(e) => setCfValue(cf.id, e.target.checked ? 'true' : '')} className="h-4 w-4 rounded border-gray-300" />
                              <span className="text-sm text-gray-600">{displayName}</span>
                            </label>
                          ) : cf.dataType === 'SINGLE_OPTIONS' && cf.picklistOptions?.length ? (
                            <select className={inputClass} value={cfValues[cf.id] ?? ''} onChange={(e) => setCfValue(cf.id, e.target.value)}>
                              <option value="">Seleziona...</option>
                              {cf.picklistOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                            </select>
                          ) : cf.dataType === 'LARGE_TEXT' || cf.dataType === 'TEXTAREA' ? (
                            <textarea className={inputClass} rows={3} placeholder={cf.placeholder ?? displayName} value={cfValues[cf.id] ?? ''} onChange={(e) => setCfValue(cf.id, e.target.value)} />
                          ) : (
                            <input type={cf.dataType === 'NUMBER' || cf.dataType === 'MONETARY' ? 'number' : cf.dataType === 'DATE' ? 'date' : 'text'} className={inputClass} placeholder={cf.placeholder ?? displayName} value={cfValues[cf.id] ?? ''} onChange={(e) => setCfValue(cf.id, e.target.value)} />
                          )}
                          {fieldErrors[cf.id] && (<p className="mt-1 text-xs font-medium text-red-500">{fieldErrors[cf.id]}</p>)}
                        </div>
                      )
                    })}

                    {/* Per-category tags */}
                    {(() => {
                      const catTags = tagsForCategory[group.label] ?? []
                      return (
                        <div className="space-y-2 pt-2">
                          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400">Tag</label>
                          <div className="flex flex-wrap gap-1.5">
                            {tags.filter((t) => catTags.includes(t)).map((tag) => (
                              <span key={tag} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: '#2A00CC', color: 'white' }}>
                                {tag}
                                <button type="button" onClick={() => setTags((prev) => prev.filter((t) => t !== tag))} className="ml-0.5 text-current opacity-50 hover:opacity-100">&times;</button>
                              </span>
                            ))}
                            {catTags.filter((t) => !tags.includes(t)).map((tag) => (
                              <button key={tag} type="button" onClick={() => toggleTag(tag)} className="rounded-full border border-dashed border-gray-300 bg-white px-2.5 py-0.5 text-[11px] font-medium text-gray-500 transition-colors hover:border-[#2A00CC] hover:text-[#2A00CC]">
                                + {tag}
                              </button>
                            ))}
                          </div>
                          {/* Custom new tag input */}
                          <div className="flex gap-1.5 pt-1">
                            <input
                              type="text"
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewTag() } }}
                              placeholder="Aggiungi tag..."
                              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-[#2A00CC] focus:ring-1 focus:ring-[rgba(42,0,204,0.15)] transition-all"
                            />
                            <button
                              type="button"
                              onClick={addNewTag}
                              disabled={!newTag.trim()}
                              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                          {/* Show manually added tags (not in category suggestions) */}
                          {tags.filter((t) => !catTags.includes(t)).length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {tags.filter((t) => !catTags.includes(t)).map((tag) => (
                                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-semibold text-white">
                                  {tag}
                                  <button type="button" onClick={() => setTags((prev) => prev.filter((t) => t !== tag))} className="ml-0.5 text-current opacity-50 hover:opacity-100">&times;</button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Switch Out toggle */}
                    {soField && (
                      <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all ${soIsOn ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <input type="checkbox" checked={soIsOn} onChange={(e) => setCfValue(soField.id, e.target.checked ? 'Si' : 'No')} className="sr-only" />
                        <span className={`text-lg ${soIsOn ? '' : 'opacity-30'}`}>&#x1F6A9;</span>
                        <div>
                          <span className={`text-sm font-bold ${soIsOn ? 'text-red-700' : 'text-gray-500'}`}>Switch Out</span>
                          <p className="text-[11px] text-gray-400">{group.label}</p>
                        </div>
                      </label>
                    )}
                  </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-6 flex items-center gap-3">
          {error && (
            <p className="flex-1 text-sm font-medium text-red-600">{error}</p>
          )}
          <div className={`flex gap-3 ${error ? '' : 'ml-auto'}`}>
            <button
              type="button"
              onClick={() => router.push(`/designs/simfonia/contacts?locationId=${locationId}`)}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving || selectedCategories.length === 0}
              className="rounded-xl px-8 py-2.5 text-sm font-bold text-black transition-all hover:opacity-90 disabled:opacity-50 shadow-sm"
              style={{ background: '#00F0FF' }}
            >
              {saving ? 'Salvataggio...' : 'Crea Contatto'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
