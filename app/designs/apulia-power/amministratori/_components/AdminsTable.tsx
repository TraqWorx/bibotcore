'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { bulkMarkPaid } from '../_actions'

interface AdminRow {
  contactId: string
  name: string
  email?: string
  codiceAmministratore?: string
  compensoPerPod: number
  podsActive: number
  podsSwitchedOut: number
  total: number
  paidThisPeriod: boolean
  paidAt?: string
}

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

export default function AdminsTable({ admins, period }: { admins: AdminRow[]; period: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [flash, setFlash] = useState<string | null>(null)
  const router = useRouter()

  const selectableIds = useMemo(
    () => admins.filter((a) => !a.paidThisPeriod && a.total > 0).map((a) => a.contactId),
    [admins],
  )
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))
  const selectedTotal = useMemo(
    () => admins.filter((a) => selected.has(a.contactId)).reduce((s, a) => s + a.total, 0),
    [admins, selected],
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds))
  }

  function payAll() {
    if (selected.size === 0) return
    if (!confirm(`Confermi il pagamento di ${selected.size} amministratori per ${fmtEur(selectedTotal)}?`)) return
    const amounts = Object.fromEntries(admins.filter((a) => selected.has(a.contactId)).map((a) => [a.contactId, a.total]))
    startTransition(async () => {
      const r = await bulkMarkPaid([...selected], amounts)
      if (r?.error) setFlash(`Errore: ${r.error}`)
      else setFlash(`Pagati ${r?.paid ?? 0} amministratori${r?.skipped ? ` (${r.skipped} già pagati)` : ''}.`)
      setSelected(new Set())
      router.refresh()
      setTimeout(() => setFlash(null), 3500)
    })
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--ap-line)', background: selected.size ? 'color-mix(in srgb, var(--ap-blue-soft) 50%, white)' : 'transparent' }}>
        {selected.size > 0 ? (
          <>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{selected.size} selezionati · {fmtEur(selectedTotal)}</span>
            <button className="ap-btn ap-btn-primary" onClick={payAll} disabled={pending}>
              {pending ? 'Pago…' : `💸 Paga tutti (${fmtEur(selectedTotal)})`}
            </button>
            <button className="ap-btn ap-btn-ghost" onClick={() => setSelected(new Set())}>Annulla</button>
          </>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--ap-text-muted)' }}>
            Seleziona uno o più amministratori per il pagamento di gruppo. Solo non ancora pagati e con importo &gt; 0 sono selezionabili.
          </span>
        )}
        {flash && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: flash.startsWith('Errore') ? 'var(--ap-danger)' : 'var(--ap-success)' }}>{flash}</span>}
      </div>

      <table className="ap-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={selectableIds.length === 0} aria-label="Seleziona tutti" />
            </th>
            <th>Amministratore</th>
            <th>Cod. Amm.</th>
            <th style={{ textAlign: 'right' }}>Compenso/POD</th>
            <th style={{ textAlign: 'right' }}>POD attivi</th>
            <th style={{ textAlign: 'right' }}>Switch-out</th>
            <th style={{ textAlign: 'right' }}>Da pagare</th>
            <th>Stato {period}</th>
          </tr>
        </thead>
        <tbody>
          {admins.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--ap-text-faint)' }}>Nessun amministratore.</td></tr>}
          {admins.map((a) => {
            const canSelect = !a.paidThisPeriod && a.total > 0
            return (
              <tr key={a.contactId} style={{ background: selected.has(a.contactId) ? 'color-mix(in srgb, var(--ap-blue-soft) 30%, transparent)' : undefined }}>
                <td>
                  {canSelect && (
                    <input type="checkbox" checked={selected.has(a.contactId)} onChange={() => toggle(a.contactId)} aria-label={`Seleziona ${a.name}`} />
                  )}
                </td>
                <td>
                  <Link href={`/designs/apulia-power/amministratori/${a.contactId}`} style={{ textDecoration: 'none', color: 'var(--ap-text)', fontWeight: 600 }}>
                    {a.name}
                  </Link>
                  {a.email && <div style={{ fontSize: 11, color: 'var(--ap-text-faint)', marginTop: 2 }}>{a.email}</div>}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--ap-text-muted)' }}>{a.codiceAmministratore ?? '—'}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(a.compensoPerPod)}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.podsActive}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: a.podsSwitchedOut ? 'var(--ap-warning)' : 'var(--ap-text-faint)' }}>{a.podsSwitchedOut}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtEur(a.paidThisPeriod ? 0 : a.total)}</td>
                <td>
                  {a.paidThisPeriod
                    ? <span className="ap-pill" data-tone="green">✓ Pagato {a.paidAt ? new Date(a.paidAt).toLocaleDateString('it-IT') : ''}</span>
                    : <span className="ap-pill" data-tone="amber">Da pagare</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
