'use client'

import { useEffect, useEffectEvent, useState } from 'react'

interface Job {
  id: string
  description: string
  total_contacts: number
  processed: number
  status: string
}

export default function BulkJobsIndicator({ locationId }: { locationId: string }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [open, setOpen] = useState(false)

  const loadJobs = useEffectEvent(async () => {
    try {
      const res = await fetch(`/api/admin/bulk-jobs?locationId=${locationId}`)
      if (!res.ok) return
      const data = await res.json()
      const active = (data.jobs ?? []).filter((j: Job) =>
        j.status === 'pending' || j.status === 'running' || j.status === 'syncing'
      )
      setJobs(active)
    } catch { /* ignore */ }
  })

  useEffect(() => {
    void loadJobs()
    const interval = setInterval(() => { void loadJobs() }, 5000)
    return () => clearInterval(interval)
  }, [locationId])

  if (jobs.length === 0) return null

  return (
    <div className="px-3 pb-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-amber-300 bg-[rgba(255,200,0,0.1)] border border-[rgba(255,200,0,0.2)]"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        <span>{jobs.length} job{jobs.length > 1 ? 's' : ''} in corso</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {jobs.map((job) => {
            const pct = job.total_contacts > 0 ? Math.round((job.processed / job.total_contacts) * 100) : 0
            return (
              <div key={job.id} className="rounded-lg bg-[rgba(255,255,255,0.05)] p-2.5">
                <p className="text-[10px] text-white/70 truncate">{job.description}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-[rgba(255,255,255,0.1)] overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[9px] text-white/50 tabular-nums">{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
