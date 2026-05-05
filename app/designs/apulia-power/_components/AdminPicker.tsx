'use client'

import { useState, useTransition, useId } from 'react'
import { useRouter } from 'next/navigation'

export interface AdminOption {
  contactId: string
  name: string
  code: string
}

interface Props {
  options: AdminOption[]
  /** Current code value (the one already linked to this contact). */
  initialCode: string
  /** Current name (display fallback if code doesn't resolve). */
  initialName?: string
  /** Server action that links a code → returns updated state. */
  onSelect: (code: string) => Promise<{ error?: string } | undefined>
  label?: string
  /** When true, used inside a form (no auto-save), the parent reads via name. */
  controlled?: boolean
  onChange?: (code: string, name: string) => void
}

/**
 * Searchable dropdown of amministratori. Uses a native <datalist> so it works
 * without external deps and stays accessible. When the user picks a code or
 * matching name, we resolve to a single canonical {code, name} pair and call
 * onSelect — the server action then writes BOTH fields to GHL atomically.
 */
export default function AdminPicker({ options, initialCode, initialName, onSelect, label = 'Amministratore', controlled, onChange }: Props) {
  const listId = useId()
  const initial = options.find((o) => o.code === initialCode)
  const initialDisplay = initial ? formatOption(initial) : (initialCode ? `${initialCode}${initialName ? ` · ${initialName}` : ''}` : '')
  const [val, setVal] = useState<string>(initialDisplay)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const router = useRouter()

  function resolve(input: string): AdminOption | null {
    const trimmed = input.trim()
    if (!trimmed) return null
    // Exact match first.
    const exact = options.find((o) => formatOption(o) === trimmed || o.code === trimmed)
    if (exact) return exact
    // Then startswith on code (e.g. user typed just the code).
    const byCode = options.find((o) => o.code.toLowerCase() === trimmed.toLowerCase())
    if (byCode) return byCode
    // Or full-name match.
    const byName = options.find((o) => o.name.toLowerCase() === trimmed.toLowerCase())
    return byName ?? null
  }

  function commit() {
    const trimmed = val.trim()
    if (controlled) {
      const m = resolve(trimmed)
      if (m) {
        onChange?.(m.code, m.name)
        setVal(formatOption(m))
      } else {
        onChange?.('', '')
      }
      return
    }

    if (!trimmed) {
      // Clearing the link.
      if (initialCode === '') return
      setError(null)
      startTransition(async () => {
        const res = await onSelect('')
        if (res?.error) setError(res.error)
        else { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500); router.refresh() }
      })
      return
    }
    const match = resolve(trimmed)
    if (!match) {
      setError('Amministratore non trovato. Selezionalo dalla lista o lascia vuoto.')
      setVal(initialDisplay)
      return
    }
    if (match.code === initialCode) {
      setVal(formatOption(match))
      return
    }
    setError(null)
    setVal(formatOption(match))
    startTransition(async () => {
      const res = await onSelect(match.code)
      if (res?.error) {
        setError(res.error)
        setVal(initialDisplay)
      } else {
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 1500)
        router.refresh()
      }
    })
  }

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--ap-text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{label}</span>
        {pending && <span style={{ color: 'var(--ap-text-faint)' }}>…</span>}
        {savedFlash && <span style={{ color: 'var(--ap-success)' }}>✓ salvato</span>}
      </span>
      <input
        type="text"
        list={listId}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        disabled={pending}
        placeholder="Cerca per codice o nome…"
        className="ap-input"
        style={{ height: 34, fontSize: 13 }}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.contactId} value={formatOption(o)} />
        ))}
      </datalist>
      {error && <span style={{ fontSize: 11, color: 'var(--ap-danger)' }}>{error}</span>}
    </label>
  )
}

function formatOption(o: AdminOption): string {
  return `${o.code} · ${o.name}`
}
