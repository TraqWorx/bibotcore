'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  /**
   * Minutes since the last full reconciliation (Infinity if it has never
   * run), rendered on the server. Below `staleMinutes` this component does
   * nothing at all: the round-trip itself costs a GHL contact-count call
   * and three queries, on a page that is already rendered and correct.
   */
  ageMinutes: number
  /** Trigger a sync if age >= this OR drift is detected. Default 30. */
  staleMinutes?: number
}

/**
 * Mounts on a list page and POSTs to /api/apulia/maybe-resync. The
 * server endpoint runs a fullSyncCache when EITHER the cache is older
 * than `staleMinutes` OR the cache row count diverges from the live
 * GHL count. The page auto-refreshes once the sync completes.
 *
 * The drift check catches GHL bulk operations, which don't fire per-contact
 * webhooks. It runs when this component calls the endpoint — so on a visit
 * where the cache is fresh, drift waits for the next reconciliation rather
 * than being caught on that visit. The hourly cron is the backstop.
 */
export default function StaleSyncTrigger({ ageMinutes, staleMinutes = 30 }: Props) {
  const router = useRouter()
  const fired = useRef(false)
  // Fresh cache: nothing to show, not even for the moment before the effect
  // runs — this renders on the server too.
  const [state, setState] = useState<'idle' | 'checking' | 'syncing' | 'done' | 'error'>(
    ageMinutes < staleMinutes ? 'idle' : 'checking',
  )

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    if (ageMinutes < staleMinutes) { setState('idle'); return }
    ;(async () => {
      try {
        const r = await fetch(`/api/apulia/maybe-resync?staleMinutes=${staleMinutes}`, { method: 'POST' })
        if (!r.ok) { setState('error'); return }
        const j = await r.json() as { skipped?: boolean; synced?: boolean }
        if (j.skipped) { setState('idle'); return }
        if (j.synced) {
          setState('done')
          router.refresh()
          return
        }
        setState('idle')
      } catch {
        setState('error')
      }
    })()
  }, [staleMinutes, router, ageMinutes])

  // Hide on idle/done/error: this is a best-effort background cache refresh,
  // not a row-level GHL sync. Failures here just mean the page may be a
  // few minutes stale; the next visit (or the hourly cron) will catch up.
  // Showing "⚠ Sync fallito" was confusing users who interpreted it as
  // their data not being synced to GHL (it is — that's the per-row queue).
  if (state !== 'checking' && state !== 'syncing') return null

  return (
    <span style={{ fontSize: 11, color: 'var(--ap-text-faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {state === 'checking' && <>↻ Verifico…</>}
      {state === 'syncing' && <>↻ Aggiorno…</>}
    </span>
  )
}
