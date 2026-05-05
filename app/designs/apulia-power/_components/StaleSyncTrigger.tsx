'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  /** Server-rendered cache age in minutes (Infinity if cache is empty). */
  ageMinutes: number
  /** Trigger a sync if age >= this. Default 10. */
  staleMinutes?: number
}

/**
 * Mounts on a list page; if the cache snapshot is older than the threshold
 * it POSTs to `/api/apulia/maybe-resync` and refreshes the route once the
 * sync finishes. Operator never sees a delay — page renders from cache, the
 * trigger runs in the background, and on completion the data refreshes.
 */
export default function StaleSyncTrigger({ ageMinutes, staleMinutes = 10 }: Props) {
  const router = useRouter()
  const fired = useRef(false)
  const [state, setState] = useState<'idle' | 'syncing' | 'done' | 'error'>(ageMinutes >= staleMinutes ? 'syncing' : 'idle')

  useEffect(() => {
    if (fired.current) return
    if (ageMinutes < staleMinutes) return
    fired.current = true
    ;(async () => {
      try {
        const r = await fetch(`/api/apulia/maybe-resync?staleMinutes=${staleMinutes}`, { method: 'POST' })
        if (!r.ok) { setState('error'); return }
        setState('done')
        router.refresh()
      } catch {
        setState('error')
      }
    })()
  }, [ageMinutes, staleMinutes, router])

  if (state === 'idle' || state === 'done') return null

  return (
    <span style={{ fontSize: 11, color: 'var(--ap-text-faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {state === 'syncing' && <>↻ Aggiorno…</>}
      {state === 'error' && <span style={{ color: 'var(--ap-danger)' }}>⚠ Sync fallito</span>}
    </span>
  )
}
