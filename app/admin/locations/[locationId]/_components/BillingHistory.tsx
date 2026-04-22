'use client'

import { useEffect, useState } from 'react'

interface Payment {
  id: string
  date: string
  amount: number
  stripeFee: number
  net: number
  status: string
  customerEmail: string
  invoiceUrl: string | null
}

function formatEur(cents: number) {
  return (cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BillingHistory({ locationId }: { locationId: string }) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/billing?locationId=${locationId}`)
      .then((r) => r.json())
      .then((d) => setPayments(d.payments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [locationId])

  const totalAmount = payments.reduce((s, p) => s + p.amount, 0)
  const totalFees = payments.reduce((s, p) => s + p.stripeFee, 0)
  const totalNet = payments.reduce((s, p) => s + p.net, 0)

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Billing History</h2>
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand" />
        </div>
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900 mb-1">Billing History</h2>
        <p className="text-xs text-gray-400">No payments found in Stripe for this location.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-bold text-gray-900">Billing History</h2>
        <p className="text-xs text-gray-400 mt-0.5">{payments.length} payments from Stripe</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 border-b border-gray-100 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Total Paid</p>
          <p className="mt-1 text-lg font-black text-gray-900">{'\u20AC'}{formatEur(totalAmount)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Stripe Fees</p>
          <p className="mt-1 text-lg font-black text-red-600">{'\u20AC'}{formatEur(totalFees)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Net Received</p>
          <p className="mt-1 text-lg font-black text-emerald-600">{'\u20AC'}{formatEur(totalNet)}</p>
        </div>
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3">Email</th>
            <th className="px-5 py-3 text-right">Amount</th>
            <th className="px-5 py-3 text-right">Stripe Fee</th>
            <th className="px-5 py-3 text-right">Net</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {payments.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-5 py-3.5 text-gray-900">{formatDate(p.date)}</td>
              <td className="px-5 py-3.5 text-gray-500 text-xs">{p.customerEmail}</td>
              <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{'\u20AC'}{formatEur(p.amount)}</td>
              <td className="px-5 py-3.5 text-right tabular-nums text-red-600">{'\u20AC'}{formatEur(p.stripeFee)}</td>
              <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-emerald-600">{'\u20AC'}{formatEur(p.net)}</td>
              <td className="px-5 py-3.5 text-right">
                {p.invoiceUrl && (
                  <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-brand hover:underline">
                    Invoice
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
