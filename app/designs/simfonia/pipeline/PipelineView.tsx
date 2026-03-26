'use client'

import { useState } from 'react'
import PipelineSelector from './PipelineSelector'
import PipelineBoard from './PipelineBoard'
import DealDrawer from './DealDrawer'

interface Stage {
  id: string
  name: string
}

interface Pipeline {
  id: string
  name: string
  stages: Stage[]
}

interface Opportunity {
  id: string
  name?: string
  pipelineId?: string
  pipelineStageId?: string
  monetaryValue?: number
  status?: string
  contact?: { name?: string; firstName?: string; lastName?: string }
}

type Filter = 'all' | 'open' | 'won' | 'lost'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tutti' },
  { key: 'open', label: 'Aperte' },
  { key: 'won', label: 'Vinte' },
  { key: 'lost', label: 'Perse' },
]

export default function PipelineView({
  pipelines,
  opportunities,
  locationId,
}: {
  pipelines: Pipeline[]
  opportunities: Opportunity[]
  locationId: string
}) {
  const [selectedId, setSelectedId] = useState(pipelines[0]?.id ?? '')
  const [activeDealId, setActiveDealId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const pipeline = pipelines.find((p) => p.id === selectedId)
  const stages = pipeline?.stages ?? []

  // Build a stageMap across all pipelines for the drawer
  const stageMap: Record<string, string> = {}
  for (const p of pipelines) {
    for (const s of p.stages) {
      stageMap[s.id] = s.name
    }
  }

  // Filter + search
  const pipelineOpps = opportunities
    .filter((o) => o.pipelineId === selectedId)
    .filter((o) => filter === 'all' || o.status?.toLowerCase() === filter)
    .filter((o) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        o.name?.toLowerCase().includes(q) ||
        o.contact?.name?.toLowerCase().includes(q) ||
        o.contact?.firstName?.toLowerCase().includes(q) ||
        o.contact?.lastName?.toLowerCase().includes(q)
      )
    })

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {pipelines.length > 1 && (
          <PipelineSelector
            pipelines={pipelines}
            selected={selectedId}
            onChange={(id) => {
              setSelectedId(id)
              setActiveDealId(null)
            }}
          />
        )}

        {/* Filter tabs */}
        <div className="flex items-center rounded-xl border border-gray-200 bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-150 ease-out ${
                filter === f.key
                  ? 'text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              style={filter === f.key ? { background: '#2A00CC' } : undefined}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
          >
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Cerca opportunità…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-xl border border-gray-200 bg-white pl-9 pr-4 text-sm text-gray-900 outline-none transition-all duration-150 focus:border-[#2A00CC] focus:ring-2 focus:ring-[rgba(42,0,204,0.15)]"
          />
        </div>
      </div>

      {stages.length === 0 ? (
        <p className="text-sm text-gray-500">Nessuno stage trovato per questa pipeline.</p>
      ) : (
        <PipelineBoard
          key={selectedId}
          pipelineId={selectedId}
          stages={stages}
          opportunities={pipelineOpps}
          onDealClick={setActiveDealId}
          locationId={locationId}
        />
      )}

      {activeDealId && (
        <DealDrawer
          dealId={activeDealId}
          stageMap={stageMap}
          locationId={locationId}
          onClose={() => setActiveDealId(null)}
        />
      )}
    </div>
  )
}
