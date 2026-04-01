'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ad } from '@/lib/admin/ui'

export default function SyncPlansButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleSync() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/sync-ghl-plans')
      const data = await res.json()
      if (!res.ok || data.error) {
        setResult(`Error: ${data.error ?? 'Unknown error'}`)
      } else {
        setResult(`Synced ${data.synced} plan(s)`)
        router.refresh()
      }
    } catch {
      setResult('Error: Network failure')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className={`text-sm ${result.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>
          {result}
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={loading}
        className={ad.btnPrimary}
      >
        {loading ? 'Syncing…' : 'Sync GHL Plans'}
      </button>
    </div>
  )
}
