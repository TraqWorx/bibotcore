'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  contactId: string
  initial: string[]
  suggestions?: string[]
  add: (contactId: string, tag: string) => Promise<{ error?: string } | undefined>
  remove: (contactId: string, tag: string) => Promise<{ error?: string } | undefined>
}

/** Pills + type-ahead tag editor (modeled on Apulia's). */
export default function TagEditor({ contactId, initial, suggestions = [], add, remove }: Props) {
  const [tags, setTags] = useState<string[]>(initial ?? [])
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const router = useRouter()

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase()
    const used = new Set(tags.map((t) => t.toLowerCase()))
    const pool = suggestions.filter((s) => !used.has(s.toLowerCase()))
    return (q ? pool.filter((s) => s.toLowerCase().includes(q)) : pool).slice(0, 50)
  }, [draft, suggestions, tags])

  useEffect(() => { setHighlight(0) }, [draft])
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function commitAdd(value: string) {
    const t = value.trim()
    if (!t) return
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) { setDraft(''); setOpen(false); return }
    setError(null); setDraft(''); setOpen(false)
    setTags((prev) => [...prev, t])
    startTransition(async () => {
      const res = await add(contactId, t)
      if (res?.error) { setError(res.error); setTags((prev) => prev.filter((x) => x !== t)) }
      else router.refresh()
    })
  }

  function submitRemove(t: string) {
    setError(null)
    const prev = tags
    setTags((p) => p.filter((x) => x !== t))
    startTransition(async () => {
      const res = await remove(contactId, t)
      if (res?.error) { setError(res.error); setTags(prev) }
      else router.refresh()
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && matches.length) { e.preventDefault(); setOpen(true); setHighlight((h) => Math.min(matches.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp' && matches.length) { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); commitAdd(open && matches[highlight] ? matches[highlight] : draft) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 28 }}>
        {tags.length === 0 && <span style={{ fontSize: 12, color: 'var(--fc-text-faint)' }}>Nessun tag.</span>}
        {tags.map((t) => (
          <span key={t} className="fc-pill" data-tone="blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {t}
            <button type="button" onClick={() => submitRemove(t)} disabled={pending} aria-label={`Rimuovi ${t}`}
              style={{ background: 'transparent', border: 'none', color: 'inherit', fontSize: 14, lineHeight: 1, padding: 0, cursor: 'pointer', opacity: 0.6 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Aggiungi tag…"
          disabled={pending}
          autoComplete="off"
          style={{ height: 32, fontSize: 13, flex: 1, maxWidth: 240, padding: '0 10px', borderRadius: 8, border: '1px solid var(--fc-line-strong)' }}
        />
        <button type="button" className="fc-btn-ghost" onClick={() => commitAdd(draft)} disabled={pending || !draft.trim()} style={{ height: 32, fontSize: 13 }}>+ Tag</button>
      </div>
      {error && <p style={{ color: 'var(--fc-danger)', fontSize: 12, marginTop: 6 }}>{error}</p>}
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 2, zIndex: 10, maxHeight: 220, overflowY: 'auto', width: 'min(280px,100%)', background: 'var(--fc-surface)', border: '1px solid var(--fc-line)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontSize: 13 }}>
          {matches.map((m, i) => (
            <button key={m} type="button" onMouseDown={(e) => { e.preventDefault(); commitAdd(m) }} onMouseEnter={() => setHighlight(i)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: i === highlight ? 'var(--fc-bg)' : 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fc-text)' }}>
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
