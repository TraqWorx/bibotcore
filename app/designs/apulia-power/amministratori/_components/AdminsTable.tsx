'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { bulkMarkPaid, bulkDeleteAdmins } from '../_actions'

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
  firstPaymentAt?: string
  nextDueDate?: string
  isDueNow?: boolean
  overdueCount?: number
}

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

export default function AdminsTable({ admins, period }: { admins: AdminRow[]; period: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [flash, setFlash] = useState<string | null>(null)
  const router = useRouter()

  const allSelected = admins.length > 0 && admins.every((a) => selected.has(a.contactId))
  const selectedTotal = useMemo(
    () => admins.filter((a) => selected.has(a.contactId)).reduce((s, a) => s + a.total, 0),
    [admins, selected],
  )
  const billableSelected = useMemo(
    () => admins.filter((a) => selected.has(a.contactId) && a.isDueNow && a.total > 0),
    [admins, selected],
  )
  const canBulkPay = billableSelected.length === selected.size && selected.size > 0

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(admins.map((a) => a.contactId)))
  }

  function payAll() {
    if (billableSelected.length === 0) return
    if (!confirm(`Confermi il pagamento di ${billableSelected.length} amministratori per ${fmtEur(selectedTotal)}?`)) return
    const amounts = Object.fromEntries(billableSelected.map((a) => [a.contactId, a.total]))
    startTransition(async () => {
      const r = await bulkMarkPaid(billableSelected.map((a) => a.contactId), amounts)
      if (r?.error) setFlash(`Errore: ${r.error}`)
      else setFlash(`Pagati ${r?.paid ?? 0} amministratori${r?.skipped ? ` (${r.skipped} già pagati)` : ''}.`)
      setSelected(new Set())
      router.refresh()
      setTimeout(() => setFlash(null), 3500)
    })
  }

  function deleteSelected() {
    if (selected.size === 0) return
    const ids = [...selected]
    if (!confirm(`Eliminare ${ids.length} amministratori?\nEventuali POD associati verranno lasciati orfani (POD intatti, senza amministratore).\nQuesta azione non si può annullare.`)) return
    startTransition(async () => {
      const r = await bulkDeleteAdmins(ids)
      if (r.error) setFlash(`Errore: ${r.error}`)
      else setFlash(`Eliminati ${r.deleted} amministratori${r.failed ? ` (${r.failed} errori)` : ''}.`)
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
            <span style={{ fontWeight: 700, fontSize: 13 }}>{selected.size} selezionati{canBulkPay && <> · {fmtEur(selectedTotal)}</>}</span>
            {canBulkPay && (
              <button className="ap-btn ap-btn-primary" onClick={payAll} disabled={pending}>
                {pending ? 'Pago…' : `💸 Paga tutti (${fmtEur(selectedTotal)})`}
              </button>
            )}
            <button
              type="button"
              onClick={deleteSelected}
              disabled={pending}
              className="ap-btn"
              style={{ background: 'var(--ap-danger, #dc2626)', color: '#fff' }}
            >
              {pending ? 'Elimino…' : `🗑 Elimina ${selected.size}`}
            </button>
            <button className="ap-btn ap-btn-ghost" onClick={() => setSelected(new Set())}>Annulla</button>
          </>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--ap-text-muted)' }}>
            Seleziona uno o più amministratori per pagamento di gruppo o eliminazione bulk.
          </span>
        )}
        {flash && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: flash.startsWith('Errore') ? 'var(--ap-danger)' : 'var(--ap-success)' }}>{flash}</span>}
      </div>

      <table className="ap-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={admins.length === 0} aria-label="Seleziona tutti" />
            </th>
            <th>Amministratore</th>
            <th>Cod. Amm.</th>
            <th style={{ textAlign: 'right' }}>POD attivi</th>
            <th style={{ textAlign: 'right' }}>Da pagare</th>
            <th>Prossima scadenza</th>
            <th>Stato</th>
          </tr>
        </thead>
        <tbody>
          {admins.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--ap-text-faint)' }}>Nessun amministratore.</td></tr>}
          {admins.map((a) => {
            return (
              <tr key={a.contactId} style={{ background: selected.has(a.contactId) ? 'color-mix(in srgb, var(--ap-blue-soft) 30%, transparent)' : undefined }}>
                <td>
                  <input type="checkbox" checked={selected.has(a.contactId)} onChange={() => toggle(a.contactId)} aria-label={`Seleziona ${a.name}`} />
                </td>
                <td>
                  <Link href={`/designs/apulia-power/amministratori/${a.contactId}`} style={{ textDecoration: 'none', color: 'var(--ap-text)', fontWeight: 600 }}>
                    {a.name}
                  </Link>
                  {a.email && <div style={{ fontSize: 11, color: 'var(--ap-text-faint)', marginTop: 2 }}>{a.email}</div>}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--ap-text-muted)' }}>{a.codiceAmministratore ?? '—'}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.podsActive}{a.podsSwitchedOut > 0 && <span style={{ color: 'var(--ap-warning)', fontSize: 11, marginLeft: 4 }}>+{a.podsSwitchedOut} so</span>}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtEur(a.total)}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: a.isDueNow ? 'var(--ap-danger)' : a.firstPaymentAt ? 'var(--ap-text)' : 'var(--ap-text-faint)' }}>
                  {a.nextDueDate ? new Date(a.nextDueDate).toLocaleDateString('it-IT') : 'Da configurare'}
                </td>
                <td>
                  {a.isDueNow
                    ? <span className="ap-pill" data-tone="red">Da pagare ora{a.overdueCount && a.overdueCount > 1 ? ` (+${a.overdueCount - 1})` : ''}</span>
                    : a.firstPaymentAt
                      ? <span className="ap-pill" data-tone="green">Programmato</span>
                      : <span className="ap-pill" data-tone="gray">Senza data</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
