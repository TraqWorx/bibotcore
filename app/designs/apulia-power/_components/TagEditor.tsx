'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  contactId: string
  initial: string[]
  add: (contactId: string, tag: string) => Promise<{ error?: string } | undefined>
  remove: (contactId: string, tag: string) => Promise<{ error?: string } | undefined>
}

export default function TagEditor({ contactId, initial, add, remove }: Props) {
  const [tags, setTags] = useState<string[]>(initial ?? [])
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function submitAdd() {
    const t = draft.trim()
    if (!t) return
    if (tags.includes(t)) { setDraft(''); return }
    setError(null)
    setDraft('')
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

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 28 }}>
        {tags.length === 0 && <span style={{ fontSize: 12, color: 'var(--ap-text-faint)' }}>Nessun tag.</span>}
        {tags.map((t) => (
          <span key={t} className="ap-pill" data-tone="blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {t}
            <button
              type="button"
              onClick={() => submitRemove(t)}
              disabled={pending}
              aria-label={`Rimuovi ${t}`}
              style={{ background: 'transparent', border: 'none', color: 'inherit', fontSize: 14, lineHeight: 1, padding: 0, cursor: 'pointer', opacity: 0.6 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); submitAdd() }}
        style={{ display: 'flex', gap: 6, marginTop: 8 }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Aggiungi tag…"
          disabled={pending}
          className="ap-input"
          style={{ height: 30, fontSize: 12, flex: 1, maxWidth: 240 }}
        />
        <button type="submit" disabled={pending || !draft.trim()} className="ap-btn ap-btn-ghost" style={{ height: 30, fontSize: 12 }}>
          + Tag
        </button>
      </form>
      {error && <div style={{ fontSize: 11, color: 'var(--ap-danger)', marginTop: 4 }}>{error}</div>}
    </div>
  )
}
