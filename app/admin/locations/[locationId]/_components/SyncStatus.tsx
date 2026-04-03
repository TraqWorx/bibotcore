'use client'

import { useCallback, useEffect, useState } from 'react'
import { ad } from '@/lib/admin/ui'

interface EntityStatus {
  entity_type: string
  status: string
  last_synced_at: string | null
  error: string | null
}

export default function SyncStatus({ locationId }: { locationId: string }) {
  const [statuses, setStatuses] = useState<EntityStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadStatus = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    const res = await fetch(`/api/admin/sync?locationId=${locationId}`)
    if (res.ok) {
      const data = await res.json()
      setStatuses(data.statuses ?? [])
    }
    setLoading(false)
  }, [locationId])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadStatus(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [loadStatus])

  async function handleSync() {
    setSyncing(true)
    setMessage(null)
    const res = await fetch('/api/admin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.results?.skipped) {
        setMessage(data.results.skipped)
      } else {
        setMessage('Sync completato — dati e utenti aggiornati')
      }
      void loadStatus(false)
    } else {
      const data = await res.json()
      setMessage(`Errore: ${data.error}`)
    }
    setSyncing(false)
  }

  function formatDate(d: string | null): string {
    if (!d) return 'Mai'
    return new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={ad.panel}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Data Sync</h2>
          <p className="text-xs text-gray-500">Stato della sincronizzazione dati da GHL</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`${ad.btnPrimary} px-4 py-1.5 text-xs`}
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {message && (
        <p className={`mb-3 text-xs font-medium ${message.includes('Errore') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>
      )}

      {loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-gray-50" />
      ) : statuses.length === 0 ? (
        <p className="text-xs text-gray-400">Nessun sync effettuato. Clicca "Sync Now" per iniziare.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {statuses.map((s) => (
            <div
              key={s.entity_type}
              className={`rounded-2xl border p-3 ${
                s.status === 'completed' ? 'border-green-100 bg-green-50/50' :
                s.status === 'failed' ? 'border-red-100 bg-red-50/50' :
                s.status === 'running' ? 'border-blue-100 bg-blue-50/50' :
                'border-gray-100 bg-gray-50/50'
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{s.entity_type}</p>
              <div className="mt-1 flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  s.status === 'completed' ? 'bg-green-400' :
                  s.status === 'failed' ? 'bg-red-400' :
                  s.status === 'running' ? 'bg-blue-400 animate-pulse' :
                  'bg-gray-300'
                }`} />
                <span className="text-[10px] text-gray-500">{formatDate(s.last_synced_at)}</span>
              </div>
              {s.error && <p className="mt-1 text-[9px] text-red-500 truncate" title={s.error}>{s.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
