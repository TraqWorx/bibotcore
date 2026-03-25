'use client'

import { useState } from 'react'
import { getGhlOAuthUrl } from '../_actions'

interface Props {
  designSlug: string
}

export default function ReauthorizeButton({ designSlug }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const result = await getGhlOAuthUrl(designSlug)
    if ('error' in result) {
      alert(result.error)
      setLoading(false)
    } else {
      window.location.href = result.url
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
      title="This location uses an agency token. Re-authorize via OAuth to enable contacts, pipelines, etc."
    >
      {loading ? 'Redirecting…' : 'Authorize'}
    </button>
  )
}
