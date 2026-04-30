'use client'

import { useState, useTransition } from 'react'
import { setPodOverride } from '../_actions'

interface PodRow {
  contactId: string
  pod: string
  cliente?: string
  comune?: string
  switchedOut: boolean
  override: number
  amount: number
}

interface Props {
  pods: PodRow[]
  defaultAmount: number
  adminContactId: string
}

export default function PodTable({ pods, defaultAmount, adminContactId }: Props) {
  return (
    <table className="ap-table">
      <thead>
        <tr>
          <th>POD/PDR</th>
          <th>Cliente</th>
          <th style={{ textAlign: 'right' }}>Default</th>
          <th style={{ textAlign: 'right' }}>Override</th>
          <th style={{ textAlign: 'right' }}>Importo</th>
        </tr>
      </thead>
      <tbody>
        {pods.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessun condominio.</td></tr>}
        {pods.map((p) => (
          <Row key={p.contactId} pod={p} defaultAmount={defaultAmount} adminContactId={adminContactId} />
        ))}
      </tbody>
    </table>
  )
}

function Row({ pod, defaultAmount, adminContactId }: { pod: PodRow; defaultAmount: number; adminContactId: string }) {
  const [override, setOverride] = useState(pod.override > 0 ? String(pod.override) : '')
  const [pending, startTransition] = useTransition()
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function commit() {
    setError(null)
    const num = override === '' ? 0 : Number(override.replace(',', '.'))
    if (override !== '' && !Number.isFinite(num)) { setError('Numero non valido'); return }
    if ((pod.override || 0) === num) return // no-op
    startTransition(async () => {
      const res = await setPodOverride(pod.contactId, num, adminContactId)
      if (res?.error) setError(res.error)
      else { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200) }
    })
  }

  const effective = override === '' ? defaultAmount : (Number(override.replace(',', '.')) || defaultAmount)

  return (
    <tr>
      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{pod.pod}</td>
      <td>{pod.cliente ?? '—'}</td>
      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--ap-text-muted)' }}>€ {defaultAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
      <td style={{ textAlign: 'right' }}>
        <input
          className="ap-input"
          style={{ height: 30, width: 100, textAlign: 'right' }}
          type="text"
          inputMode="decimal"
          placeholder="—"
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          disabled={pending}
        />
        {error && <div style={{ color: 'var(--ap-danger)', fontSize: 11, marginTop: 2 }}>{error}</div>}
      </td>
      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: pending ? 'var(--ap-text-faint)' : savedFlash ? 'var(--ap-success)' : 'var(--ap-text)' }}>
        € {effective.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
      </td>
    </tr>
  )
}
