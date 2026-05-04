'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { setFirstPaymentDate } from '../../amministratori/[id]/_actions'

export interface AdminScheduleEntry {
  contactId: string
  name: string
  podsActive: number
  firstPaymentAt: string | null
  nextDueDate: string | null
  paidCount: number
  isDueNow: boolean
  overdueCount: number
}

export default function AdminPaymentSchedule({ admins }: { admins: AdminScheduleEntry[] }) {
  const [filter, setFilter] = useState<'all' | 'unset' | 'due'>('all')
  const filtered = admins.filter((a) => {
    if (filter === 'unset') return !a.firstPaymentAt
    if (filter === 'due') return a.isDueNow
    return true
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button onClick={() => setFilter('all')} className="ap-pill" data-tone={filter === 'all' ? 'blue' : 'gray'} style={{ border: 'none', cursor: 'pointer' }}>Tutti ({admins.length})</button>
        <button onClick={() => setFilter('unset')} className="ap-pill" data-tone={filter === 'unset' ? 'amber' : 'gray'} style={{ border: 'none', cursor: 'pointer' }}>Senza data ({admins.filter((a) => !a.firstPaymentAt).length})</button>
        <button onClick={() => setFilter('due')} className="ap-pill" data-tone={filter === 'due' ? 'red' : 'gray'} style={{ border: 'none', cursor: 'pointer' }}>Da pagare oggi ({admins.filter((a) => a.isDueNow).length})</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="ap-table">
          <thead>
            <tr>
              <th>Amministratore</th>
              <th style={{ textAlign: 'right' }}>POD attivi</th>
              <th>1° pagamento</th>
              <th>Prossima scadenza</th>
              <th style={{ textAlign: 'right' }}>Pagamenti già fatti</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--ap-text-faint)' }}>Nessun risultato.</td></tr>}
            {filtered.map((a) => <Row key={a.contactId} admin={a} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Row({ admin }: { admin: AdminScheduleEntry }) {
  const [pending, startTransition] = useTransition()
  const [val, setVal] = useState<string>(admin.firstPaymentAt ? admin.firstPaymentAt.slice(0, 10) : '')
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function commit() {
    if (!val) return
    setError(null)
    startTransition(async () => {
      const res = await setFirstPaymentDate(admin.contactId, val)
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
      <td>
        <Link href={`/designs/apulia-power/amministratori/${admin.contactId}`} style={{ color: 'var(--ap-text)', textDecoration: 'none', fontWeight: 600 }}>{admin.name}</Link>
      </td>
      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{admin.podsActive}</td>
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
        {admin.nextDueDate
          ? <span style={{ fontWeight: 600, color: admin.isDueNow ? 'var(--ap-danger)' : admin.overdueCount > 0 ? 'var(--ap-warning)' : 'var(--ap-text)' }}>
              {new Date(admin.nextDueDate).toLocaleDateString('it-IT')}
            </span>
          : <span style={{ color: 'var(--ap-text-faint)' }}>—</span>}
      </td>
      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{admin.paidCount}</td>
      <td>
        {admin.isDueNow
          ? <span className="ap-pill" data-tone="red">Da pagare ora{admin.overdueCount > 1 ? ` (+${admin.overdueCount - 1} in arretrato)` : ''}</span>
          : admin.firstPaymentAt
            ? <span className="ap-pill" data-tone="green">Programmato</span>
            : <span className="ap-pill" data-tone="gray">Da configurare</span>}
      </td>
    </tr>
  )
}
