'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bulkDeleteCondomini } from '../_actions'

export interface CondominoRow {
  contactId: string
  pod: string
  cliente?: string
  amministratore?: string
  comune?: string
  switchedOut: boolean
}

export default function CondominiBulkSelect({ rows }: { rows: CondominoRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const router = useRouter()

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.contactId))
  const someChecked = !allChecked && rows.some((r) => selected.has(r.contactId))
  const selectedCount = useMemo(() => rows.filter((r) => selected.has(r.contactId)).length, [rows, selected])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(rows.map((r) => r.contactId)))
  }

  function bulkDelete() {
    const ids = rows.filter((r) => selected.has(r.contactId)).map((r) => r.contactId)
    if (ids.length === 0) return
    if (!window.confirm(`Eliminare ${ids.length} condomini?\nQuesta azione non si può annullare.`)) return
    setError(null); setFlash(null)
    startTransition(async () => {
      const res = await bulkDeleteCondomini(ids)
      if (res.error) setError(res.error)
      else {
        setFlash(`Eliminati ${res.deleted} condomini${res.failed ? ` (${res.failed} errori)` : ''}.`)
        setSelected(new Set())
        router.refresh()
      }
    })
  }

  return (
    <>
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
          <div style={{ fontSize: 13, color: 'var(--ap-text)' }}>
            {selectedCount > 0 && <><strong>{selectedCount}</strong> selezionati</>}
            {flash && <span className="ap-pill" data-tone="green" style={{ marginLeft: 8 }}>✓ {flash}</span>}
            {error && <span style={{ color: 'var(--ap-danger)', marginLeft: 8 }}>{error}</span>}
          </div>
          {selectedCount > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setSelected(new Set())} className="ap-btn ap-btn-ghost" style={{ height: 32 }} disabled={pending}>
                Deseleziona
              </button>
              <button
                type="button"
                onClick={bulkDelete}
                disabled={pending}
                className="ap-btn"
                style={{ background: 'var(--ap-danger, #dc2626)', color: '#fff', height: 32 }}
              >
                {pending ? 'Elimino…' : `🗑 Elimina ${selectedCount}`}
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
          {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--ap-text-faint)' }}>Nessun condominio.</td></tr>}
          {rows.map((p) => {
            const checked = selected.has(p.contactId)
            const cellLink = (content: React.ReactNode) => (
              <Link href={`/designs/apulia-power/condomini/${p.contactId}`} style={{ color: 'var(--ap-text)', textDecoration: 'none', display: 'block' }}>
                {content}
              </Link>
            )
            return (
              <tr key={p.contactId} style={checked ? { background: 'var(--ap-bg-soft, #eff6ff)' } : undefined}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.contactId)}
                    aria-label={`Seleziona ${p.pod}`}
                  />
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{cellLink(p.pod)}</td>
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
