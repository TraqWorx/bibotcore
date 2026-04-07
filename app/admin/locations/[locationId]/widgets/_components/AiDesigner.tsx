'use client'

import { useState } from 'react'
import type { DashboardLayout } from '@/lib/widgets/types'
import WidgetGrid from '@/lib/widgets/WidgetGrid'

interface Props {
  locationId: string
  currentConfig: DashboardLayout | null
  onSave: (config: DashboardLayout) => void
}

export default function AiDesigner({ locationId, currentConfig, onSave }: Props) {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState<DashboardLayout | null>(currentConfig)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!prompt.trim()) return
    setGenerating(true)
    setError(null)

    const res = await fetch('/api/ai/design-dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.trim(), locationId }),
    })

    if (res.ok) {
      const { layout } = await res.json()
      setPreview(layout)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Generation failed')
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand/15 bg-brand/5 p-5">
        <h3 className="text-sm font-bold text-gray-900">AI Dashboard Designer</h3>
        <p className="mt-1 text-xs text-gray-500">Describe what you want on your dashboard and AI will build it.</p>
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate() }}
            placeholder="e.g. Show me total contacts, a trend chart, and upcoming appointments"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
        {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
      </div>

      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Preview</h3>
            <button
              type="button"
              onClick={() => onSave(preview)}
              className="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              Save Dashboard
            </button>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <WidgetGrid layout={preview} locationId={locationId} />
          </div>
        </div>
      )}
    </div>
  )
}
