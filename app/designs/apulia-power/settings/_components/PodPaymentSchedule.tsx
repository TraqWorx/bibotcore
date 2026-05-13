'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { setPodFirstPaymentDate } from '../../condomini/[id]/_actions'

export interface PodScheduleEntry {
  contactId: string
  pod: string
  cliente: string
  amministratore: string
  amministratoreId?: string
  firstPaymentAt: string | null
  nextDueDate: string | null
  paidCount: number
  isDueNow: boolean
  amount: number
}

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

export default function PodPaymentSchedule({ pods }: { pods: PodScheduleEntry[] }) {
  const [filter, setFilter] = useState<'all' | 'unset' | 'due'>('all')
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    let out = pods
    if (filter === 'unset') out = out.filter((p) => !p.firstPaymentAt)
    else if (filter === 'due') out = out.filter((p) => p.isDueNow)
    const q = search.trim().toLowerCase()
    if (q) {
      out = out.filter((p) =>
        p.pod.toLowerCase().includes(q) ||
        p.cliente.toLowerCase().includes(q) ||
        p.amministratore.toLowerCase().includes(q),
      )
    }
    return out
  }, [pods, filter, search])

  const counts = useMemo(() => ({
    all: pods.length,
    unset: pods.filter((p) => !p.firstPaymentAt).length,
    due: pods.filter((p) => p.isDueNow).length,
  }), [pods])

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setFilter('all')} className="ap-pill" data-tone={filter === 'all' ? 'blue' : 'gray'} style={{ border: 'none', cursor: 'pointer' }}>Tutti ({counts.all})</button>
          <button onClick={() => setFilter('unset')} className="ap-pill" data-tone={filter === 'unset' ? 'amber' : 'gray'} style={{ border: 'none', cursor: 'pointer' }}>Senza data ({counts.unset})</button>
          <button onClick={() => setFilter('due')} className="ap-pill" data-tone={filter === 'due' ? 'red' : 'gray'} style={{ border: 'none', cursor: 'pointer' }}>Da pagare oggi ({counts.due})</button>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per POD, cliente, amministratore…"
          className="ap-input"
          style={{ flex: '1 1 240px', minWidth: 200, height: 32, fontSize: 12 }}
        />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="ap-table">
          <thead>
            <tr>
              <th>POD/PDR</th>
              <th>Cliente</th>
              <th>Amministratore</th>
              <th style={{ textAlign: 'right' }}>Compenso</th>
              <th>1° pagamento</th>
              <th>Prossima scadenza</th>
              <th style={{ textAlign: 'right' }}>Già pagati</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--ap-text-faint)' }}>Nessun POD.</td></tr>}
            {filtered.map((p) => <Row key={p.contactId} pod={p} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Row({ pod }: { pod: PodScheduleEntry }) {
  const [pending, startTransition] = useTransition()
  const [val, setVal] = useState<string>(pod.firstPaymentAt ? pod.firstPaymentAt.slice(0, 10) : '')
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function commit() {
    if (!val) return
    if (pod.firstPaymentAt && val === pod.firstPaymentAt.slice(0, 10)) return
    setError(null)
    startTransition(async () => {
      const res = await setPodFirstPaymentDate(pod.contactId, val)
      if (res?.error) setError(res.error)
      else {
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 1500)
        router.refresh()
      }
    })
  }

  return (
    <tr>
      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
        <Link href={`/designs/apulia-power/condomini/${pod.contactId}`} style={{ color: 'var(--ap-text)', textDecoration: 'none', fontWeight: 600 }}>{pod.pod}</Link>
      </td>
      <td>{pod.cliente || '—'}</td>
      <td>
        {pod.amministratoreId
          ? <Link href={`/designs/apulia-power/amministratori/${pod.amministratoreId}`} style={{ color: 'var(--ap-text)', textDecoration: 'none' }}>{pod.amministratore}</Link>
          : pod.amministratore || '—'}
      </td>
      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtEur(pod.amount)}</td>
      <td>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="date"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            disabled={pending}
            className="ap-input"
            style={{ height: 30, width: 150, fontSize: 12 }}
          />
          {savedFlash && <span style={{ color: 'var(--ap-success)', fontSize: 11 }}>✓</span>}
        </div>
        {error && <div style={{ color: 'var(--ap-danger)', fontSize: 11, marginTop: 2 }}>{error}</div>}
      </td>
      <td>
        {pod.nextDueDate
          ? <span style={{ fontWeight: 600, color: pod.isDueNow ? 'var(--ap-danger)' : 'var(--ap-text)' }}>
              {new Date(pod.nextDueDate).toLocaleDateString('it-IT')}
            </span>
          : <span style={{ color: 'var(--ap-text-faint)' }}>—</span>}
      </td>
      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pod.paidCount}</td>
      <td>
        {pod.isDueNow
          ? <span className="ap-pill" data-tone="red">Da pagare ora</span>
          : pod.firstPaymentAt
            ? <span className="ap-pill" data-tone="green">Programmato</span>
            : <span className="ap-pill" data-tone="gray">Da configurare</span>}
      </td>
    </tr>
  )
}
