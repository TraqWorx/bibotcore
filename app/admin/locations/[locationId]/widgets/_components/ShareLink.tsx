'use client'

import { useState } from 'react'

export default function ShareLink({ locationId, embedToken }: { locationId: string; embedToken: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/embed/${locationId}?token=${embedToken}`

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Share Link</h3>
      <p className="mt-1 text-xs text-gray-500">Share this link with your client or embed it in GHL.</p>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          readOnly
          value={url}
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-600 outline-none"
          onFocus={(e) => e.target.select()}
        />
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
