'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bulkDeleteCondomini, type BulkDeleteFilters } from '../_actions'

export interface CondominoRow {
  contactId: string
  pod: string
  cliente?: string
  amministratore?: string
  comune?: string
  switchedOut: boolean
  syncStatus?: string
  syncError?: string | null
}

interface Props {
  rows: CondominoRow[]
  total: number
  filters: BulkDeleteFilters
}

export default function CondominiBulkSelect({ rows, total, filters }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [allMatching, setAllMatching] = useState(false)
  const [hideFailed, setHideFailed] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const router = useRouter()

  const failedCount = rows.filter((r) => r.syncStatus === 'failed').length
  const visibleRows = useMemo(
    () => (hideFailed ? rows.filter((r) => r.syncStatus !== 'failed') : rows),
    [rows, hideFailed],
  )

  const allChecked = visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.contactId))
  const someChecked = !allChecked && visibleRows.some((r) => selected.has(r.contactId))
  const pageSelectedCount = useMemo(() => visibleRows.filter((r) => selected.has(r.contactId)).length, [visibleRows, selected])
  const selectedCount = allMatching ? total : pageSelectedCount
  const showAcrossPagesPrompt = allChecked && !allMatching && total > visibleRows.length

  function toggle(id: string) {
    if (allMatching) setAllMatching(false)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setAllMatching(false)
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(visibleRows.map((r) => r.contactId)))
  }

  function clearAll() {
    setAllMatching(false)
    setSelected(new Set())
  }

  function bulkDelete() {
    const ids = visibleRows.filter((r) => selected.has(r.contactId)).map((r) => r.contactId)
    const count = allMatching ? total : ids.length
    if (count === 0) return
    const msg = allMatching
      ? `Eliminare TUTTI i ${total.toLocaleString('it-IT')} condomini che corrispondono al filtro corrente?\nQuesta azione non si può annullare.`
      : `Eliminare ${ids.length} condomini?\nQuesta azione non si può annullare.`
    if (!window.confirm(msg)) return
    setError(null); setFlash(null)
    startTransition(async () => {
      const res = await bulkDeleteCondomini(allMatching ? { filters } : { ids })
      if (res.error) setError(res.error)
      else {
        setFlash(`Eliminati ${res.deleted} condomini${res.failed ? ` (${res.failed} errori)` : ''}.`)
        clearAll()
        router.refresh()
      }
    })
  }

  return (
    <>
      {failedCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--ap-line)', background: 'color-mix(in srgb, var(--ap-danger, #dc2626) 8%, transparent)', fontSize: 12 }}>
          <span style={{ color: 'var(--ap-danger, #dc2626)', fontWeight: 700 }}>⚠ {failedCount} non sincronizzati</span>
          <span style={{ color: 'var(--ap-text-muted)' }}>— righe in rosso. Apri il dettaglio per il motivo.</span>
          <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={hideFailed} onChange={(e) => setHideFailed(e.target.checked)} />
            <span>Nascondi falliti</span>
          </label>
        </div>
      )}
      {(selectedCount > 0 || flash) && (
        <div style={{
          padding: '10px 16px',
          background: 'var(--ap-bg-muted, #f8fafc)',
          borderBottom: '1px solid var(--ap-line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 13, color: 'var(--ap-text)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {selectedCount > 0 && (
              <>
                <strong>{selectedCount.toLocaleString('it-IT')}</strong> selezionati
                {allMatching && <span className="ap-pill" data-tone="blue" style={{ fontSize: 10 }}>tutti i risultati</span>}
              </>
            )}
            {showAcrossPagesPrompt && (
              <button
                type="button"
                onClick={() => setAllMatching(true)}
                className="ap-btn ap-btn-ghost"
                style={{ height: 26, fontSize: 12, padding: '0 10px' }}
              >
                Seleziona tutti i {total.toLocaleString('it-IT')} →
              </button>
            )}
            {allMatching && (
              <button
                type="button"
                onClick={toggleAll}
                className="ap-btn ap-btn-ghost"
                style={{ height: 26, fontSize: 12, padding: '0 10px' }}
              >
                Solo questa pagina ({rows.length})
              </button>
            )}
            {flash && <span className="ap-pill" data-tone="green" style={{ marginLeft: 8 }}>✓ {flash}</span>}
            {error && <span style={{ color: 'var(--ap-danger)', marginLeft: 8 }}>{error}</span>}
          </div>
          {selectedCount > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={clearAll} className="ap-btn ap-btn-ghost" style={{ height: 32 }} disabled={pending}>
                Deseleziona
              </button>
              <button
                type="button"
                onClick={bulkDelete}
                disabled={pending}
                className="ap-btn"
                style={{ background: 'var(--ap-danger, #dc2626)', color: '#fff', height: 32 }}
              >
                {pending ? 'Elimino…' : `🗑 Elimina ${selectedCount.toLocaleString('it-IT')}`}
              </button>
            </div>
          )}
        </div>
      )}
      <table className="ap-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => { if (el) el.indeterminate = someChecked }}
                onChange={toggleAll}
                aria-label="Seleziona tutti"
              />
            </th>
            <th>POD/PDR</th>
            <th>Cliente</th>
            <th>Amministratore</th>
            <th>Comune</th>
            <th>Stato</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--ap-text-faint)' }}>Nessun condominio.</td></tr>}
          {visibleRows.map((p) => {
            const checked = selected.has(p.contactId)
            const isFailed = p.syncStatus === 'failed'
            const rowBg = isFailed
              ? 'color-mix(in srgb, var(--ap-danger, #dc2626) 10%, transparent)'
              : checked
                ? 'var(--ap-bg-soft, #eff6ff)'
                : undefined
            const cellLink = (content: React.ReactNode) => (
              <Link href={`/designs/apulia-power/condomini/${p.contactId}`} style={{ color: isFailed ? 'var(--ap-danger, #dc2626)' : 'var(--ap-text)', textDecoration: 'none', display: 'block' }}>
                {content}
              </Link>
            )
            return (
              <tr key={p.contactId} style={{ background: rowBg, borderLeft: isFailed ? '3px solid var(--ap-danger, #dc2626)' : undefined }}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.contactId)}
                    aria-label={`Seleziona ${p.pod}`}
                  />
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {cellLink(<>{p.pod}{isFailed && <span style={{ marginLeft: 6 }} title={p.syncError ?? 'Sync fallito'}>⚠</span>}</>)}
                </td>
                <td>{cellLink(p.cliente ?? '—')}</td>
                <td>{cellLink(p.amministratore ?? '—')}</td>
                <td>{cellLink(p.comune ?? '—')}</td>
                <td>{p.switchedOut ? <span className="ap-pill" data-tone="amber">Switch-out</span> : <span className="ap-pill" data-tone="green">Attivo</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
