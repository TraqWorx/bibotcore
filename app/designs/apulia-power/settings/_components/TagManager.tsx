'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTagGlobally } from '../_actions'

export interface TagUsage {
  tag: string
  count: number
}

export default function TagManager({ tags }: { tags: TagUsage[] }) {
  const [q, setQ] = useState('')
  const [pending, startTransition] = useTransition()
  const [busyTag, setBusyTag] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const router = useRouter()

  const filtered = tags.filter((t) => !q || t.tag.toLowerCase().includes(q.toLowerCase()))

  function onDelete(tag: string, count: number) {
    if (!window.confirm(`Eliminare il tag "${tag}" da ${count} contatti?\nQuesta azione non si può annullare.`)) return
    setError(null)
    setFlash(null)
    setBusyTag(tag)
    startTransition(async () => {
      const res = await deleteTagGlobally(tag)
      setBusyTag(null)
      if (res.error) {
        setError(res.error)
        return
      }
      setFlash(`Tag "${tag}" rimosso da ${res.removed} contatti${res.failed ? ` (${res.failed} errori)` : ''}.`)
      router.refresh()
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Cerca tag…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="ap-input"
          style={{ height: 34, width: 240 }}
        />
        <span style={{ fontSize: 12, color: 'var(--ap-text-muted)' }}>
          {tags.length} tag distinti · {tags.reduce((s, t) => s + t.count, 0).toLocaleString('it-IT')} usi totali
        </span>
      </div>
      {flash && <div className="ap-pill" data-tone="green" style={{ marginBottom: 10 }}>✓ {flash}</div>}
      {error && <div style={{ color: 'var(--ap-danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <p style={{ fontSize: 12, color: 'var(--ap-text-faint)', margin: '0 0 10px' }}>
        Eliminare un tag lo rimuove da tutti i contatti su Bibot. Operazione non reversibile.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="ap-table">
          <thead>
            <tr>
              <th>Tag</th>
              <th style={{ textAlign: 'right' }}>Contatti</th>
              <th style={{ textAlign: 'right', width: 140 }}>Azione</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 28, color: 'var(--ap-text-faint)' }}>Nessun tag.</td></tr>}
            {filtered.map((t) => (
              <tr key={t.tag}>
                <td><span className="ap-pill" data-tone="blue">{t.tag}</span></td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.count.toLocaleString('it-IT')}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => onDelete(t.tag, t.count)}
                    disabled={pending}
                    className="ap-btn"
                    style={{
                      background: 'transparent',
                      color: 'var(--ap-danger, #dc2626)',
                      border: '1px solid var(--ap-danger, #dc2626)',
                      fontSize: 11,
                      height: 28,
                      padding: '0 12px',
                      opacity: pending && busyTag === t.tag ? 0.6 : 1,
                    }}
                  >
                    {busyTag === t.tag ? 'Rimuovo…' : 'Elimina'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
