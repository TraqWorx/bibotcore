'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  contactId: string
  fieldId: string
  label: string
  initial: string
  type?: string
  inputMode?: 'numeric' | 'decimal' | 'tel' | 'email' | 'text'
  options?: { value: string; label?: string }[]
  placeholder?: string
  multiline?: boolean
  /** Server action that takes (contactId, fieldId, value) and returns { error? }. */
  save: (contactId: string, fieldId: string, value: string) => Promise<{ error?: string } | undefined>
}

export default function FieldRow({ contactId, fieldId, label, initial, type = 'text', inputMode, options, placeholder, multiline, save }: Props) {
  const [val, setVal] = useState(initial ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const router = useRouter()

  function commit() {
    if (val === (initial ?? '')) return
    setError(null)
    startTransition(async () => {
      const res = await save(contactId, fieldId, val)
      if (res?.error) {
        setError(res.error)
        setVal(initial ?? '')
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
      {options && options.length > 0 ? (
        <select
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          disabled={pending}
          className="ap-input"
          style={{ height: 34, fontSize: 13 }}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label ?? o.value}</option>
          ))}
        </select>
      ) : multiline ? (
        <textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          disabled={pending}
          placeholder={placeholder}
          className="ap-input"
          style={{ minHeight: 60, fontSize: 13, fontFamily: 'inherit', padding: 8 }}
        />
      ) : (
        <input
          type={type}
          inputMode={inputMode}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          disabled={pending}
          placeholder={placeholder}
          className="ap-input"
          style={{ height: 34, fontSize: 13 }}
        />
      )}
      {error && <span style={{ fontSize: 11, color: 'var(--ap-danger)' }}>{error}</span>}
    </label>
  )
}
