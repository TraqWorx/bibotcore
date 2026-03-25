'use client'

import { useState, useTransition } from 'react'
import { provisionLocation } from '../_actions'

interface Props {
  locations: { location_id: string; name: string | null }[]
}

export default function ProvisionForm({ locations }: Props) {
  const [locationId, setLocationId] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [running, startRun] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  function handleRun() {
    if (!locationId) return
    if (!confirm) {
      setConfirm(true)
      return
    }
    setConfirm(false)
    setLog([])
    setError(null)
    startRun(async () => {
      const result = await provisionLocation(locationId)
      setLog(result.log)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
        <select
          value={locationId}
          onChange={(e) => { setLocationId(e.target.value); setConfirm(false) }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select location...</option>
          {locations.map((loc) => (
            <option key={loc.location_id} value={loc.location_id}>
              {loc.name ?? loc.location_id}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleRun}
        disabled={!locationId || running}
        className={`rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 ${
          confirm ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        {running ? 'Running...' : confirm ? '⚠️ CONFIRM — This will delete all custom fields' : 'Provision Location'}
      </button>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {log.length > 0 && (
        <div className="rounded-lg bg-gray-900 p-4 max-h-[500px] overflow-y-auto">
          <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono">
            {log.join('\n')}
          </pre>
        </div>
      )}
    </div>
  )
}
