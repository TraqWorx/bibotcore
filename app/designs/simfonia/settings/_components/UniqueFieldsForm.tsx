'use client'

import { useState, useTransition } from 'react'
import { saveUniqueFields } from '../_actions'
import { parseFieldCategory, isHiddenCategory, type CustomFieldDef } from '@/lib/utils/categoryFields'
import { sf } from '@/lib/simfonia/ui'

const accentFill = {
  background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 88%, white) 100%)',
} as const

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
                <p className={`mb-2 ${sf.sectionLabel}`}>{groupName}</p>
                <div className="space-y-1.5">
                  {fields.map((cf) => {
                    const { displayName } = parseFieldCategory(cf.name)
                    return (
                      <label
                        key={cf.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-2.5 transition-colors ${
                          selected.has(cf.id)
                            ? 'border-brand/40 bg-brand/5 shadow-sm'
                            : 'border-gray-200/80 bg-white hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(cf.id)}
                          onChange={() => toggle(cf.id)}
                          className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
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
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-2xl px-6 py-2.5 text-sm font-bold text-gray-900 shadow-md transition hover:brightness-[1.02] disabled:opacity-50"
          style={accentFill}
        >
          {saving ? 'Salvataggio…' : 'Salva'}
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
