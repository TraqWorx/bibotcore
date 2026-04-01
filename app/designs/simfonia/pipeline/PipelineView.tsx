'use client'

import { useState } from 'react'
import SegmentedControl from '../_components/SegmentedControl'
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
    window.location.reload()
  }

  const pipeline = pipelines.find((p) => p.id === selectedId)
  const stages = pipeline?.stages ?? []

  const stageMap: Record<string, string> = {}
  for (const p of pipelines) {
    for (const s of p.stages) {
      stageMap[s.id] = s.name
    }
  }

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

  const pipelineOpen = opportunities.filter(
    (o) => o.pipelineId === selectedId && (o.status ?? 'open').toLowerCase() === 'open'
  )
  const pipelineOpenValue = pipelineOpen.reduce((s, o) => s + (o.monetaryValue ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="rounded-3xl border border-gray-200/70 bg-white/85 p-4 shadow-sm backdrop-blur-md sm:p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center">
            {pipelines.length > 1 && (
              <SegmentedControl
                ariaLabel="Seleziona pipeline"
                items={pipelines.map((p) => ({ value: p.id, label: p.name }))}
                value={selectedId}
                onChange={(id) => {
                  setSelectedId(id)
                  setActiveDealId(null)
                }}
                scrollable
                equalWidth={false}
                size="sm"
                className="max-w-full lg:max-w-[min(100%,28rem)]"
              />
            )}

            <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="hidden text-[10px] font-bold uppercase tracking-wider text-gray-400 sm:block">
                Esito
              </span>
              <SegmentedControl
                ariaLabel="Filtro per esito"
                items={FILTERS.map((f) => ({ value: f.key, label: f.label }))}
                value={filter}
                onChange={setFilter}
                size="sm"
                className="min-w-0 flex-1 sm:max-w-xl"
              />
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center xl:w-auto xl:shrink-0">
            <div className="hidden items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50/80 px-3 py-2 text-xs text-gray-600 sm:flex">
              <span className="font-medium text-gray-400">In board</span>
              <span className="font-bold tabular-nums text-gray-900">{pipelineOpen.length}</span>
              <span className="text-gray-300">·</span>
              <span className="font-semibold tabular-nums text-brand">
                €{pipelineOpenValue.toLocaleString('it-IT')}
              </span>
            </div>
            <div className="relative w-full sm:min-w-[240px] xl:w-72">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <input
                type="search"
                placeholder="Cerca opportunità…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-2xl border border-gray-200/90 bg-white/90 pl-11 pr-4 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
              />
            </div>
          </div>
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
}) {
  const isWon = filter === 'won'
  const label = isWon ? 'Vinte' : 'Perse'

  if (opportunities.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-gray-200 bg-white/80 p-12 text-center">
        <p className="text-sm text-gray-500">Nessuna opportunità {label.toLowerCase()}.</p>
      </div>
    )
  }

  const total = opportunities.reduce((sum, o) => sum + (o.monetaryValue ?? 0), 0)

  return (
    <div className="space-y-4">
      <div
        className={`flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4 ${
          isWon ? 'border-emerald-200/80 bg-emerald-50/90' : 'border-red-200/80 bg-red-50/90'
        }`}
      >
        <span className={`text-sm font-bold ${isWon ? 'text-emerald-800' : 'text-red-800'}`}>
          {opportunities.length} {label}
        </span>
        {total > 0 && (
          <span className={`text-sm font-semibold tabular-nums ${isWon ? 'text-emerald-700' : 'text-red-700'}`}>
            €{total.toLocaleString('it-IT')}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {opportunities.map((opp) => {
          const contactName =
            opp.contact?.name ||
            [opp.contact?.firstName, opp.contact?.lastName].filter(Boolean).join(' ') ||
            null
          return (
            <div
              key={opp.id}
              className="group flex items-center justify-between rounded-2xl border border-gray-200/80 bg-white px-5 py-4 shadow-sm transition hover:border-brand/20 hover:shadow-md"
            >
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onDealClick(opp.id)}>
                <p className="truncate text-sm font-semibold text-gray-900">{opp.name ?? '—'}</p>
                {contactName && <p className="mt-0.5 truncate text-xs text-gray-500">{contactName}</p>}
                <p className="mt-1 text-xs font-bold tabular-nums text-brand">
                  €{(opp.monetaryValue ?? 0).toLocaleString('it-IT')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 pl-3">
                <select
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
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
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
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
