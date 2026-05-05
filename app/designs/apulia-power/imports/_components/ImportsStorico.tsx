'use client'

import { useEffect, useState } from 'react'

export interface ImportRow {
  id: string
  kind: 'pdp' | 'switch_out' | 'admins'
  filename: string | null
  rows_total: number | null
  created: number | null
  updated: number | null
  tagged: number | null
  untagged: number | null
  unmatched: number | null
  skipped: number | null
  duration_ms: number | null
  triggered_by: string | null
  created_at: string
  status: 'running' | 'completed' | 'failed'
  progress_done: number | null
  progress_total: number | null
  last_progress_at: string | null
}

const POLL_MS = 2500
const STALL_THRESHOLD_MS = 60_000 // running but no progress update for 60s → mark stalled

export default function ImportsStorico({ initial }: { initial: ImportRow[] }) {
  const [rows, setRows] = useState<ImportRow[]>(initial)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function tick() {
      if (cancelled) return
      try {
        const r = await fetch('/api/apulia/imports-status', { cache: 'no-store' })
        if (r.ok) {
          const j = await r.json()
          if (!cancelled) setRows(j.history ?? [])
        }
      } catch { /* keep polling */ }
      if (cancelled) return
      // Only poll while at least one row is still running.
      const anyRunning = rows.some((r) => r.status === 'running')
      const intervalForPoll = POLL_MS
      timer = setTimeout(tick, anyRunning ? intervalForPoll : 30_000)
    }

    timer = setTimeout(tick, POLL_MS)
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [rows])

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="ap-table">
        <thead>
          <tr>
            <th>Quando</th>
            <th>Tipo</th>
            <th>File</th>
            <th>Righe</th>
            <th>Risultato</th>
            <th>Durata</th>
            <th>Da</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--ap-text-faint)' }}>Nessun import effettuato.</td></tr>
          )}
          {rows.map((r) => <Row key={r.id} r={r} />)}
        </tbody>
      </table>
    </div>
  )
}

function Row({ r }: { r: ImportRow }) {
  const isRunning = r.status === 'running'
  const isFailed = r.status === 'failed'
  const lastProgressAge = r.last_progress_at ? Date.now() - new Date(r.last_progress_at).getTime() : null
  const stalled = isRunning && lastProgressAge != null && lastProgressAge > STALL_THRESHOLD_MS

  const kindLabel = r.kind === 'pdp' ? 'PDP' : r.kind === 'switch_out' ? 'Switch-out' : 'Amministratori'
  const kindTone = r.kind === 'pdp' ? 'blue' : r.kind === 'switch_out' ? 'amber' : 'green'

  const done = r.progress_done ?? 0
  const total = r.progress_total ?? r.rows_total ?? 0
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0

  return (
    <tr style={isRunning ? { background: 'color-mix(in srgb, var(--ap-blue-soft, #dbeafe) 30%, transparent)' } : undefined}>
      <td>
        {new Date(r.created_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
        {isRunning && (
          <span className="ap-pill" data-tone={stalled ? 'amber' : 'blue'} style={{ marginLeft: 6, fontSize: 10 }}>
            {stalled ? 'In stallo' : 'In corso'}
          </span>
        )}
        {isFailed && <span className="ap-pill" data-tone="red" style={{ marginLeft: 6, fontSize: 10 }}>Fallito</span>}
      </td>
      <td><span className="ap-pill" data-tone={kindTone}>{kindLabel}</span></td>
      <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.filename ?? ''}>{r.filename}</td>
      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
        {isRunning && total > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 110 }}>
            <span style={{ fontSize: 12 }}>{done.toLocaleString('it-IT')} / {total.toLocaleString('it-IT')} <span style={{ color: 'var(--ap-text-faint)' }}>({pct}%)</span></span>
            <div className="ap-progress" style={{ height: 4 }}>
              <div className="ap-progress-bar" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : (
          r.rows_total?.toLocaleString('it-IT') ?? '—'
        )}
      </td>
      <td style={{ fontSize: 12 }}>
        {r.kind === 'pdp' && <>+{r.created ?? 0} · ↻{r.updated ?? 0}{r.untagged ? ` · 🔓${r.untagged}` : ''}{r.unmatched ? ` · ⚠${r.unmatched}` : ''}</>}
        {r.kind === 'switch_out' && <>📤{r.tagged ?? 0}{r.unmatched ? ` · ?${r.unmatched}` : ''}</>}
        {r.kind === 'admins' && <>+{r.created ?? 0} · ↻{r.updated ?? 0}{r.skipped ? ` · ⏭${r.skipped}` : ''}</>}
      </td>
      <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ap-text-muted)' }}>{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
      <td style={{ color: 'var(--ap-text-muted)', fontSize: 12 }}>{r.triggered_by ?? '—'}</td>
    </tr>
  )
}
