'use client'

import { useMemo, useState } from 'react'

interface Workflow {
  id: string
  name: string
  status: string
  version?: number
}

/**
 * Group workflows by inferred "folder" since GHL's public API doesn't
 * expose actual folder metadata. Heuristic:
 *   - "store N <…>" → group "Store N"
 *   - else: use first word of the name (e.g., "Bisceglie", "Torino")
 *   - utility names that don't fit → "Generale"
 */
function inferFolder(name: string): string {
  const storeMatch = name.match(/^store\s+(\d+)/i)
  if (storeMatch) return `Store ${storeMatch[1]}`
  const firstWord = (name.split(/\s+/)[0] ?? '').replace(/[^\w]/g, '')
  if (/^(promo|qualification|workflow)$/i.test(firstWord)) return 'Generale'
  if (!firstWord) return 'Generale'
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1)
}

export default function WorkflowsPanel({ workflows }: { workflows: Workflow[] }) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [search, setSearch] = useState('')
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({})

  const filtered = useMemo(() => {
    let out = workflows
    if (statusFilter !== 'all') out = out.filter((w) => (w.status ?? '').toLowerCase() === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) out = out.filter((w) => w.name.toLowerCase().includes(q))
    return out
  }, [workflows, statusFilter, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Workflow[]>()
    for (const w of filtered) {
      const folder = inferFolder(w.name)
      let arr = map.get(folder)
      if (!arr) { arr = []; map.set(folder, arr) }
      arr.push(w)
    }
    // Sort: Store N numerically asc; cities alphabetically; "Generale" last.
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ma = a.match(/^Store (\d+)$/)
      const mb = b.match(/^Store (\d+)$/)
      if (ma && mb) return Number(ma[1]) - Number(mb[1])
      if (ma) return -1
      if (mb) return 1
      if (a === 'Generale') return 1
      if (b === 'Generale') return -1
      return a.localeCompare(b)
    })
  }, [filtered])

  const publishedCount = workflows.filter((w) => (w.status ?? '').toLowerCase() === 'published').length
  const draftCount = workflows.length - publishedCount

  function toggleFolder(name: string) {
    setOpenFolders((prev) => ({ ...prev, [name]: !(prev[name] ?? true) }))
  }

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
          {filtered.length} di {workflows.length} · {grouped.length} {grouped.length === 1 ? 'cartella' : 'cartelle'}
        </span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--ap-text-faint)', marginBottom: 12 }}>
        Lo stato è gestito direttamente in GHL — l&apos;API non permette di cambiarlo da qui. Le cartelle sono dedotte dal nome (GHL non espone i folder).
      </div>

      {grouped.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ap-text-faint)', fontSize: 13 }}>
          Nessun workflow.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {grouped.map(([folder, items]) => {
          const open = openFolders[folder] ?? true
          const folderPublished = items.filter((w) => (w.status ?? '').toLowerCase() === 'published').length
          return (
            <div key={folder} style={{ border: '1px solid var(--ap-line)', borderRadius: 10, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => toggleFolder(folder)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 14px', background: 'var(--ap-bg-muted, #f1f5f9)',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--ap-text-muted)' }}>{open ? '▾' : '▸'}</span>
                <span style={{ fontSize: 12, fontWeight: 800 }}>📁 {folder}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ap-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {items.length} workflow{items.length === 1 ? '' : 's'}
                  {folderPublished > 0 && <> · <span style={{ color: 'var(--ap-success)' }}>{folderPublished} pubblicati</span></>}
                </span>
              </button>
              {open && (
                <table className="ap-table" style={{ borderTop: '1px solid var(--ap-line)' }}>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Stato</th>
                      <th style={{ textAlign: 'right' }}>Versione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((w) => {
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
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
