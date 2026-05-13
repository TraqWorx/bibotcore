'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { setCompensoPerPod, setCompensoPerPodBulk } from '../../amministratori/_actions'

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

function parseAmount(raw: string): number | null {
  const v = raw.trim()
  if (v === '') return 0
  const n = Number(v.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export default function CompensiTable({ admins }: { admins: CompensoEntry[] }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'unset'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkVal, setBulkVal] = useState('')
  const [bulkPending, startBulkTransition] = useTransition()
  const [bulkFlash, setBulkFlash] = useState<string | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const router = useRouter()

  const filtered = useMemo(() => admins.filter((a) => {
    if (filter === 'unset' && a.compensoPerPod > 0) return false
    if (q && !a.name.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [admins, q, filter])

  const totalPods = admins.reduce((s, a) => s + a.podsActive, 0)
  const avgCompenso = admins.filter((a) => a.compensoPerPod > 0).reduce((s, a, _, arr) => s + a.compensoPerPod / arr.length, 0)

  const filteredIds = useMemo(() => filtered.map((a) => a.contactId), [filtered])
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))
  const someFilteredSelected = filteredIds.some((id) => selected.has(id)) && !allFilteredSelected

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const id of filteredIds) next.delete(id)
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const id of filteredIds) next.add(id)
        return next
      })
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function applyBulk() {
    const parsed = parseAmount(bulkVal)
    if (parsed === null) { setBulkError('Importo non valido'); return }
    if (selected.size === 0) return
    setBulkError(null)
    setBulkFlash(null)
    startBulkTransition(async () => {
      const ids = Array.from(selected)
      const res = await setCompensoPerPodBulk(ids, parsed)
      if (res.error) setBulkError(res.error)
      else {
        setBulkFlash(`✓ Aggiornati ${res.updated} amministratori${res.failed ? ` (${res.failed} errori)` : ''}`)
        setSelected(new Set())
        setTimeout(() => setBulkFlash(null), 2500)
        router.refresh()
      }
    })
  }

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

      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--ap-bg-muted, #f1f5f9)', border: '1px solid var(--ap-line)', borderRadius: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {selected.size} amministratori selezionati
          </span>
          <div style={{ flex: 1 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--ap-text-muted)' }}>Imposta compenso:</span>
            <span style={{ fontSize: 12, color: 'var(--ap-text-muted)' }}>€</span>
            <input
              type="text"
              inputMode="decimal"
              value={bulkVal}
              onChange={(e) => setBulkVal(e.target.value)}
              placeholder="0,00"
              className="ap-input"
              style={{ height: 30, width: 90, fontSize: 12, fontFamily: 'monospace', textAlign: 'right' }}
            />
          </label>
          <button
            type="button"
            onClick={applyBulk}
            disabled={bulkPending || bulkVal.trim() === ''}
            className="ap-btn ap-btn-primary"
            style={{ height: 30, fontSize: 12 }}
          >
            {bulkPending ? 'Applico…' : 'Applica a selezionati'}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ap-btn ap-btn-ghost"
            style={{ height: 30, fontSize: 12 }}
          >
            Annulla
          </button>
          {bulkFlash && <span style={{ color: 'var(--ap-success)', fontSize: 12, fontWeight: 600 }}>{bulkFlash}</span>}
          {bulkError && <span style={{ color: 'var(--ap-danger)', fontSize: 12 }}>{bulkError}</span>}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="ap-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(el) => { if (el) el.indeterminate = someFilteredSelected }}
                  onChange={toggleAll}
                  aria-label="Seleziona tutti"
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>Amministratore</th>
              <th style={{ textAlign: 'right' }}>POD attivi</th>
              <th style={{ width: 160 }}>Compenso per POD</th>
              <th style={{ textAlign: 'right' }}>Commissione totale</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--ap-text-faint)' }}>
                  Nessun risultato.
                </td>
              </tr>
            )}
            {filtered.map((a) => (
              <Row key={a.contactId} admin={a} selected={selected.has(a.contactId)} onToggle={() => toggleOne(a.contactId)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Row({ admin, selected, onToggle }: { admin: CompensoEntry; selected: boolean; onToggle: () => void }) {
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
    <tr style={selected ? { background: 'color-mix(in srgb, var(--ap-blue-soft, #dbeafe) 25%, transparent)' } : undefined}>
      <td>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Seleziona ${admin.name}`} style={{ cursor: 'pointer' }} />
      </td>
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
