'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { syncGhlUsers } from '../_actions'

export default function SyncUsersButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [debug, setDebug] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(false)

  async function handleSync() {
    setLoading(true)
    setResult(null)
    setDebug([])
    const res = await syncGhlUsers()
    setLoading(false)
    setDebug(res.debug ?? [])
    if (res.error) {
      setResult(`Error: ${res.error}`)
    } else {
      const parts = []
      if (res.synced > 0) parts.push(`${res.synced} added`)
      if (res.removed > 0) parts.push(`${res.removed} removed`)
      setResult(parts.length > 0 ? parts.join(', ') : 'Up to date')
      if (res.synced > 0 || res.removed > 0) router.refresh()
    }
    setShowDebug(true)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {result && (
          <span className="text-xs text-gray-500">{result}</span>
        )}
        <button
          onClick={handleSync}
          disabled={loading}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Syncing…' : 'Sync GHL Users'}
        </button>
      </div>
      {debug.length > 0 && (
        <div className="w-full max-w-lg">
          <button
            onClick={() => setShowDebug((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {showDebug ? 'Hide' : 'Show'} debug log ({debug.length} lines)
          </button>
          {showDebug && (
            <pre className="mt-1 max-h-60 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 whitespace-pre-wrap">
              {debug.join('\n')}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
