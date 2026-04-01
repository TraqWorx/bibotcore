'use client'

import { useState, useEffect } from 'react'

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
  syncing: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Sync GHL' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', label: 'Completato' },
  failed: { bg: 'bg-red-50', text: 'text-red-700', label: 'Fallito' },
}

export default function BulkJobsDashboard({ locationId }: { locationId: string }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadJobs() }, [locationId])

  // Auto-refresh every 5s if there are running jobs
  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === 'running' || j.status === 'syncing')
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

  if (loading) return <div className="h-12 animate-pulse rounded-xl bg-gray-50" />
  if (jobs.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-800">Azioni Bulk AI</h2>
      <div className="space-y-3">
        {jobs.map((job) => {
          const style = STATUS_STYLES[job.status] ?? STATUS_STYLES.pending
          const pct = job.total_contacts > 0 ? Math.round((job.processed / job.total_contacts) * 100) : 0
          return (
            <div key={job.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{job.description}</p>
                  <p className="mt-0.5 text-[10px] text-gray-400">
                    {new Date(job.created_at).toLocaleString('it-IT')}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.bg} ${style.text}`}>
                  {style.label}
                </span>
              </div>
              <div className="mt-2">
                <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                  <span>{job.processed} / {job.total_contacts}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-[#2A00CC]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              {job.failed > 0 && (
                <p className="mt-1 text-[10px] text-red-500">{job.failed} falliti</p>
              )}
              {job.error && (
                <p className="mt-1 text-[10px] text-red-500 truncate">{job.error}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
