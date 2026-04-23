'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addCost, updateCost, deleteCost } from '../_actions'
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

export default function FinancesClient({ costs, mrr, monthlyVat = 0, affiliateMonthlyCost = 0, affiliateTotalOwed = 0 }: { costs: Cost[]; mrr: number; monthlyVat?: number; affiliateMonthlyCost?: number; affiliateTotalOwed?: number }) {
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
      <div className="grid grid-cols-5 gap-4">
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
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">VAT 22%</p>
          <p className="mt-2 text-3xl font-black text-amber-600">{'\u20AC'}{formatEur(monthlyVat)}</p>
          <p className="mt-0.5 text-xs text-gray-400">collected for government</p>
        </div>
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Monthly Profit</p>
          <p className={`mt-2 text-3xl font-black ${monthlyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {'\u20AC'}{formatEur(monthlyProfit)}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">MRR minus costs</p>
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
    </div>
  )
}
