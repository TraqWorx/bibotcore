'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createContact } from '../_actions'
import type { GhlCustomField } from '../page'

interface Props {
  locationId: string
  tags?: string[]
  customFields?: GhlCustomField[]
}

export default function NewContactForm({ locationId, tags: ghlTags = [], customFields = [] }: Props) {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [cfValues, setCfValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!firstName.trim()) return
    setSaving(true)
    setError(null)

    // Build customFields array for GHL API
    const customFieldValues = Object.entries(cfValues)
      .filter(([, v]) => v.trim() !== '')
      .map(([key, value]) => ({ id: key, field_value: value }))

    const result = await createContact({
      firstName,
      lastName,
      email,
      phone,
      companyName: companyName.trim() || undefined,
      tags,
      customFields: customFieldValues,
    }, locationId)

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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                Nome *
              </label>
              <input
                required
                type="text"
                className={inputClass}
                placeholder="Nome"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
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
            {/* Selected tags */}
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
            {/* New tag input */}
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
            {/* Suggestions from existing tags */}
            {ghlTags.filter((t) => !tags.includes(t) && (!newTag || t.toLowerCase().includes(newTag.toLowerCase()))).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {ghlTags
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

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Campi Personalizzati
              </p>
              {customFields.map((cf) => (
                <div key={cf.id}>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                    {cf.name}
                  </label>
                  {cf.dataType === 'CHECKBOX' ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={cfValues[cf.id] === 'true'}
                        onChange={(e) => setCfValue(cf.id, e.target.checked ? 'true' : '')}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-600">{cf.name}</span>
                    </label>
                  ) : cf.dataType === 'LARGE_TEXT' || cf.dataType === 'TEXTAREA' ? (
                    <textarea
                      className={inputClass}
                      rows={3}
                      placeholder={cf.placeholder ?? cf.name}
                      value={cfValues[cf.id] ?? ''}
                      onChange={(e) => setCfValue(cf.id, e.target.value)}
                    />
                  ) : (
                    <input
                      type={cf.dataType === 'NUMBER' || cf.dataType === 'MONETARY' ? 'number' : cf.dataType === 'DATE' ? 'date' : 'text'}
                      className={inputClass}
                      placeholder={cf.placeholder ?? cf.name}
                      value={cfValues[cf.id] ?? ''}
                      onChange={(e) => setCfValue(cf.id, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm font-medium text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold text-black transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: '#00F0FF' }}
            >
              {saving ? 'Salvataggio...' : 'Crea Contatto'}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/designs/apulia-power/contacts?locationId=${locationId}`)}
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
