'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { GhlPipeline } from '@/lib/ghl/ghlClient'
import { createOpportunity } from '../_actions'

interface ContactOption {
  id: string
  name: string
}

interface Props {
  pipelines: GhlPipeline[]
  contacts: ContactOption[]
  locationId: string
  preselectedPipelineId?: string
  preselectedStageId?: string
}

export default function NewOpportunityForm({ pipelines, contacts, locationId, preselectedPipelineId, preselectedStageId }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [pipelineId, setPipelineId] = useState(preselectedPipelineId ?? '')
  const [stageId, setStageId] = useState(preselectedStageId ?? '')
  const [contactId, setContactId] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const stages = pipelines.find((p) => p.id === pipelineId)?.stages ?? []

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowContactDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredContacts = contactSearch.trim()
    ? contacts.filter((c) => c.name.toLowerCase().includes(contactSearch.toLowerCase()))
    : contacts

  const selectedContact = contacts.find((c) => c.id === contactId)

  function handlePipelineChange(id: string) {
    setPipelineId(id)
    setStageId('')
  }

  function handleSelectContact(c: ContactOption) {
    setContactId(c.id)
    setContactSearch('')
    setShowContactDropdown(false)
    // Auto-fill name if empty
    if (!name.trim()) {
      setName(c.name)
    }
  }

  function handleClearContact() {
    setContactId('')
    setContactSearch('')
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim() || !pipelineId || !stageId) return
    setSaving(true)
    setError('')
    const result = await createOpportunity({
      name,
      pipelineId,
      pipelineStageId: stageId,
      ...(contactId ? { contactId } : {}),
      monetaryValue: value ? Number(value) : 0,
    }, locationId)
    if (result?.error) {
      setError(result.error)
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)]'

  return (
    <div className="max-w-lg rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Contact selector */}
        <div ref={dropdownRef} className="relative">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Contatto</label>
          {selectedContact ? (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: '#2A00CC' }}
                >
                  {selectedContact.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm font-medium text-gray-900">{selectedContact.name}</span>
              </div>
              <button
                type="button"
                onClick={handleClearContact}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                &times;
              </button>
            </div>
          ) : (
            <input
              type="text"
              className={inputClass}
              placeholder="Cerca contatto..."
              value={contactSearch}
              onChange={(e) => {
                setContactSearch(e.target.value)
                setShowContactDropdown(true)
              }}
              onFocus={() => setShowContactDropdown(true)}
            />
          )}
          {showContactDropdown && !selectedContact && (
            <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
              {filteredContacts.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400">Nessun contatto trovato</div>
              ) : (
                filteredContacts.slice(0, 50).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectContact(c)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors"
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ background: '#2A00CC' }}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-gray-800">{c.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
          <p className="mt-1 text-[11px] text-gray-400">Opzionale — associa un contatto a questa opportunità</p>
        </div>

        {/* Name */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Nome</label>
          <input
            required
            type="text"
            className={inputClass}
            placeholder="Nome opportunità"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Value */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Valore (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputClass}
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        {/* Pipeline */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Pipeline</label>
          <select
            required
            className={inputClass}
            value={pipelineId}
            onChange={(e) => handlePipelineChange(e.target.value)}
          >
            <option value="">Seleziona pipeline</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stage */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Fase</label>
          <select
            required
            className={`${inputClass} disabled:opacity-50`}
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            disabled={!pipelineId}
          >
            <option value="">Seleziona fase</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: '#2A00CC' }}
          >
            {saving ? 'Salvataggio…' : 'Salva Opportunità'}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/designs/apulia-power/pipeline?locationId=${locationId}`)}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-50"
          >
            Annulla
          </button>
        </div>
      </form>
    </div>
  )
}
