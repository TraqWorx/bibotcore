'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addCost, updateCost, deleteCost, addVatPayment, deleteVatPayment } from '../_actions'
import { ad } from '@/lib/admin/ui'

interface Cost {
  id: string
  name: string
  amount: number
  frequency: 'monthly' | 'annual'
}

function formatEur(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function monthlyCost(cost: Cost): number {
  return cost.frequency === 'annual' ? cost.amount / 12 : cost.amount
}

interface VatPayment {
  id: string
  amount: number
  period: string
  notes: string | null
  paid_at: string
}

export default function FinancesClient({ costs, mrr, monthlyVat = 0, totalVatOwed = 0, vatPayments = [], affiliateMonthlyCost = 0, affiliateTotalOwed = 0 }: { costs: Cost[]; mrr: number; monthlyVat?: number; totalVatOwed?: number; vatPayments?: VatPayment[]; affiliateMonthlyCost?: number; affiliateTotalOwed?: number }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalMonthlyCosts = costs.reduce((s, c) => s + monthlyCost(c), 0) + affiliateMonthlyCost
  const monthlyProfit = mrr - totalMonthlyCosts

  function startEdit(cost: Cost) {
    setEditingId(cost.id)
    setName(cost.name)
    setAmount(String(cost.amount))
    setFrequency(cost.frequency)
    setAdding(false)
    setError(null)
  }

  function startAdd() {
    setAdding(true)
    setEditingId(null)
    setName('')
    setAmount('')
    setFrequency('monthly')
    setError(null)
  }

  function cancel() {
    setAdding(false)
    setEditingId(null)
    setError(null)
  }

  async function handleSave() {
    setLoading(true)
    setError(null)
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); setLoading(false); return }

    let result
    if (editingId) {
      result = await updateCost(editingId, name, amt, frequency)
    } else {
      result = await addCost(name, amt, frequency)
    }
    if (result?.error) {
      setError(result.error)
    } else {
      cancel()
      router.refresh()
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this cost?')) return
    setLoading(true)
    await deleteCost(id)
    setLoading(false)
    router.refresh()
  }

  const inputClass = 'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10'

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">MRR</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">{'\u20AC'}{formatEur(mrr)}</p>
          <p className="mt-0.5 text-xs text-gray-400">monthly recurring revenue</p>
        </div>
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Monthly Costs</p>
          <p className="mt-2 text-3xl font-black text-red-600">{'\u20AC'}{formatEur(totalMonthlyCosts)}</p>
          <p className="mt-0.5 text-xs text-gray-400">{costs.length} cost{costs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Monthly Profit</p>
          <p className={`mt-2 text-3xl font-black ${monthlyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {'\u20AC'}{formatEur(monthlyProfit)}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">MRR minus costs</p>
        </div>
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Monthly VAT</p>
          <p className="mt-2 text-3xl font-black text-amber-600">{'\u20AC'}{formatEur(monthlyVat)}</p>
          <p className="mt-0.5 text-xs text-gray-400">22% collected for gov</p>
        </div>
      </div>

      {/* Costs table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-bold text-gray-900">Costs</h2>
          {!adding && !editingId && (
            <button onClick={startAdd} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800">
              Add Cost
            </button>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3">Frequency</th>
              <th className="px-5 py-3 text-right">Monthly</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {affiliateMonthlyCost > 0 && (
              <tr className="bg-amber-50/30">
                <td className="px-5 py-3.5 font-medium text-gray-900">Affiliate Commissions</td>
                <td className="px-5 py-3.5 text-right font-semibold tabular-nums">—</td>
                <td className="px-5 py-3.5">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700">from GHL</span>
                </td>
                <td className="px-5 py-3.5 text-right font-bold tabular-nums text-gray-900">{'\u20AC'}{formatEur(affiliateMonthlyCost)}</td>
                <td className="px-5 py-3.5" />
              </tr>
            )}
            {costs.map((cost) => (
              editingId === cost.id ? (
                <tr key={cost.id} className="bg-brand/5">
                  <td className="px-5 py-3"><input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass + ' w-full'} /></td>
                  <td className="px-5 py-3"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass + ' w-24 text-right'} step="0.01" /></td>
                  <td className="px-5 py-3">
                    <select value={frequency} onChange={(e) => setFrequency(e.target.value as 'monthly' | 'annual')} className={inputClass}>
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-gray-400">
                    {'\u20AC'}{formatEur(frequency === 'annual' ? parseFloat(amount || '0') / 12 : parseFloat(amount || '0'))}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={handleSave} disabled={loading} className="rounded-lg bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
                        {loading ? '...' : 'Save'}
                      </button>
                      <button onClick={cancel} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500 hover:bg-gray-50">Cancel</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={cost.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{cost.name}</td>
                  <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{'\u20AC'}{formatEur(cost.amount)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cost.frequency === 'annual' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {cost.frequency}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold tabular-nums text-gray-900">{'\u20AC'}{formatEur(monthlyCost(cost))}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => startEdit(cost)} className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50">Edit</button>
                      <button onClick={() => handleDelete(cost.id)} className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Remove</button>
                    </div>
                  </td>
                </tr>
              )
            ))}

            {/* Add row */}
            {adding && (
              <tr className="bg-brand/5">
                <td className="px-5 py-3"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cost name" className={inputClass + ' w-full'} autoFocus /></td>
                <td className="px-5 py-3"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={inputClass + ' w-24 text-right'} step="0.01" /></td>
                <td className="px-5 py-3">
                  <select value={frequency} onChange={(e) => setFrequency(e.target.value as 'monthly' | 'annual')} className={inputClass}>
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </td>
                <td className="px-5 py-3 text-right text-xs text-gray-400">
                  {'\u20AC'}{formatEur(frequency === 'annual' ? parseFloat(amount || '0') / 12 : parseFloat(amount || '0'))}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={handleSave} disabled={loading || !name.trim()} className="rounded-lg bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
                      {loading ? '...' : 'Add'}
                    </button>
                    <button onClick={cancel} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500 hover:bg-gray-50">Cancel</button>
                  </div>
                </td>
              </tr>
            )}

            {costs.length === 0 && !adding && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No costs added yet</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50/50">
              <td className="px-5 py-3 font-bold text-gray-900">Total Costs</td>
              <td className="px-5 py-3" />
              <td className="px-5 py-3" />
              <td className="px-5 py-3 text-right font-black tabular-nums text-gray-900">{'\u20AC'}{formatEur(totalMonthlyCosts)}/mo</td>
              <td className="px-5 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      {/* VAT Tracking */}
      <VatTracker totalVatOwed={totalVatOwed} vatPayments={vatPayments} />
    </div>
  )
}

function VatTracker({ totalVatOwed, vatPayments }: { totalVatOwed: number; vatPayments: VatPayment[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalPaid = vatPayments.reduce((s, p) => s + p.amount, 0)
  const due = totalVatOwed - totalPaid

  async function handleAdd() {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return }
    if (!period.trim()) { setError('Enter a period'); return }
    setLoading(true)
    setError(null)
    const result = await addVatPayment(amt, period, notes || undefined)
    if (result?.error) {
      setError(result.error)
    } else {
      setAdding(false)
      setAmount('')
      setPeriod('')
      setNotes('')
      router.refresh()
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this VAT payment?')) return
    await deleteVatPayment(id)
    router.refresh()
  }

  const inputClass = 'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10'

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/30 px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">VAT Tracker</h2>
          <p className="text-xs text-gray-400 mt-0.5">22% VAT collected on all revenue</p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">
            Record Payment
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 border-b border-gray-100 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Total VAT Owed</p>
          <p className="mt-1 text-lg font-black text-amber-600">{'\u20AC'}{formatEur(totalVatOwed)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Paid</p>
          <p className="mt-1 text-lg font-black text-emerald-600">{'\u20AC'}{formatEur(totalPaid)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Due</p>
          <p className={`mt-1 text-lg font-black ${due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{'\u20AC'}{formatEur(due)}</p>
        </div>
      </div>

      {/* Payments table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
            <th className="px-5 py-3">Period</th>
            <th className="px-5 py-3 text-right">Amount</th>
            <th className="px-5 py-3">Notes</th>
            <th className="px-5 py-3">Paid On</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {vatPayments.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-5 py-3.5 font-medium text-gray-900">{p.period}</td>
              <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-emerald-600">{'\u20AC'}{formatEur(p.amount)}</td>
              <td className="px-5 py-3.5 text-xs text-gray-500">{p.notes ?? '—'}</td>
              <td className="px-5 py-3.5 text-xs text-gray-400">{new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
              <td className="px-5 py-3.5 text-right">
                <button onClick={() => handleDelete(p.id)} className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Remove</button>
              </td>
            </tr>
          ))}
          {adding && (
            <tr className="bg-amber-50/30">
              <td className="px-5 py-3"><input type="text" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. Q1 2026" className={inputClass + ' w-full'} autoFocus /></td>
              <td className="px-5 py-3"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={inputClass + ' w-24 text-right'} step="0.01" /></td>
              <td className="px-5 py-3"><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" className={inputClass + ' w-full'} /></td>
              <td className="px-5 py-3" />
              <td className="px-5 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={handleAdd} disabled={loading} className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">{loading ? '...' : 'Save'}</button>
                  <button onClick={() => { setAdding(false); setError(null) }} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500 hover:bg-gray-50">Cancel</button>
                </div>
              </td>
            </tr>
          )}
          {vatPayments.length === 0 && !adding && (
            <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No VAT payments recorded yet</td></tr>
          )}
        </tbody>
      </table>

      {error && <p className="px-5 py-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}
