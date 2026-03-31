'use client'

import { useState, useTransition } from 'react'
import { saveUniqueFields } from '../_actions'
import { parseFieldCategory, isHiddenCategory, type CustomFieldDef } from '@/lib/utils/categoryFields'

interface Props {
  locationId: string
  customFields: CustomFieldDef[]
  initialUniqueFieldIds: string[]
}

export default function UniqueFieldsForm({ locationId, customFields, initialUniqueFieldIds }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialUniqueFieldIds))
  const [saving, startSave] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  // Show all field types except CHECKBOX (boolean doesn't make sense for uniqueness)
  const eligibleFields = customFields.filter(
    (cf) => cf.dataType !== 'CHECKBOX'
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setResult(null)
  }

  function handleSave() {
    startSave(async () => {
      const res = await saveUniqueFields(locationId, Array.from(selected))
      setResult(res.error ?? 'Salvato!')
    })
  }

  return (
    <div className="space-y-4">
      {eligibleFields.length === 0 ? (
        <p className="text-sm text-gray-500">Nessun campo di testo disponibile.</p>
      ) : (() => {
        // Group fields by parsed category
        const groups = new Map<string, CustomFieldDef[]>()
        for (const cf of eligibleFields) {
          const { category } = parseFieldCategory(cf.name)
          const key = category ?? 'Altro'
          if (isHiddenCategory(key)) continue
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key)!.push(cf)
        }
        return (
          <div className="space-y-6">
            {Array.from(groups.entries()).map(([groupName, fields]) => (
              <div key={groupName}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">{groupName}</p>
                <div className="space-y-1.5">
                  {fields.map((cf) => {
                    const { displayName } = parseFieldCategory(cf.name)
                    return (
                      <label
                        key={cf.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition-all ${
                          selected.has(cf.id)
                            ? 'border-[#2A00CC] bg-[rgba(42,0,204,0.04)]'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(cf.id)}
                          onChange={() => toggle(cf.id)}
                          className="h-4 w-4 rounded border-gray-300 text-[#2A00CC] focus:ring-[#2A00CC]"
                        />
                        <span className="text-sm font-medium text-gray-800">{displayName}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-black transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: '#00F0FF' }}
        >
          {saving ? 'Salvataggio...' : 'Salva'}
        </button>
        {result && (
          <p className={`text-sm font-medium ${result === 'Salvato!' ? 'text-green-600' : 'text-red-600'}`}>
            {result}
          </p>
        )}
      </div>
    </div>
  )
}
