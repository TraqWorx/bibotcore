'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createContact } from '../_actions'
import {
  discoverCategories,
  getCategoriaField,
  getDropdownFields,
  getFieldsForCategory,
  parseFieldCategory,
  filterVisibleFields,
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
  const [selectedCategory, setSelectedCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [cfValues, setCfValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Discover categories dynamically from the Categoria dropdown field
  const categories = useMemo(() => discoverCategories(customFields), [customFields])
  const categoriaField = useMemo(() => getCategoriaField(customFields), [customFields])

  // Get ALL dropdown (SINGLE_OPTIONS) fields for the selected category
  const dropdownFields = useMemo(() => {
    if (!selectedCategory) return []
    const cat = categories.find((c) => c.slug === selectedCategory)
    if (!cat) return []
    return getDropdownFields(customFields, cat.label)
  }, [customFields, selectedCategory, categories])

  // Filter tags by category association — only show tags configured for this category
  const visibleTags = useMemo(() => {
    if (!selectedCategory) return []
    const cat = categories.find((c) => c.slug === selectedCategory)
    if (!cat) return []
    const associated = categoryTags[cat.label] ?? []
    return ghlTags.filter((t) => associated.includes(t))
  }, [ghlTags, selectedCategory, categories, categoryTags])

  // Filter custom fields based on selected category, excluding dropdown fields shown above
  const dropdownFieldIds = useMemo(() => new Set(dropdownFields.map((f) => f.id)), [dropdownFields])
  const visibleFields = useMemo(() => {
    const filtered = filterVisibleFields(customFields, false)
    if (!selectedCategory) return []
    const cat = categories.find((c) => c.slug === selectedCategory)
    if (!cat) return []
    return getFieldsForCategory(filtered, cat.label).filter(
      (f) => !dropdownFieldIds.has(f.id)
    )
  }, [customFields, selectedCategory, categories, dropdownFieldIds])

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

  function handleCategoryChange(slug: string) {
    setSelectedCategory(slug)
    // Set the Categoria custom field value
    const cat = categories.find((c) => c.slug === slug)
    if (cat && categoriaField) {
      setCfValues((prev) => ({ ...prev, [categoriaField.id]: cat.label }))
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!selectedCategory) errors.category = 'Seleziona una categoria'
    if (!firstName.trim()) errors.firstName = 'Il nome è obbligatorio'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    setError(null)

    const customFieldValues = Object.entries(cfValues)
      .filter(([, v]) => v.trim() !== '')
      .map(([key, value]) => ({ id: key, field_value: value }))

    // Only send non-empty optional fields — GHL rejects empty strings for email/phone
    const payload: Record<string, unknown> = { firstName: firstName.trim(), tags }
    if (lastName.trim()) payload.lastName = lastName.trim()
    if (email.trim()) payload.email = email.trim()
    if (phone.trim()) payload.phone = phone.trim()
    if (customFieldValues.length > 0) payload.customFields = customFieldValues

    const result = await createContact(payload as Parameters<typeof createContact>[0], locationId)

    if (result?.error) {
      setError(result.error)
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)] transition-all'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuovo Contatto</h1>
        <p className="mt-0.5 text-sm text-gray-500">Crea un nuovo contatto in GHL</p>
      </div>

      <div className="max-w-lg rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category selection — first field */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
              Categoria *
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => { handleCategoryChange(e.target.value); setFieldErrors((p) => { const { category, ...rest } = p; return rest }) }}
              className={`${inputClass} ${fieldErrors.category ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
            >
              <option value="">Seleziona categoria...</option>
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>{cat.label}</option>
              ))}
            </select>
            {fieldErrors.category && <p className="mt-1 text-xs font-medium text-red-500">{fieldErrors.category}</p>}
          </div>

          {/* Dropdown fields — shown when a category is selected */}
          {dropdownFields.map((df) =>
            df.picklistOptions && df.picklistOptions.length > 0 ? (
              <div key={df.id}>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                  {parseFieldCategory(df.name).displayName}
                </label>
                <select
                  value={cfValues[df.id] ?? ''}
                  onChange={(e) => setCfValue(df.id, e.target.value)}
                  className={inputClass}
                >
                  <option value="">Seleziona...</option>
                  {df.picklistOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ) : null
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                Nome *
              </label>
              <input
                type="text"
                className={`${inputClass} ${fieldErrors.firstName ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
                placeholder="Nome"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setFieldErrors((p) => { const { firstName, ...rest } = p; return rest }) }}
              />
              {fieldErrors.firstName && <p className="mt-1 text-xs font-medium text-red-500">{fieldErrors.firstName}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                Cognome
              </label>
              <input
                type="text"
                className={inputClass}
                placeholder="Cognome"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
              Email
            </label>
            <input
              type="email"
              className={inputClass}
              placeholder="email@esempio.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
              Telefono
            </label>
            <input
              type="tel"
              className={inputClass}
              placeholder="+39 000 000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
              Business Name
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="Nome azienda"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div className="border-t border-gray-100 pt-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-400">
              Tag
            </label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{ background: '#2A00CC', color: 'white' }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                      className="ml-0.5 text-current opacity-50 hover:opacity-100"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addNewTag()
                  }
                }}
                placeholder="Aggiungi tag..."
                className={inputClass}
              />
              <button
                type="button"
                onClick={addNewTag}
                className="shrink-0 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#2A00CC' }}
              >
                +
              </button>
            </div>
            {visibleTags.filter((t) => !tags.includes(t) && (!newTag || t.toLowerCase().includes(newTag.toLowerCase()))).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {visibleTags
                  .filter((t) => !tags.includes(t) && (!newTag || t.toLowerCase().includes(newTag.toLowerCase())))
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-500 transition-colors hover:opacity-80"
                    >
                      + {tag}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Custom Fields — filtered by category */}
          {selectedCategory && visibleFields.length > 0 && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Campi — {categories.find((c) => c.slug === selectedCategory)?.label}
              </p>
              {visibleFields.map((cf) => {
                const { displayName } = parseFieldCategory(cf.name)
                return (
                  <div key={cf.id}>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                      {displayName}
                    </label>
                    {cf.dataType === 'CHECKBOX' ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={cfValues[cf.id] === 'true'}
                          onChange={(e) => setCfValue(cf.id, e.target.checked ? 'true' : '')}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-600">{displayName}</span>
                      </label>
                    ) : cf.dataType === 'SINGLE_OPTIONS' && cf.picklistOptions?.length ? (
                      <select
                        className={inputClass}
                        value={cfValues[cf.id] ?? ''}
                        onChange={(e) => setCfValue(cf.id, e.target.value)}
                      >
                        <option value="">Seleziona...</option>
                        {cf.picklistOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : cf.dataType === 'LARGE_TEXT' || cf.dataType === 'TEXTAREA' ? (
                      <textarea
                        className={inputClass}
                        rows={3}
                        placeholder={cf.placeholder ?? displayName}
                        value={cfValues[cf.id] ?? ''}
                        onChange={(e) => setCfValue(cf.id, e.target.value)}
                      />
                    ) : (
                      <input
                        type={cf.dataType === 'NUMBER' || cf.dataType === 'MONETARY' ? 'number' : cf.dataType === 'DATE' ? 'date' : 'text'}
                        className={inputClass}
                        placeholder={cf.placeholder ?? displayName}
                        value={cfValues[cf.id] ?? ''}
                        onChange={(e) => setCfValue(cf.id, e.target.value)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {error && (
            <p className="text-sm font-medium text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !selectedCategory}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold text-black transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: '#00F0FF' }}
            >
              {saving ? 'Salvataggio...' : 'Crea Contatto'}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/designs/simfonia/contacts?locationId=${locationId}`)}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-50"
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
