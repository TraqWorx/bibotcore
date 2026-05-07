'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Form field name — we render a hidden input so server actions / form submit pick it up. */
  name: string
  options: string[]
  defaultValue?: string
  placeholder?: string
  /** Width of the wrapper. */
  width?: number | string
}

/**
 * Searchable dropdown: type to filter, scroll to see up to 10 matches.
 * Renders a hidden input named `name` so it works inside a regular HTML
 * <form> (no client-side state plumbing required).
 */
export default function SearchableSelect({ name, options, defaultValue = '', placeholder = 'Tutti', width = '100%' }: Props) {
  const [value, setValue] = useState(defaultValue)
  const [query, setQuery] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const filtered = query.trim() === ''
    ? options
    : options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))

  function pick(o: string) {
    setValue(o)
    setQuery(o)
    setOpen(false)
  }

  function clear() {
    setValue(''); setQuery('')
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', width }}>
      <input type="hidden" name={name} value={value} />
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (e.target.value === '') setValue('') }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="ap-input"
        style={{ height: 36, width: '100%', paddingRight: query ? 28 : 8 }}
        autoComplete="off"
      />
      {query && (
        <button
          type="button"
          aria-label="Cancella"
          onClick={clear}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--ap-text-muted)', fontSize: 16, lineHeight: 1, padding: 4,
          }}
        >×</button>
      )}
      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            zIndex: 10,
            maxHeight: 280, // ~ 10 * 28px
            overflowY: 'auto',
            background: 'var(--ap-bg, #fff)',
            border: '1px solid var(--ap-line)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            fontSize: 13,
          }}
        >
          <button
            type="button"
            onClick={clear}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--ap-line)', color: 'var(--ap-text-muted)', fontStyle: 'italic' }}
          >
            Tutti
          </button>
          {filtered.length === 0 && (
            <div style={{ padding: '12px 12px', color: 'var(--ap-text-faint)' }}>Nessun risultato</div>
          )}
          {filtered.slice(0, 200).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => pick(o)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', background: o === value ? 'var(--ap-bg-muted, #f1f5f9)' : 'transparent',
                border: 'none', cursor: 'pointer',
                color: 'var(--ap-text)',
              }}
            >
              {o}
            </button>
          ))}
          {filtered.length > 200 && (
            <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--ap-text-faint)', borderTop: '1px solid var(--ap-line)' }}>
              {filtered.length - 200} altri… affina la ricerca
            </div>
          )}
        </div>
      )}
    </div>
  )
}
