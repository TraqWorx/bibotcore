'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface SummaryShape {
  type: 'done'
  created?: number
  updated?: number
  untagged?: number
  unmatched?: number
  skipped?: number
  tagged?: number
  alreadyTagged?: number
  durationMs?: number
  recompute?: { admins: number; pods: number; podsActive: number; totalCommissionCents: number }
  enqueued?: boolean
  importId?: string
}

interface Props {
  kind: 'pdp' | 'switch_out' | 'admins'
  title: string
  subtitle: string
  endpoint: string
  emoji: string
}

export default function DropZone({ kind, title, subtitle, endpoint, emoji }: Props) {
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; phase: string }>({ done: 0, total: 0, phase: '' })
  const [summary, setSummary] = useState<SummaryShape | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFile = useCallback(async (file: File) => {
    setBusy(true); setError(null); setSummary(null); setProgress({ done: 0, total: 0, phase: 'Caricamento…' })
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await fetch(endpoint, { method: 'POST', body: fd })
      if (!r.ok) {
        setError(`HTTP ${r.status}: ${await r.text()}`)
        setBusy(false); return
      }
      const ctype = r.headers.get('Content-Type') ?? ''
      if (ctype.includes('application/json')) {
        // Resumable import: server returned an id, watch progress in Storico.
        const j = await r.json()
        setProgress({ done: 0, total: Number(j.total) || 0, phase: 'In coda · vedi Storico per il progresso' })
        setSummary({ type: 'done', enqueued: true, importId: j.importId } as unknown as SummaryShape)
        router.refresh()
        return
      }
      if (!r.body) { setError('Risposta vuota'); setBusy(false); return }
      const reader = r.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          let evt: Record<string, unknown>
          try { evt = JSON.parse(line) } catch { continue }
          handleEvent(evt)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di rete')
    } finally {
      setBusy(false)
      router.refresh()
    }
  }, [endpoint, router])

  function handleEvent(evt: Record<string, unknown>) {
    const t = evt.type
    if (t === 'preflight') setProgress((p) => ({ ...p, phase: 'Lettura contatti esistenti…' }))
    else if (t === 'start') setProgress({ done: 0, total: Number(evt.total) || 0, phase: 'Elaborazione righe…' })
    else if (t === 'progress') setProgress({ done: Number(evt.done) || 0, total: Number(evt.total) || 0, phase: 'Elaborazione righe…' })
    else if (t === 'recompute') setProgress((p) => ({ ...p, phase: 'Aggiornamento commissioni…', done: p.total }))
    else if (t === 'done') setSummary(evt as unknown as SummaryShape)
    else if (t === 'error') setError(String(evt.message ?? 'Errore'))
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0
  const totalCommission = summary?.recompute ? (summary.recompute.totalCommissionCents / 100) : 0

  return (
    <div>
      <div
        className="ap-drop"
        data-dragging={dragging}
        data-busy={busy}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true) }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
      >
        <input ref={fileInput} type="file" accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        <div style={{ fontSize: 32 }}>{emoji}</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--ap-text-muted)', maxWidth: 320 }}>{subtitle}</div>
        {!busy && !summary && <div style={{ fontSize: 12, color: 'var(--ap-text-faint)' }}>Trascina qui il file CSV o XLSX o clicca</div>}

        {busy && (
          <div style={{ width: '100%', maxWidth: 360, marginTop: 8 }}>
            <div className="ap-progress"><div className="ap-progress-bar" style={{ width: `${pct}%` }} /></div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ap-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{progress.phase}</span>
              <span>{progress.total > 0 ? `${progress.done}/${progress.total}` : '…'}</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="ap-card ap-card-pad" style={{ marginTop: 12, borderColor: 'var(--ap-danger)', background: 'color-mix(in srgb, var(--ap-danger) 5%, white)' }}>
          <strong style={{ color: 'var(--ap-danger)' }}>Errore</strong>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--ap-text-muted)' }}>{error}</div>
        </div>
      )}

      {summary && summary.enqueued && (
        <div className="ap-card ap-card-pad" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="ap-pill" data-tone="blue">⏳ In coda</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ap-text-muted)', margin: 0 }}>
            Il file viene elaborato in background — segui il progresso nello Storico qui sotto. Puoi anche aggiornare la pagina o navigare via, l&apos;import continua.
          </p>
        </div>
      )}

      {summary && !summary.enqueued && (
        <div className="ap-card ap-card-pad" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span className="ap-pill" data-tone="green">✓ Completato</span>
            <span style={{ fontSize: 12, color: 'var(--ap-text-muted)' }}>
              in {((summary.durationMs ?? 0) / 1000).toFixed(1)}s
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, fontSize: 13 }}>
            {kind === 'pdp' && (
              <>
                <Stat label="Creati"   value={summary.created ?? 0} tone="green" />
                <Stat label="Aggiornati" value={summary.updated ?? 0} tone="blue" />
                <Stat label="Tag rimossi" value={summary.untagged ?? 0} tone="amber" />
                <Stat label="Saltati" value={summary.skipped ?? 0} tone="gray" />
                <Stat label="Errori" value={summary.unmatched ?? 0} tone={summary.unmatched ? 'red' : 'gray'} />
              </>
            )}
            {kind === 'switch_out' && (
              <>
                <Stat label="Tag aggiunti" value={summary.tagged ?? 0} tone="green" />
                <Stat label="Già taggati" value={summary.alreadyTagged ?? 0} tone="gray" />
                <Stat label="Non trovati" value={summary.unmatched ?? 0} tone={summary.unmatched ? 'amber' : 'gray'} />
                <Stat label="Saltati" value={summary.skipped ?? 0} tone="gray" />
              </>
            )}
            {kind === 'admins' && (
              <>
                <Stat label="Creati" value={summary.created ?? 0} tone="green" />
                <Stat label="Aggiornati" value={summary.updated ?? 0} tone="blue" />
                <Stat label="Saltati" value={summary.skipped ?? 0} tone="gray" />
              </>
            )}
          </div>
          {summary.recompute && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--ap-line)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Commissioni ricalcolate</div>
              <div style={{ marginTop: 6, fontSize: 14 }}>
                <strong>{summary.recompute.admins}</strong> amministratori · <strong>{summary.recompute.podsActive}</strong> PODs attivi · prossima scadenza:{' '}
                <strong style={{ color: 'var(--ap-blue)' }}>€ {totalCommission.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'green' | 'blue' | 'amber' | 'red' | 'gray' }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ap-text-muted)' }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }} className="ap-pill-host">
        <span className="ap-pill" data-tone={tone} style={{ fontSize: 16, padding: '4px 10px' }}>{value}</span>
      </div>
    </div>
  )
}
