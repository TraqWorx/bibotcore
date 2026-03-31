'use client'

import { useState, useTransition } from 'react'
import PipelineSelector from './PipelineSelector'
import PipelineBoard from './PipelineBoard'
import DealDrawer from './DealDrawer'
import { updateOpportunity } from './_actions'

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
  const [reopeningId, setReopeningId] = useState<string | null>(null)

  async function handleReopen(oppId: string, stageId: string) {
    setReopeningId(oppId)
    await updateOpportunity(oppId, { status: 'open', pipelineStageId: stageId }, locationId)
    setReopeningId(null)
    // Force page refresh to get updated data
    window.location.reload()
  }

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
      ) : filter === 'won' || filter === 'lost' ? (
        <WonLostList
          opportunities={pipelineOpps}
          filter={filter}
          stages={stages}
          onDealClick={setActiveDealId}
          onReopen={handleReopen}
          reopeningId={reopeningId}
          locationId={locationId}
        />
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

function WonLostList({
  opportunities,
  filter,
  stages,
  onDealClick,
  onReopen,
  reopeningId,
}: {
  opportunities: Opportunity[]
  filter: 'won' | 'lost'
  stages: Stage[]
  onDealClick: (id: string) => void
  onReopen: (oppId: string, stageId: string) => void
  reopeningId: string | null
  locationId: string
}) {
  const isWon = filter === 'won'
  const color = isWon ? 'green' : 'red'
  const label = isWon ? 'Vinte' : 'Perse'

  if (opportunities.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">Nessuna opportunità {label.toLowerCase()}.</p>
      </div>
    )
  }

  const total = opportunities.reduce((sum, o) => sum + (o.monetaryValue ?? 0), 0)

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
        isWon ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
      }`}>
        <span className={`text-sm font-bold ${isWon ? 'text-green-700' : 'text-red-700'}`}>
          {opportunities.length} {label}
        </span>
        {total > 0 && (
          <span className={`text-sm font-medium ${isWon ? 'text-green-600' : 'text-red-600'}`}>
            &euro;{total.toLocaleString('it-IT')}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {opportunities.map((opp) => {
          const contactName = opp.contact?.name
            || [opp.contact?.firstName, opp.contact?.lastName].filter(Boolean).join(' ')
            || null
          return (
            <div
              key={opp.id}
              className="group flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 transition-all hover:border-[rgba(42,0,204,0.2)] hover:shadow-sm"
            >
              <div className="cursor-pointer flex-1" onClick={() => onDealClick(opp.id)}>
                <p className="text-sm font-medium text-gray-900">{opp.name ?? '—'}</p>
                {contactName && <p className="text-xs text-gray-400">{contactName}</p>}
                <p className="mt-0.5 text-xs font-medium" style={{ color: '#2A00CC' }}>
                  &euro;{(opp.monetaryValue ?? 0).toLocaleString('it-IT')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-[#2A00CC]"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) onReopen(opp.id, e.target.value)
                  }}
                  disabled={reopeningId === opp.id}
                >
                  <option value="" disabled>
                    {reopeningId === opp.id ? 'Spostando...' : 'Riapri in...'}
                  </option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
