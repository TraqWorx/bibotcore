'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { setCompensoPerPod } from '../../amministratori/_actions'

export interface CompensoEntry {
  contactId: string
  name: string
  podsActive: number
  compensoPerPod: number
  total: number
}

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

export default function CompensiTable({ admins }: { admins: CompensoEntry[] }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'unset'>('all')
  const filtered = admins.filter((a) => {
    if (filter === 'unset' && a.compensoPerPod > 0) return false
    if (q && !a.name.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })
  const totalPods = admins.reduce((s, a) => s + a.podsActive, 0)
  const avgCompenso = admins.filter((a) => a.compensoPerPod > 0).reduce((s, a, _, arr) => s + a.compensoPerPod / arr.length, 0)

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Cerca amministratore…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="ap-input"
          style={{ height: 34, width: 240 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setFilter('all')} className="ap-pill" data-tone={filter === 'all' ? 'blue' : 'gray'} style={{ border: 'none', cursor: 'pointer' }}>
            Tutti ({admins.length})
          </button>
          <button onClick={() => setFilter('unset')} className="ap-pill" data-tone={filter === 'unset' ? 'amber' : 'gray'} style={{ border: 'none', cursor: 'pointer' }}>
            Senza compenso ({admins.filter((a) => a.compensoPerPod === 0).length})
          </button>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ap-text-muted)' }}>
          {totalPods.toLocaleString('it-IT')} POD attivi · media compenso {fmtEur(avgCompenso || 0)}
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--ap-text-faint)', margin: '0 0 10px' }}>
        Modifica il compenso per POD: la commissione totale viene ricalcolata e sincronizzata con Bibot.
        Eventuali override sul singolo POD restano prioritari rispetto a questo valore.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="ap-table">
          <thead>
            <tr>
              <th>Amministratore</th>
              <th style={{ textAlign: 'right' }}>POD attivi</th>
              <th style={{ width: 160 }}>Compenso per POD</th>
              <th style={{ textAlign: 'right' }}>Commissione totale</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: 28, color: 'var(--ap-text-faint)' }}>
                  Nessun risultato.
                </td>
              </tr>
            )}
            {filtered.map((a) => (
              <Row key={a.contactId} admin={a} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Row({ admin }: { admin: CompensoEntry }) {
  const [pending, startTransition] = useTransition()
  const [val, setVal] = useState<string>(admin.compensoPerPod > 0 ? String(admin.compensoPerPod).replace('.', ',') : '')
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState<number>(admin.total)
  const router = useRouter()

  function commit() {
    const parsed = val.trim() === '' ? 0 : Number(val.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Numero non valido')
      return
    }
    if (parsed === admin.compensoPerPod) return
    setError(null)
    startTransition(async () => {
      const res = await setCompensoPerPod(admin.contactId, parsed)
      if (res?.error) setError(res.error)
      else {
        if (typeof res?.total === 'number') setTotal(res.total)
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 1500)
        router.refresh()
      }
    })
  }

  return (
    <tr>
      <td>
        <Link
          href={`/designs/apulia-power/amministratori/${admin.contactId}`}
          style={{ color: 'var(--ap-text)', textDecoration: 'none', fontWeight: 600 }}
        >
          {admin.name}
        </Link>
      </td>
      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{admin.podsActive}</td>
      <td>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--ap-text-muted)' }}>€</span>
          <input
            type="text"
            inputMode="decimal"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            disabled={pending}
            placeholder="0,00"
            className="ap-input"
            style={{ height: 30, width: 100, fontSize: 13, fontFamily: 'monospace', textAlign: 'right' }}
          />
          {pending && <span style={{ color: 'var(--ap-text-faint)', fontSize: 11 }}>…</span>}
          {savedFlash && <span style={{ color: 'var(--ap-success)', fontSize: 11 }}>✓</span>}
        </div>
        {error && <div style={{ color: 'var(--ap-danger)', fontSize: 11, marginTop: 2 }}>{error}</div>}
      </td>
      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
        {fmtEur(total)}
      </td>
    </tr>
  )
}
