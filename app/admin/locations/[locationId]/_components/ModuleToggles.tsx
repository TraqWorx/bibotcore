'use client'

import { useState, useTransition } from 'react'
import { saveModuleOverrides } from '../_actions'

interface ModuleDef {
  key: string
  label: string
  description: string
}

const MODULES: ModuleDef[] = [
  { key: 'dashboard',     label: 'Dashboard',      description: 'Analytics overview and tag categories' },
  { key: 'contacts',      label: 'Contatti',       description: 'Contact list and details' },
  { key: 'conversations', label: 'Conversazioni',  description: 'Chat and messaging' },
  { key: 'pipeline',      label: 'Pipeline',       description: 'Opportunity board' },
  { key: 'calendar',      label: 'Calendario',     description: 'Appointments and scheduling' },
  { key: 'ai',            label: 'AI Assistant',   description: 'AI summaries, reply suggestions, Ask AI widget' },
  { key: 'automations',   label: 'Automazioni',    description: 'GHL workflow list (read-only)' },
  { key: 'settings',      label: 'Impostazioni',   description: 'Location settings' },
]

interface Props {
  locationId: string
  designModules: Record<string, { enabled: boolean }>
  locationOverrides: Record<string, { enabled: boolean }>
}

export default function ModuleToggles({ locationId, designModules, locationOverrides }: Props) {
  // Build initial state: design defaults merged with location overrides
  const initialState: Record<string, boolean> = {}
  for (const mod of MODULES) {
    const designDefault = designModules[mod.key]?.enabled !== false
    const override = locationOverrides[mod.key]
    initialState[mod.key] = override !== undefined ? override.enabled : designDefault
  }

  const [modules, setModules] = useState(initialState)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(key: string) {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  function handleSave() {
    setError(null)
    const overrides: Record<string, { enabled: boolean }> = {}
    for (const mod of MODULES) {
      overrides[mod.key] = { enabled: modules[mod.key] }
    }
    startTransition(async () => {
      const result = await saveModuleOverrides(locationId, overrides)
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    })
  }

  return (
    <div>
      <div className="divide-y divide-gray-100">
        {MODULES.map((mod) => {
          const designDefault = designModules[mod.key]?.enabled !== false
          const isOverridden = locationOverrides[mod.key] !== undefined
          const currentValue = modules[mod.key]

          return (
            <div key={mod.key} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-800">{mod.label}</p>
                  {!designDefault && !isOverridden && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                      Off by design
                    </span>
                  )}
                  {isOverridden && (
                    <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">
                      Override
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{mod.description}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(mod.key)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  currentValue ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    currentValue ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#2A00CC' }}
        >
          {isPending ? 'Saving…' : 'Save Modules'}
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  )
}
