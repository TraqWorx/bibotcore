'use client'

import { useMemo, useState } from 'react'

interface Workflow {
  id: string
  name: string
  status: string
  version?: number
}

export default function WorkflowsPanel({ workflows }: { workflows: Workflow[] }) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let out = workflows
    if (statusFilter !== 'all') out = out.filter((w) => (w.status ?? '').toLowerCase() === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) out = out.filter((w) => w.name.toLowerCase().includes(q))
    return out
  }, [workflows, statusFilter, search])

  const publishedCount = workflows.filter((w) => (w.status ?? '').toLowerCase() === 'published').length
  const draftCount = workflows.length - publishedCount

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome…"
          style={{ height: 32, fontSize: 12, padding: '0 10px', border: '1px solid var(--ap-line-strong)', borderRadius: 8, flex: '1 1 220px', minWidth: 200, background: 'var(--ap-surface, #fff)' }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          style={{ height: 32, fontSize: 12, padding: '0 10px', border: '1px solid var(--ap-line-strong)', borderRadius: 8, background: 'var(--ap-surface, #fff)', cursor: 'pointer' }}
        >
          <option value="all">Tutti gli stati</option>
          <option value="published">Solo pubblicati ({publishedCount})</option>
          <option value="draft">Solo bozze ({draftCount})</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ap-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {filtered.length} di {workflows.length}
        </span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--ap-text-faint)', marginBottom: 8 }}>
        Lo stato è gestito direttamente in GHL — l&apos;API non permette di cambiarlo da qui.
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="ap-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Stato</th>
              <th style={{ textAlign: 'right' }}>Versione</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessun workflow.</td></tr>
            )}
            {filtered.map((w) => {
              const status = (w.status ?? '').toLowerCase()
              return (
                <tr key={w.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{w.name}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--ap-text-faint)' }}>{w.id}</div>
                  </td>
                  <td>
                    <span className="ap-pill" data-tone={status === 'published' ? 'green' : 'amber'} style={{ fontSize: 10 }}>
                      {status === 'published' ? '✓ Pubblicato' : status === 'draft' ? '✎ Bozza' : w.status ?? '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--ap-text-muted)', fontSize: 12 }}>
                    {w.version ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
