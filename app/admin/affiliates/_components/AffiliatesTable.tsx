'use client'

import { useState } from 'react'

interface AffiliateCustomer {
  firstName?: string
  lastName?: string
  email?: string
  createdAt?: string
  type?: string
}

interface AffiliateRow {
  _id: string
  firstName?: string
  lastName?: string
  email?: string
  active?: boolean
  revenue?: number
  paid?: number
  owned?: number
  customer?: number
  lead?: number
  currency?: string
  createdAt?: string
  locationId: string
  commissionPercent: number | null
  customers: AffiliateCustomer[]
}

function formatMoney(amount: number | undefined | null, currency?: string): string {
  if (amount == null) return '—'
  const sym = currency === 'EUR' ? '€' : '$'
  return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function monthsSince(iso: string): number {
  const start = new Date(iso)
  const now = new Date()
  return Math.max(1, Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)))
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AffiliatesTable({ affiliates }: { affiliates: AffiliateRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
            <th className="px-5 py-3">Affiliate</th>
            <th className="px-5 py-3">Email</th>
            <th className="px-5 py-3 text-center">%</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3 text-center">Customers</th>
            <th className="px-5 py-3 text-center">Leads</th>
            <th className="px-5 py-3 text-right">Revenue</th>
            <th className="px-5 py-3 text-right">Owed</th>
            <th className="px-5 py-3 text-right">Paid</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {affiliates.map((a) => {
            const isExpanded = expandedId === a._id
            return (
              <Fragment key={`${a.locationId}-${a._id}`}>
                <tr
                  className={`transition-colors cursor-pointer ${isExpanded ? 'bg-brand/5' : 'hover:bg-gray-50/50'}`}
                  onClick={() => setExpandedId(isExpanded ? null : a._id)}
                >
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {(`${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || '—')}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{a.email ?? '—'}</td>
                  <td className="px-5 py-3.5 text-center">
                    {a.commissionPercent != null ? (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">{a.commissionPercent}%</span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {a.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center font-semibold tabular-nums">{a.customer ?? 0}</td>
                  <td className="px-5 py-3.5 text-center font-semibold tabular-nums">{a.lead ?? 0}</td>
                  <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{formatMoney(a.revenue, a.currency)}</td>
                  <td className="px-5 py-3.5 text-right font-bold tabular-nums text-red-600">{formatMoney(a.owned, a.currency)}</td>
                  <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-emerald-600">{formatMoney(a.paid, a.currency)}</td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={9} className="bg-gray-50/80 px-5 py-4">
                      {a.customers.length === 0 ? (
                        <p className="text-xs text-gray-400">No customers connected to this affiliate</p>
                      ) : (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Connected Sub-accounts</p>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                <th className="pb-2">Customer</th>
                                <th className="pb-2">Email</th>
                                <th className="pb-2">Connected</th>
                                <th className="pb-2 text-center">Months</th>
                                <th className="pb-2 text-right">Monthly Commission</th>
                                <th className="pb-2 text-right">Total Commission</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {a.customers.map((c, i) => {
                                const months = c.createdAt ? monthsSince(c.createdAt) : 0
                                // Estimate: total owed / total customers gives avg per customer
                                const perCustomerTotal = (a.customer ?? 0) > 0 ? (a.owned ?? 0) / (a.customer ?? 1) : 0
                                const monthlyCommission = months > 0 ? perCustomerTotal / months : 0
                                return (
                                  <tr key={i}>
                                    <td className="py-2 font-medium text-gray-900">
                                      {(`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—')}
                                    </td>
                                    <td className="py-2 text-gray-500">{c.email ?? '—'}</td>
                                    <td className="py-2 text-gray-500">{c.createdAt ? formatDate(c.createdAt) : '—'}</td>
                                    <td className="py-2 text-center font-semibold">{months}</td>
                                    <td className="py-2 text-right tabular-nums">{formatMoney(monthlyCommission, a.currency)}</td>
                                    <td className="py-2 text-right font-semibold tabular-nums text-red-600">{formatMoney(perCustomerTotal, a.currency)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-gray-200">
                                <td colSpan={4} className="pt-2 font-bold text-gray-900">Total</td>
                                <td className="pt-2 text-right font-bold tabular-nums">
                                  {formatMoney(a.customers.length > 0 && a.createdAt ? (a.owned ?? 0) / monthsSince(a.createdAt) : 0, a.currency)}/mo
                                </td>
                                <td className="pt-2 text-right font-bold tabular-nums text-red-600">{formatMoney(a.owned, a.currency)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Need Fragment import
import { Fragment } from 'react'
