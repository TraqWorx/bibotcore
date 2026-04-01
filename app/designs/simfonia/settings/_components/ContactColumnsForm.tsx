'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveContactColumns, type ContactColumn } from '../_actions'
import { sf } from '@/lib/simfonia/ui'

const accentFill = {
  background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 88%, white) 100%)',
} as const

interface GhlCustomField {
  id: string
  name: string
  fieldKey: string
  dataType: string
}

interface Props {
  locationId: string
  initialColumns: ContactColumn[]
  customFields: GhlCustomField[]
}

const STANDARD_FIELDS: { key: string; label: string }[] = [
  { key: 'dateAdded', label: 'Data Aggiunta' },
  { key: 'contactName', label: 'Nome' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Telefono' },
  { key: 'companyName', label: 'Business Name' },
  { key: 'lastActivity', label: 'Last Activity' },
  { key: 'address1', label: 'Indirizzo' },
  { key: 'city', label: 'Città' },
  { key: 'source', label: 'Source' },
  { key: 'assignedTo', label: 'Assegnato a' },
  { key: 'tags', label: 'Tag' },
]

export default function ContactColumnsForm({ locationId, initialColumns, customFields }: Props) {
  const router = useRouter()
  const [columns, setColumns] = useState<ContactColumn[]>(initialColumns)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const selectedKeys = new Set(columns.map((c) => c.key))

  function addColumn(col: ContactColumn) {
    if (selectedKeys.has(col.key)) return
    setColumns((prev) => [...prev, col])
    setSuccess(false)
  }

  function removeColumn(key: string) {
    setColumns((prev) => prev.filter((c) => c.key !== key))
    setSuccess(false)
  }

  function moveUp(index: number) {
    if (index === 0) return
    setColumns((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  function moveDown(index: number) {
    setColumns((prev) => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(false)
    const result = await saveContactColumns(locationId, columns)
    setSaving(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      router.refresh()
    }
  }

  // Available fields not yet selected
  const availableStandard = STANDARD_FIELDS.filter((f) => !selectedKeys.has(f.key))
  const availableCustom = customFields.filter((f) => !selectedKeys.has(f.id))

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">
        Scegli e ordina le colonne da mostrare nella tabella Contatti. Trascina per riordinare.
      </p>

      {/* Selected columns */}
      {columns.length > 0 && (
        <div className="space-y-1">
          {columns.map((col, i) => (
            <div
              key={col.key}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200/80 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur-sm"
            >
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-30 text-xs"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(i)}
                  disabled={i === columns.length - 1}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-30 text-xs"
                >
                  ▼
                </button>
              </div>
              <span className="flex-1 text-sm font-medium text-gray-800">{col.label}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-300">
                {col.type === 'custom' ? 'custom' : 'standard'}
              </span>
              <button
                type="button"
                onClick={() => removeColumn(col.key)}
                className="text-gray-300 hover:text-red-500 transition-colors"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {columns.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          Nessuna colonna selezionata — verranno usate le colonne predefinite.
        </p>
      )}

      {/* Add columns */}
      {(availableStandard.length > 0 || availableCustom.length > 0) && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">Aggiungi colonna</p>
          <div className="flex flex-wrap gap-2">
            {availableStandard.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => addColumn({ key: f.key, label: f.label, type: 'standard' })}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                + {f.label}
              </button>
            ))}
            {availableCustom.map((cf) => (
              <button
                key={cf.id}
                type="button"
                onClick={() => addColumn({ key: cf.id, label: cf.name, type: 'custom' })}
                className="rounded-full border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/10"
              >
                + {cf.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {success && <p className="text-sm font-medium text-emerald-600">Salvato!</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className={`${sf.btnSave} font-bold`}
        style={accentFill}
      >
        {saving ? 'Salvataggio…' : 'Salva colonne'}
      </button>
    </div>
  )
}
