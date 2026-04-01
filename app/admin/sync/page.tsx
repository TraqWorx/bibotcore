'use client'

import { useState, useEffect } from 'react'
import { ad } from '@/lib/admin/ui'

interface LocationSync {
  location_id: string
  name: string
  statuses: {
    entity_type: string
    status: string
    last_synced_at: string | null
    error: string | null
  }[]
  counts: Record<string, number>
}

export default function AdminSyncPage() {
  const [locations, setLocations] = useState<LocationSync[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const res = await fetch('/api/admin/sync/status')
    if (res.ok) {
      const data = await res.json()
      setLocations(data.locations ?? [])
    }
    setLoading(false)
  }

  async function handleSync(locationId: string) {
    setSyncing(locationId)
    setSyncResult(null)
    const res = await fetch('/api/admin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId }),
    })
    const data = await res.json()
    if (res.ok) {
      setSyncResult(`Sync completato per ${locationId}`)
      loadData()
    } else {
      setSyncResult(`Errore: ${data.error}`)
    }
    setSyncing(null)
  }

  function formatDate(d: string | null): string {
    if (!d) return 'Mai'
    return new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={ad.pageTitle}>Sync Management</h1>
          <p className={ad.pageSubtitle}>{locations.length} locations con connessione attiva</p>
        </div>
      </div>

      {syncResult && (
        <div className={`rounded-2xl border p-4 text-sm ${syncResult.includes('Errore') ? 'border-red-200 bg-red-50/80 text-red-800' : 'border-emerald-200 bg-emerald-50/80 text-emerald-900'}`}>
          {syncResult}
        </div>
      )}

      <div className="space-y-4">
        {locations.map((loc) => (
          <div key={loc.location_id} className={ad.panel}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{loc.name}</h3>
                <p className="text-xs text-gray-400 font-mono">{loc.location_id}</p>
              </div>
              <button
                onClick={() => handleSync(loc.location_id)}
                disabled={syncing === loc.location_id}
                className={`${ad.btnPrimary} px-4 py-2 text-xs`}
              >
                {syncing === loc.location_id ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Syncing...
                  </span>
                ) : 'Sync Now'}
              </button>
            </div>

            {/* Entity status grid */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {loc.statuses.map((s) => (
                <div
                  key={s.entity_type}
                  className={`rounded-xl border p-3 ${
                    s.status === 'completed' ? 'border-green-100 bg-green-50/50' :
                    s.status === 'failed' ? 'border-red-100 bg-red-50/50' :
                    s.status === 'running' ? 'border-blue-100 bg-blue-50/50' :
                    'border-gray-100 bg-gray-50/50'
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{s.entity_type}</p>
                  <p className="mt-1 text-lg font-black text-gray-900">{loc.counts[s.entity_type] ?? '—'}</p>
                  <div className="mt-1 flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      s.status === 'completed' ? 'bg-green-400' :
                      s.status === 'failed' ? 'bg-red-400' :
                      s.status === 'running' ? 'bg-blue-400 animate-pulse' :
                      'bg-gray-300'
                    }`} />
                    <span className="text-[10px] text-gray-500">{formatDate(s.last_synced_at)}</span>
                  </div>
                  {s.error && (
                    <p className="mt-1 text-[10px] text-red-500 truncate" title={s.error}>{s.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
