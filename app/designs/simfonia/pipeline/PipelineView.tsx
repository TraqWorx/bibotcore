'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import SimfoniaPageHeader from '../_components/SimfoniaPageHeader'
import PipelineBoard from './PipelineBoard'
import DealDrawer from './DealDrawer'
import { updateOpportunity } from './_actions'

interface Stage { id: string; name: string }
interface Pipeline { id: string; name: string; stages: Stage[] }
interface Opportunity {
  id: string
  name?: string
  pipelineId?: string
  pipelineStageId?: string
  monetaryValue?: number
  status?: string
  contactId?: string
  contact?: { name?: string; firstName?: string; lastName?: string }
}

type Filter = 'all' | 'open' | 'won' | 'lost'

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
  const boardScrollRef = useRef<HTMLDivElement>(null)

  function scrollBoard(direction: 'left' | 'right') {
    const el = boardScrollRef.current?.querySelector('[data-pipeline-scroll]') as HTMLElement
    if (!el) return
    el.scrollBy({ left: direction === 'right' ? 300 : -300, behavior: 'smooth' })
  }

  const pipeline = pipelines.find((p) => p.id === selectedId)
  const stages = pipeline?.stages ?? []

  const stageMap: Record<string, string> = {}
  for (const p of pipelines) for (const s of p.stages) stageMap[s.id] = s.name

  const pipelineOpps = opportunities
    .filter((o) => o.pipelineId === selectedId)
    .filter((o) => filter === 'all' || o.status?.toLowerCase() === filter)
    .filter((o) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return o.name?.toLowerCase().includes(q) || o.contact?.name?.toLowerCase().includes(q) ||
        o.contact?.firstName?.toLowerCase().includes(q) || o.contact?.lastName?.toLowerCase().includes(q)
    })

  const openOpps = opportunities.filter((o) => o.pipelineId === selectedId && (o.status ?? 'open').toLowerCase() === 'open')
  const openValue = openOpps.reduce((s, o) => s + (o.monetaryValue ?? 0), 0)
  const wonOpps = opportunities.filter((o) => o.pipelineId === selectedId && o.status?.toLowerCase() === 'won')
  const wonValue = wonOpps.reduce((s, o) => s + (o.monetaryValue ?? 0), 0)

  async function handleReopen(oppId: string, stageId: string) {
    setReopeningId(oppId)
    await updateOpportunity(oppId, { status: 'open', pipelineStageId: stageId }, locationId)
    setReopeningId(null)
    window.location.reload()
  }

  const q = `?locationId=${locationId}`

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden">
      {/* Page header */}
      <div className="shrink-0 px-5 pt-5 pb-3">
        <SimfoniaPageHeader
          eyebrow="Vendite"
          title="Pipeline"
          description="Gestisci le opportunità, trascina le card tra gli stage e monitora i risultati."
        />
      </div>

      {/* Toolbar */}
      <div className="shrink-0 mx-5 mb-3 rounded-2xl border border-gray-200/80 bg-white/90 px-5 py-2.5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Pipeline tabs */}
          <div className="flex items-center gap-1">
            {pipelines.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedId(p.id); setActiveDealId(null) }}
                className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                  selectedId === p.id ? 'text-brand' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {p.name}
                {selectedId === p.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-brand" />
                )}
              </button>
            ))}
          </div>

          {/* Right: Search + Filters + New */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="search"
                placeholder="Cerca deal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-48 rounded-xl border border-gray-200 bg-white pl-8 pr-3 text-sm outline-none placeholder:text-gray-400 focus:border-brand/40 focus:ring-1 focus:ring-brand/15"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center rounded-xl border border-gray-200 bg-white overflow-hidden">
              {(['all', 'open', 'won', 'lost'] as Filter[]).map((f) => {
                const labels: Record<Filter, string> = { all: 'Tutti', open: 'Aperte', won: 'Vinte', lost: 'Perse' }
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`h-8 px-3 text-xs font-medium transition-colors ${
                      filter === f ? 'bg-brand/10 text-brand' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {labels[f]}
                  </button>
                )
              })}
            </div>

            {/* Stats */}
            <div className="hidden items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs lg:flex">
              <span className="font-medium text-gray-400">{openOpps.length} aperte</span>
              <span className="text-gray-300">·</span>
              <span className="font-bold tabular-nums text-brand">€{openValue.toLocaleString('it-IT')}</span>
              {wonOpps.length > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="font-bold tabular-nums text-emerald-600">€{wonValue.toLocaleString('it-IT')} vinte</span>
                </>
              )}
            </div>

            {/* New deal */}
            <Link
              href={`/designs/simfonia/pipeline/new${q}`}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nuovo Deal
            </Link>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex flex-1 min-h-0 items-stretch gap-2 px-2 pb-3">
        {/* Left arrow */}
        {stages.length > 0 && filter !== 'won' && filter !== 'lost' && (
          <button
            onClick={() => scrollBoard('left')}
            className="flex shrink-0 w-8 items-center justify-center rounded-xl border border-gray-200/80 bg-white text-gray-400 shadow-sm hover:text-gray-900 hover:shadow-md"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}

        {/* Board area */}
        <div ref={boardScrollRef} className="flex-1 min-w-0 overflow-hidden">
          {stages.length === 0 ? (
            <p className="text-sm text-gray-500 pt-4">Nessuno stage trovato.</p>
          ) : filter === 'won' || filter === 'lost' ? (
            <div className="h-full overflow-y-auto">
              <WonLostList
                opportunities={pipelineOpps}
                filter={filter}
                stages={stages}
                onDealClick={setActiveDealId}
                onReopen={handleReopen}
                reopeningId={reopeningId}
              />
            </div>
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
        </div>

        {/* Right arrow */}
        {stages.length > 0 && filter !== 'won' && filter !== 'lost' && (
          <button
            onClick={() => scrollBoard('right')}
            className="flex shrink-0 w-8 items-center justify-center rounded-xl border border-gray-200/80 bg-white text-gray-400 shadow-sm hover:text-gray-900 hover:shadow-md"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}
      </div>

      {activeDealId && (
        <DealDrawer dealId={activeDealId} stageMap={stageMap} locationId={locationId} onClose={() => setActiveDealId(null)} />
      )}
    </div>
  )
}

function WonLostList({
  opportunities, filter, stages, onDealClick, onReopen, reopeningId,
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
  const total = opportunities.reduce((sum, o) => sum + (o.monetaryValue ?? 0), 0)

  if (opportunities.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400">Nessuna opportunità {label.toLowerCase()}.</p>
  }

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
        isWon ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
      }`}>
        <span className={`text-sm font-bold ${isWon ? 'text-emerald-800' : 'text-red-800'}`}>
          {opportunities.length} {label}
        </span>
        {total > 0 && (
          <span className={`text-sm font-semibold tabular-nums ${isWon ? 'text-emerald-700' : 'text-red-700'}`}>
            €{total.toLocaleString('it-IT')}
          </span>
        )}
      </div>
      {opportunities.map((opp) => {
        const contactName = opp.contact?.name || [opp.contact?.firstName, opp.contact?.lastName].filter(Boolean).join(' ') || null
        return (
          <div key={opp.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 transition hover:shadow-sm">
            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onDealClick(opp.id)}>
              <p className="truncate text-sm font-semibold text-gray-900">{opp.name ?? '—'}</p>
              {contactName && <p className="mt-0.5 truncate text-xs text-gray-500">{contactName}</p>}
              <p className="mt-1 text-xs font-bold tabular-nums text-brand">€{(opp.monetaryValue ?? 0).toLocaleString('it-IT')}</p>
            </div>
            <select
              className="ml-3 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 outline-none"
              defaultValue=""
              onChange={(e) => { if (e.target.value) onReopen(opp.id, e.target.value) }}
              disabled={reopeningId === opp.id}
            >
              <option value="" disabled>{reopeningId === opp.id ? 'Spostando...' : 'Riapri in...'}</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )
      })}
    </div>
  )
}
