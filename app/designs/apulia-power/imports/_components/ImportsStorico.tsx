'use client'

import { useEffect, useState, type ReactNode } from 'react'

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
  summary: Record<string, unknown> | null
  error_msg: string | null
}

const POLL_MS = 2500
const STALL_THRESHOLD_MS = 60_000

export default function ImportsStorico({ initial }: { initial: ImportRow[] }) {
  const [rows, setRows] = useState<ImportRow[]>(initial)
  const [openId, setOpenId] = useState<string | null>(null)

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
      const anyRunning = rows.some((r) => r.status === 'running')
      timer = setTimeout(tick, anyRunning ? POLL_MS : 30_000)
    }

    timer = setTimeout(tick, POLL_MS)
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [rows])

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="ap-table">
        <thead>
          <tr>
            <th style={{ width: 24 }}></th>
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
            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--ap-text-faint)' }}>Nessun import effettuato.</td></tr>
          )}
          {rows.map((r) => (
            <RowGroup
              key={r.id}
              r={r}
              open={openId === r.id}
              onToggle={() => setOpenId(openId === r.id ? null : r.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RowGroup({ r, open, onToggle }: { r: ImportRow; open: boolean; onToggle: () => void }) {
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
    <>
      <tr
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          background: isRunning ? 'color-mix(in srgb, var(--ap-blue-soft, #dbeafe) 30%, transparent)' : open ? 'var(--ap-bg-soft, #eff6ff)' : undefined,
        }}
      >
        <td style={{ color: 'var(--ap-text-muted)', textAlign: 'center' }}>{open ? '▾' : '▸'}</td>
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
          {r.kind === 'pdp' && <>+{r.created ?? 0} · {String.fromCodePoint(8635)}{r.updated ?? 0}{r.untagged ? ` · ${String.fromCodePoint(128275)}${r.untagged}` : ''}{r.skipped ? ` · ${String.fromCodePoint(9197)}${String.fromCodePoint(65039)}${r.skipped}` : ''}</>}
          {r.kind === 'switch_out' && <>{String.fromCodePoint(128228)}{r.tagged ?? 0}{r.unmatched ? ` · ?${r.unmatched}` : ''}{r.skipped ? ` · ${String.fromCodePoint(9197)}${String.fromCodePoint(65039)}${r.skipped}` : ''}</>}
          {r.kind === 'admins' && <>+{r.created ?? 0} · {String.fromCodePoint(8635)}{r.updated ?? 0}{r.skipped ? ` · ${String.fromCodePoint(9197)}${String.fromCodePoint(65039)}${r.skipped}` : ''}</>}
        </td>
        <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ap-text-muted)' }}>{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
        <td style={{ color: 'var(--ap-text-muted)', fontSize: 12 }}>{r.triggered_by ?? '—'}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} style={{ background: 'var(--ap-bg-muted, #f8fafc)', padding: 16, borderTop: '1px solid var(--ap-line)' }}>
            <DetailPanel r={r} />
          </td>
        </tr>
      )}
    </>
  )
}

function DetailPanel({ r }: { r: ImportRow }) {
  const summary = r.summary
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {r.error_msg && (
        <div style={{ background: 'color-mix(in srgb, var(--ap-danger, #dc2626) 10%, transparent)', border: '1px solid var(--ap-danger)', borderRadius: 6, padding: 10, fontSize: 12, color: 'var(--ap-danger)' }}>
          <strong>Errore:</strong> {r.error_msg}
        </div>
      )}

      {r.kind === 'pdp' && <PdpDetails r={r} summary={summary as PdpSummary | null} />}
      {r.kind === 'admins' && <AdminsDetails r={r} summary={summary as AdminsSummary | null} />}
      {r.kind === 'switch_out' && <SwitchOutDetails r={r} summary={summary as SwitchOutSummary | null} />}

      {summary && (
        <details style={{ fontSize: 11, color: 'var(--ap-text-muted)' }}>
          <summary style={{ cursor: 'pointer' }}>Dati grezzi (debug)</summary>
          <pre style={{ marginTop: 6, padding: 8, background: 'var(--ap-bg)', borderRadius: 6, overflowX: 'auto', fontSize: 11 }}>
            {JSON.stringify(summary, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

interface PdpSummary {
  skippedReasons?: { no_pod?: number }
  rowsWithPod?: number
  newCondominiCreated?: number
  existingCondominiUpdated?: number
  switchOutCleared?: number
  newAdminsAutoCreated?: number
  collapsedDuplicatePods?: number
  duplicatePodSamples?: Array<{ pod: string; rows: number }>
  recompute?: { admins?: number; pods?: number; podsActive?: number; totalCommissionCents?: number }
}

function PdpDetails({ r, summary }: { r: ImportRow; summary: PdpSummary | null }) {
  const fileRows = r.rows_total ?? 0
  const noPod = summary?.skippedReasons?.no_pod ?? r.skipped ?? 0
  const collapsed = summary?.collapsedDuplicatePods ?? 0
  const created = summary?.newCondominiCreated ?? r.created ?? 0
  const updated = summary?.existingCondominiUpdated ?? r.updated ?? 0
  const accountedFor = noPod + collapsed + created + updated
  const drift = fileRows - accountedFor
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--ap-text-muted)', lineHeight: 1.6 }}>
        <strong>Bilancio righe del file:</strong> {fileRows.toLocaleString('it-IT')} totali = {created.toLocaleString('it-IT')} create + {updated.toLocaleString('it-IT')} aggiornate + {noPod.toLocaleString('it-IT')} saltate + {collapsed.toLocaleString('it-IT')} duplicati uniti
        {drift !== 0 && fileRows > 0 && (
          <span style={{ color: 'var(--ap-warning)' }}> &nbsp;({drift > 0 ? `+${drift}` : drift} non quadra — possibile race con webhook)</span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <Stat label="Righe nel file" value={fileRows} />
        <Stat label="Con POD/PDR" value={summary?.rowsWithPod ?? fileRows - noPod} />
        <Stat label="Saltate (cella POD vuota)" value={noPod} accent={noPod ? 'amber' : undefined} />
        <Stat label="Duplicati POD nel file (uniti)" value={collapsed} accent={collapsed ? 'amber' : undefined} />
        <Stat label="Condomini creati (nuovi)" value={created} accent="green" />
        <Stat label="Condomini aggiornati (esistenti)" value={updated} />
        <Stat label="Switch-out riattivati" value={summary?.switchOutCleared ?? r.untagged ?? 0} />
        <Stat label="Nuovi amministratori (auto)" value={summary?.newAdminsAutoCreated ?? 0} accent="green" />
        {summary?.recompute && (
          <>
            <Stat label="POD attivi totali" value={summary.recompute.podsActive ?? 0} />
            <Stat label="Commissione totale" value={`EUR ${((summary.recompute.totalCommissionCents ?? 0) / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`} />
          </>
        )}
      </div>
      {summary?.duplicatePodSamples && summary.duplicatePodSamples.length > 0 && (
        <details style={{ fontSize: 11 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--ap-warning)', fontWeight: 700 }}>
            POD duplicati nel file ({summary.duplicatePodSamples.length})
          </summary>
          <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: 11, color: 'var(--ap-text-muted)' }}>
            {summary.duplicatePodSamples.map((d, i) => (
              <li key={i}><code>{d.pod}</code> — {d.rows} righe nel file (collassate in 1)</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

interface AdminsSummary {
  skippedReasons?: { missing_name_or_code?: number }
  matchedExistingByCode?: number
  collapsedDuplicateCodes?: number
  updateOpsQueued?: number
  createOpsQueued?: number
}

function AdminsDetails({ r, summary }: { r: ImportRow; summary: AdminsSummary | null }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
      <Stat label="Righe nel file" value={r.rows_total ?? 0} />
      <Stat label="Saltate (nome o codice mancante)" value={summary?.skippedReasons?.missing_name_or_code ?? r.skipped ?? 0} accent={r.skipped ? 'amber' : undefined} />
      <Stat label="Amministratori creati" value={summary?.createOpsQueued ?? r.created ?? 0} accent="green" />
      <Stat label="Esistenti aggiornati" value={summary?.matchedExistingByCode ?? r.updated ?? 0} />
      {summary?.collapsedDuplicateCodes ? (
        <Stat label="Duplicati interni al file (uniti)" value={summary.collapsedDuplicateCodes} accent="amber" />
      ) : null}
    </div>
  )
}

interface SwitchOutSummary {
  skippedReasons?: { no_pod?: number }
  newSwitchOuts?: number
  alreadyMarkedSwitchOut?: number
  podsNotInBibot?: number
  recompute?: { admins?: number; podsActive?: number; totalCommissionCents?: number }
}

function SwitchOutDetails({ r, summary }: { r: ImportRow; summary: SwitchOutSummary | null }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
      <Stat label="Righe nel file" value={r.rows_total ?? 0} />
      <Stat label="Saltate (no POD)" value={summary?.skippedReasons?.no_pod ?? r.skipped ?? 0} accent={r.skipped ? 'amber' : undefined} />
      <Stat label="Marcati switch-out" value={summary?.newSwitchOuts ?? r.tagged ?? 0} accent="amber" />
      <Stat label="Gia switch-out" value={summary?.alreadyMarkedSwitchOut ?? 0} />
      <Stat label="POD non trovati in Bibot" value={summary?.podsNotInBibot ?? r.unmatched ?? 0} accent={(r.unmatched ?? 0) > 0 ? 'red' : undefined} />
      {summary?.recompute && (
        <>
          <Stat label="POD attivi dopo ricalcolo" value={summary.recompute.podsActive ?? 0} />
          <Stat label="Commissione totale" value={`EUR ${((summary.recompute.totalCommissionCents ?? 0) / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`} />
        </>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: 'green' | 'red' | 'amber' }): ReactNode {
  const color = accent === 'green' ? 'var(--ap-success)' : accent === 'red' ? 'var(--ap-danger)' : accent === 'amber' ? 'var(--ap-warning)' : 'var(--ap-text)'
  return (
    <div className="ap-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color }}>{value}</span>
    </div>
  )
}
