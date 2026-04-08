'use client'

import { useState } from 'react'
import { saveBillingDetails, saveAgencyName } from '../_actions'
import { ad } from '@/lib/admin/ui'

interface Agency {
  name: string
  email: string
  billing_name: string | null
  billing_email: string | null
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city: string | null
  billing_postal_code: string | null
  billing_country: string | null
  billing_vat: string | null
  billing_sdi: string | null
  stripe_customer_id: string | null
}

function EmbedLink() {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = `${origin}/embed/{{location.id}}`

  return (
    <div className={ad.panel}>
      <h2 className="text-sm font-bold text-gray-900 mb-1">GHL Custom Menu Link</h2>
      <p className="text-xs text-gray-500 mb-3">Add this URL as a custom menu link in GHL. It uses the dynamic <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px]">{'{{location.id}}'}</code> variable so each sub-account sees its own dashboard.</p>
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={url}
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-600 outline-none"
          onFocus={(e) => e.target.select()}
        />
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export default function AccountForm({ agency }: { agency: Agency }) {
  const [agencyName, setAgencyName] = useState(agency.name)
  const [savingName, setSavingName] = useState(false)
  const [savingBilling, setSavingBilling] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10'
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1'

  async function handleSaveName() {
    setSavingName(true)
    setMessage(null)
    const result = await saveAgencyName(agencyName)
    if (result?.error) setMessage({ type: 'error', text: result.error })
    else setMessage({ type: 'success', text: 'Agency name updated' })
    setSavingName(false)
  }

  async function handleSaveBilling(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSavingBilling(true)
    setMessage(null)
    const formData = new FormData(e.currentTarget)
    const result = await saveBillingDetails(formData)
    if (result?.error) setMessage({ type: 'error', text: result.error })
    else setMessage({ type: 'success', text: 'Billing details saved' })
    setSavingBilling(false)
  }

  async function handleOpenPortal() {
    setOpeningPortal(true)
    setMessage(null)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    } else {
      const data = await res.json().catch(() => ({}))
      setMessage({ type: 'error', text: data.error ?? 'Failed to open billing portal' })
      setOpeningPortal(false)
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-xl border px-4 py-2 text-xs font-medium ${
          message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'
        }`}>
          {message.text}
        </div>
      )}

      {/* GHL Embed Link */}
      <EmbedLink />

      {/* Agency Name */}
      <div className={ad.panel}>
        <h2 className="text-sm font-bold text-gray-900 mb-4">Agency</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className={labelClass}>Agency Name</label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            onClick={handleSaveName}
            disabled={savingName || agencyName === agency.name}
            className={`${ad.btnPrimary} px-4 py-2 text-sm shrink-0 disabled:opacity-50`}
          >
            {savingName ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Billing Details */}
      <form onSubmit={handleSaveBilling} className={ad.panel}>
        <h2 className="text-sm font-bold text-gray-900 mb-4">Billing Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Billing Name</label>
            <input name="billing_name" defaultValue={agency.billing_name ?? ''} className={inputClass} placeholder="Company name for invoices" />
          </div>
          <div>
            <label className={labelClass}>Billing Email</label>
            <input name="billing_email" type="email" defaultValue={agency.billing_email ?? agency.email} className={inputClass} placeholder="Invoices sent to this email" />
          </div>
          <div>
            <label className={labelClass}>VAT Number</label>
            <input name="billing_vat" defaultValue={agency.billing_vat ?? ''} className={inputClass} placeholder="e.g. IT01234567890" />
          </div>
          <div>
            <label className={labelClass}>SDI Code</label>
            <input name="billing_sdi" defaultValue={agency.billing_sdi ?? ''} className={inputClass} placeholder="Codice destinatario" />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Address Line 1</label>
            <input name="billing_address_line1" defaultValue={agency.billing_address_line1 ?? ''} className={inputClass} placeholder="Street address" />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Address Line 2</label>
            <input name="billing_address_line2" defaultValue={agency.billing_address_line2 ?? ''} className={inputClass} placeholder="Apt, suite, etc. (optional)" />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input name="billing_city" defaultValue={agency.billing_city ?? ''} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Postal Code</label>
            <input name="billing_postal_code" defaultValue={agency.billing_postal_code ?? ''} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Country</label>
            <input name="billing_country" defaultValue={agency.billing_country ?? 'IT'} className={inputClass} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={savingBilling} className={`${ad.btnPrimary} px-5 py-2 text-sm disabled:opacity-50`}>
            {savingBilling ? 'Saving...' : 'Save Billing Details'}
          </button>
        </div>
      </form>

      {/* Payment Method & Invoices — Stripe Portal */}
      <div className={ad.panel}>
        <h2 className="text-sm font-bold text-gray-900 mb-1">Payment & Invoices</h2>
        <p className="text-xs text-gray-500 mb-4">Manage your payment method, view past invoices, and download receipts via the Stripe billing portal.</p>
        <button
          onClick={handleOpenPortal}
          disabled={openingPortal || !agency.stripe_customer_id}
          className={`${ad.btnPrimary} px-5 py-2 text-sm disabled:opacity-50`}
        >
          {openingPortal ? 'Opening...' : 'Manage Payment & Invoices'}
        </button>
        {!agency.stripe_customer_id && (
          <p className="mt-2 text-xs text-gray-400">No payment method on file. Subscribe to a plan to enable billing management.</p>
        )}
      </div>
    </div>
  )
}
