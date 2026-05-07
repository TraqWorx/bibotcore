'use client'

import { useMemo, useState, useTransition } from 'react'
import { setPodOverride, markPodsPaid, unmarkPodPaid } from '../_actions'

interface PodRow {
  contactId: string
  pod: string
  cliente?: string
  comune?: string
  switchedOut: boolean
  override: number
  amount: number
  addedAt?: string
  lastPaidAt?: string
  nextDueDate?: string
  paymentStatus?: 'paid' | 'due'
  paidCount?: number
}

interface Props {
  pods: PodRow[]
  defaultAmount: number
  adminContactId: string
  /** Hide payment-related columns / actions (used for the switch-out tab). */
  payable?: boolean
}

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT')
}

export default function PodTable({ pods, defaultAmount, adminContactId, payable = true }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [flash, setFlash] = useState<string | null>(null)
  const [addedFrom, setAddedFrom] = useState('')
  const [addedTo, setAddedTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'paid'>('all')

  const visiblePods = useMemo(() => {
    let out = pods
    if (addedFrom) {
      const f = new Date(addedFrom + 'T00:00:00').getTime()
      out = out.filter((p) => p.addedAt && new Date(p.addedAt).getTime() >= f)
    }
    if (addedTo) {
      const t = new Date(addedTo + 'T23:59:59').getTime()
      out = out.filter((p) => p.addedAt && new Date(p.addedAt).getTime() <= t)
    }
    if (statusFilter !== 'all') out = out.filter((p) => p.paymentStatus === statusFilter)
    return out
  }, [pods, addedFrom, addedTo, statusFilter])

  const dueRows = useMemo(() => visiblePods.filter((p) => p.paymentStatus === 'due'), [visiblePods])
  const selectedRows = useMemo(() => pods.filter((p) => selected.has(p.contactId)), [pods, selected])
  const selectedTotal = selectedRows.reduce((s, r) => s + r.amount, 0)
  const allDueSelected = dueRows.length > 0 && dueRows.every((r) => selected.has(r.contactId))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function selectAllDue() {
    setSelected(allDueSelected ? new Set() : new Set(dueRows.map((r) => r.contactId)))
  }
  function clearSel() { setSelected(new Set()) }

  function payNow() {
    if (selectedRows.length === 0) return
    if (!confirm(`Confermi il pagamento di ${selectedRows.length} POD per ${fmtEur(selectedTotal)}?`)) return
    startTransition(async () => {
      const r = await markPodsPaid(adminContactId, selectedRows.map((p) => p.contactId))
      if (r?.error) setFlash(`Errore: ${r.error}`)
      else setFlash(`Pagati ${r?.paid ?? 0} POD per ${fmtEur(selectedTotal)}.`)
      setSelected(new Set())
      setTimeout(() => setFlash(null), 4000)
    })
  }

  function unpayPod(podId: string) {
    if (!confirm('Annullare l\'ultimo pagamento di questo POD?')) return
    startTransition(async () => {
      const r = await unmarkPodPaid(podId, adminContactId)
      if (r?.error) setFlash(`Errore: ${r.error}`)
      else setFlash('Pagamento annullato.')
      setTimeout(() => setFlash(null), 3000)
    })
  }

  const filtersActive = !!(addedFrom || addedTo || statusFilter !== 'all')

  return (
    <>
      {payable && selected.size === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--ap-line)', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--ap-line)', borderRadius: 8, padding: '4px 8px', background: 'var(--ap-surface, #fff)', flex: '0 0 auto' }}>
            <span style={{ fontSize: 11, color: 'var(--ap-text-muted)', whiteSpace: 'nowrap' }}>Aggiunti</span>
            <input type="date" value={addedFrom} onChange={(e) => setAddedFrom(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 12, height: 24, outline: 'none', width: 130 }} />
            <span style={{ fontSize: 11, color: 'var(--ap-text-faint)' }}>→</span>
            <input type="date" value={addedTo} onChange={(e) => setAddedTo(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 12, height: 24, outline: 'none', width: 130 }} />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            style={{ height: 32, fontSize: 12, padding: '0 10px', border: '1px solid var(--ap-line-strong)', borderRadius: 8, background: 'var(--ap-surface, #fff)', color: 'var(--ap-text)', width: 'auto', flex: '0 0 auto', cursor: 'pointer' }}
          >
            <option value="all">Tutti gli stati</option>
            <option value="due">Solo Da Pagare</option>
            <option value="paid">Solo Pagati</option>
          </select>
          {filtersActive && (
            <button type="button" className="ap-btn ap-btn-ghost" style={{ height: 32, fontSize: 12, flex: '0 0 auto' }} onClick={() => { setAddedFrom(''); setAddedTo(''); setStatusFilter('all') }}>
              Reset
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--ap-text-muted)', fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>
            {visiblePods.length} di {pods.length}
          </span>
          {dueRows.length > 0 && (
            <button type="button" onClick={selectAllDue} className="ap-btn ap-btn-ghost" style={{ marginLeft: 'auto', height: 32, fontSize: 12, color: 'var(--ap-blue)', fontWeight: 700, flex: '0 0 auto' }}>
              ☑ {filtersActive ? `Seleziona ${dueRows.length} filtrati` : `Seleziona tutti i ${dueRows.length} da pagare`}
            </button>
          )}
          {flash && (
            <span style={{ fontSize: 12, fontWeight: 600, color: flash.startsWith('Errore') ? 'var(--ap-danger)' : 'var(--ap-success)' }}>
              {flash}
            </span>
          )}
        </div>
      )}
      {payable && selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--ap-line)', flexWrap: 'wrap', background: 'color-mix(in srgb, var(--ap-blue-soft) 50%, white)' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>
            {selected.size} selezionati · {fmtEur(selectedTotal)}
          </span>
          <button className="ap-btn ap-btn-primary" onClick={payNow} disabled={pending}>
            {pending ? 'Pago…' : `💸 Paga ${fmtEur(selectedTotal)}`}
          </button>
          <button className="ap-btn ap-btn-ghost" onClick={clearSel} disabled={pending}>Annulla selezione</button>
          {flash && (
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: flash.startsWith('Errore') ? 'var(--ap-danger)' : 'var(--ap-success)' }}>
              {flash}
            </span>
          )}
        </div>
      )}

      <table className="ap-table">
        <thead>
          <tr>
            {payable && (
              <th style={{ width: 36 }}>
                <input type="checkbox" checked={allDueSelected} onChange={selectAllDue} aria-label="Seleziona tutti da pagare" disabled={dueRows.length === 0} />
              </th>
            )}
            <th>Aggiunto il</th>
            <th>POD/PDR</th>
            <th>Cliente</th>
            {payable && <th>Stato</th>}
            {payable && <th>Pagato il</th>}
            {payable && <th>Prossima scadenza</th>}
            <th style={{ textAlign: 'right' }}>Override</th>
            <th style={{ textAlign: 'right' }}>Importo</th>
            {payable && <th></th>}
          </tr>
        </thead>
        <tbody>
          {visiblePods.length === 0 && (
            <tr>
              <td colSpan={payable ? 10 : 5} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>
                {pods.length === 0 ? 'Nessun condominio.' : 'Nessun risultato per i filtri selezionati.'}
              </td>
            </tr>
          )}
          {visiblePods.map((p) => (
            <Row
              key={p.contactId}
              pod={p}
              defaultAmount={defaultAmount}
              adminContactId={adminContactId}
              payable={payable}
              isSelected={selected.has(p.contactId)}
              onToggle={() => toggle(p.contactId)}
              onUnpay={() => unpayPod(p.contactId)}
              actionPending={pending}
            />
          ))}
        </tbody>
      </table>
    </>
  )
}

function Row({
  pod, defaultAmount, adminContactId, payable, isSelected, onToggle, onUnpay, actionPending,
}: {
  pod: PodRow
  defaultAmount: number
  adminContactId: string
  payable: boolean
  isSelected: boolean
  onToggle: () => void
  onUnpay: () => void
  actionPending: boolean
}) {
  const [override, setOverride] = useState(pod.override > 0 ? String(pod.override) : '')
  const [pending, startTransition] = useTransition()
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function commit() {
    setError(null)
    const num = override === '' ? 0 : Number(override.replace(',', '.'))
    if (override !== '' && !Number.isFinite(num)) { setError('Numero non valido'); return }
    if ((pod.override || 0) === num) return
    startTransition(async () => {
      const res = await setPodOverride(pod.contactId, num, adminContactId)
      if (res?.error) setError(res.error)
      else { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200) }
    })
  }

  const effective = override === '' ? defaultAmount : (Number(override.replace(',', '.')) || defaultAmount)
  const isDue = pod.paymentStatus === 'due'
  const isPaid = pod.paymentStatus === 'paid'
  const rowBg = payable && isSelected ? 'color-mix(in srgb, var(--ap-blue-soft) 30%, transparent)' : undefined

  return (
    <tr style={{ background: rowBg }}>
      {payable && (
        <td>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            disabled={!isDue}
            title={isDue ? 'Seleziona per il pagamento' : 'Già pagato — non selezionabile'}
            aria-label={`Seleziona ${pod.pod}`}
          />
        </td>
      )}
      <td style={{ fontSize: 12, color: 'var(--ap-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
        {fmtDate(pod.addedAt)}
      </td>
      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{pod.pod}</td>
      <td>{pod.cliente ?? '—'}</td>
      {payable && (
        <td>
          {isDue ? (
            <span className="ap-pill" data-tone="amber">Da Pagare</span>
          ) : isPaid ? (
            <span className="ap-pill" data-tone="green">Pagato</span>
          ) : (
            <span className="ap-pill" data-tone="gray">—</span>
          )}
        </td>
      )}
      {payable && (
        <td style={{ fontSize: 12, color: 'var(--ap-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {fmtDate(pod.lastPaidAt)}
        </td>
      )}
      {payable && (
        <td style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: isDue ? 'var(--ap-danger)' : 'var(--ap-text-muted)' }}>
          {fmtDate(pod.nextDueDate)}
        </td>
      )}
      <td style={{ textAlign: 'right' }}>
        <input
          className="ap-input"
          style={{ height: 30, width: 90, textAlign: 'right' }}
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
        {fmtEur(effective)}
      </td>
      {payable && (
        <td>
          {isPaid && (
            <button
              type="button"
              onClick={onUnpay}
              disabled={actionPending}
              className="ap-btn ap-btn-ghost"
              style={{ height: 26, fontSize: 11, padding: '0 8px' }}
              title="Annulla l'ultimo pagamento di questo POD"
            >
              ↶
            </button>
          )}
        </td>
      )}
    </tr>
  )
}
