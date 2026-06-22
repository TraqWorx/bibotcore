'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  /** Poll interval in ms while the tab is visible. 0 disables interval polling. Default 15000. */
  intervalMs?: number
  /** Minimum gap between refreshes in ms (debounces focus + interval together). Default 4000. */
  minGapMs?: number
}

/**
 * Soft auto-refresh backstop for design pages. Re-fetches the current
 * route — server components re-run against the DB, client state is
 * preserved, no full browser reload — so changes show up without anyone
 * pressing refresh. Fires when:
 *   - the tab regains focus / becomes visible (you switched back), and
 *   - on a gentle interval while the tab is visible.
 *
 * Skips while the user is actively typing in a field (input/textarea/
 * select/contenteditable) so a refresh never yanks data out from under
 * an open editor. Pair with the per-action router.refresh() calls: those
 * make your own edits instant, this catches everything else (background
 * sync, edits in another tab, any action that forgot to refresh).
 */
export default function AutoRefresh({ intervalMs = 15000, minGapMs = 4000 }: Props) {
  const router = useRouter()
  const last = useRef(0)

  useEffect(() => {
    const isEditing = () => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
    }
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      if (isEditing()) return
      const now = Date.now()
      if (now - last.current < minGapMs) return
      last.current = now
      router.refresh()
    }
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }

    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    const id = intervalMs > 0 ? setInterval(refresh, intervalMs) : undefined

    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
      if (id) clearInterval(id)
    }
  }, [router, intervalMs, minGapMs])

  return null
}
