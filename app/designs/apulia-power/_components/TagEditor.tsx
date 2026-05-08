'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  contactId: string
  initial: string[]
  /** All tags currently in use across the cache, for type-ahead suggestions. */
  suggestions?: string[]
  /**
   * Tags that drive role state and must never be added or removed via the
   * tag UI (amministratore, switch-out, etc). They render but the × is
   * suppressed and submit is blocked. Compared case-insensitively.
   */
  protectedTags?: string[]
  add: (contactId: string, tag: string) => Promise<{ error?: string } | undefined>
  remove: (contactId: string, tag: string) => Promise<{ error?: string } | undefined>
}

export default function TagEditor({ contactId, initial, suggestions = [], protectedTags = [], add, remove }: Props) {
  const protectedSet = new Set(protectedTags.map((t) => t.toLowerCase()))
  const isProtected = (tag: string) => protectedSet.has(tag.toLowerCase())
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
    // Filter both used + protected so they never appear as suggestions.
    const pool = suggestions.filter((s) => !used.has(s.toLowerCase()) && !isProtected(s))
    if (!q) return pool.slice(0, 50) // show top 50 when input is empty
    return pool.filter((s) => s.toLowerCase().includes(q)).slice(0, 50)
  }, [draft, suggestions, tags])

  useEffect(() => { setHighlight(0) }, [draft])

  // Close dropdown on click-outside.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function commitAdd(value: string) {
    const t = value.trim()
    if (!t) return
    if (isProtected(t)) {
      setError(`Il tag "${t}" è gestito automaticamente — non aggiungerlo manualmente.`)
      setDraft('')
      setOpen(false)
      return
    }
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) { setDraft(''); setOpen(false); return }
    setError(null)
    setDraft('')
    setOpen(false)
    setTags((prev) => [...prev, t])
    startTransition(async () => {
      const res = await add(contactId, t)
      if (res?.error) {
        setError(res.error)
        setTags((prev) => prev.filter((x) => x !== t))
      } else {
        router.refresh()
      }
    })
  }

  function submitRemove(t: string) {
    setError(null)
    const prev = tags
    setTags((p) => p.filter((x) => x !== t))
    startTransition(async () => {
      const res = await remove(contactId, t)
      if (res?.error) {
        setError(res.error)
        setTags(prev)
      } else {
        router.refresh()
      }
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && matches.length > 0) {
      e.preventDefault(); setOpen(true); setHighlight((h) => Math.min(matches.length - 1, h + 1))
    } else if (e.key === 'ArrowUp' && matches.length > 0) {
      e.preventDefault(); setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && matches[highlight]) commitAdd(matches[highlight])
      else commitAdd(draft)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 28 }}>
        {tags.length === 0 && <span style={{ fontSize: 12, color: 'var(--ap-text-faint)' }}>Nessun tag.</span>}
        {tags.map((t) => {
          const locked = isProtected(t)
          return (
            <span
              key={t}
              className="ap-pill"
              data-tone={locked ? 'gray' : 'blue'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title={locked ? 'Tag di sistema — gestito automaticamente' : undefined}
            >
              {locked && <span aria-hidden="true">🔒</span>}
              {t}
              {!locked && (
                <button
                  type="button"
                  onClick={() => submitRemove(t)}
                  disabled={pending}
                  aria-label={`Rimuovi ${t}`}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', fontSize: 14, lineHeight: 1, padding: 0, cursor: 'pointer', opacity: 0.6 }}
                >
                  ×
                </button>
              )}
            </span>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, position: 'relative' }}>
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Aggiungi tag…"
          disabled={pending}
          className="ap-input"
          style={{ height: 30, fontSize: 12, flex: 1, maxWidth: 240 }}
          autoComplete="off"
        />
        <button type="button" onClick={() => commitAdd(draft)} disabled={pending || !draft.trim()} className="ap-btn ap-btn-ghost" style={{ height: 30, fontSize: 12 }}>
          + Tag
        </button>
      </div>
      {open && matches.length > 0 && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 2,
            zIndex: 10, maxHeight: 220, overflowY: 'auto',
            width: 'min(280px, 100%)',
            background: 'var(--ap-surface, #fff)', border: '1px solid var(--ap-line)',
            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            fontSize: 12,
          }}
        >
          {matches.map((m, i) => (
            <button
              key={m}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); commitAdd(m) }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 10px',
                background: i === highlight ? 'var(--ap-bg-muted, #f1f5f9)' : 'transparent',
                border: 'none', cursor: 'pointer', color: 'var(--ap-text)',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      )}
      {error && <div style={{ fontSize: 11, color: 'var(--ap-danger)', marginTop: 4 }}>{error}</div>}
    </div>
  )
}
