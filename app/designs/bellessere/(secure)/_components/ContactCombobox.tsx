'use client'

import { useState, useEffect } from 'react'

export interface ComboContact { id: string; firstName: string; lastName: string; email: string; phone: string }

const displayName = (c: ComboContact) => `${c.firstName} ${c.lastName}`.trim() || c.email || c.phone || 'Cliente'

// Server-search contact picker: debounced query to /api/bellessere/contacts so
// it scales to thousands of clients instead of preloading the whole list.
export default function ContactCombobox({ value, onChange, initialContact }: {
  value: string
  onChange: (id: string) => void
  initialContact?: ComboContact | null
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<ComboContact[]>([])
  const [picked, setPicked] = useState<ComboContact | null>(initialContact ?? null)
  const [loading, setLoading] = useState(false)

  // Clear local selection if the parent resets the value
  useEffect(() => { if (!value) setPicked(null) }, [value])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const t = setTimeout(() => {
      const params = new URLSearchParams({ limit: '30' })
      const q = query.trim()
      if (q) params.set('search', q)
      fetch(`/api/bellessere/contacts?${params}`)
        .then(r => r.json())
        .then(d => setResults(d.contacts ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 220)
    return () => clearTimeout(t)
  }, [query, open])

  const pick = (c: ComboContact | null) => {
    setPicked(c); onChange(c?.id ?? ''); setOpen(false); setQuery('')
  }

  return (
    <div style={{ position: 'relative' }}>
      <input className="bs-input" placeholder="Cerca cliente..." autoComplete="off"
        value={open ? query : (picked ? displayName(picked) : '')}
        onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="bs-combo-popover">
          <div onMouseDown={() => pick(null)} className="bs-combo-option" style={{ color: 'var(--bs-text-muted)' }}>Senza cliente</div>
          {loading
            ? <div className="bs-combo-option" style={{ color: 'var(--bs-text-faint)', cursor: 'default' }}>Ricerca…</div>
            : results.length === 0
              ? <div className="bs-combo-option" style={{ color: 'var(--bs-text-faint)', cursor: 'default' }}>Nessun risultato</div>
              : results.map(c => (
                <div key={c.id} onMouseDown={() => pick(c)} className="bs-combo-option" style={{ fontWeight: c.id === value ? 750 : 500 }}>
                  <span>{displayName(c)}</span>
                  {c.phone && <span style={{ fontSize: 11, color: 'var(--bs-text-faint)' }}>{c.phone}</span>}
                </div>
              ))}
        </div>
      )}
    </div>
  )
}
