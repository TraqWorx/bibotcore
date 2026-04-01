'use client'

import { useState, useEffect } from 'react'
import { ad } from '@/lib/admin/ui'

interface Job {
  id: string
  action: string
  description: string
  total_contacts: number
  processed: number
  failed: number
  status: string
  error: string | null
  created_at: string
  completed_at: string | null
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'In attesa' },
  running: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'In corso' },
  syncing: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Sync' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', label: 'Completato' },
  failed: { bg: 'bg-red-50', text: 'text-red-700', label: 'Fallito' },
}

export default function BulkJobsDashboard({ locationId }: { locationId: string }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => { loadJobs() }, [locationId])

  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === 'running' || j.status === 'syncing' || j.status === 'pending')
    if (hasRunning) setExpanded(true)
    if (!hasRunning) return
    const interval = setInterval(loadJobs, 5000)
    return () => clearInterval(interval)
  }, [jobs, locationId])

  async function loadJobs() {
    const res = await fetch(`/api/admin/bulk-jobs?locationId=${locationId}`)
    if (res.ok) {
      const data = await res.json()
      setJobs(data.jobs ?? [])
    }
    setLoading(false)
  }

  if (loading) return null
  if (jobs.length === 0) return null

  const activeCount = jobs.filter((j) => j.status !== 'completed' && j.status !== 'failed').length

  return (
    <div className={ad.panel}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900">Azioni Bulk AI</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">{jobs.length}</span>
          {activeCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
              {activeCount} attiv{activeCount === 1 ? 'o' : 'i'}
            </span>
          )}
        </div>
        <svg className={`h-4 w-4 text-gray-400 transition ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-4 space-y-2">
          {jobs.map((job) => {
            const style = STATUS_STYLES[job.status] ?? STATUS_STYLES.pending
            const pct = job.total_contacts > 0 ? Math.round((job.processed / job.total_contacts) * 100) : 0
            return (
              <div key={job.id} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{job.description}</p>
                    <p className="mt-0.5 text-[10px] text-gray-400">
                      {new Date(job.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200/60">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] tabular-nums text-gray-400">{pct}%</span>
                </div>
                {job.error && <p className="mt-1 text-[10px] text-red-500 truncate">{job.error}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
