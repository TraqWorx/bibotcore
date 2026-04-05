'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  Search,
  SlidersHorizontal,
  Plus,
  LayoutGrid,
  List,
  GitBranch,
} from 'lucide-react'
import SimfoniaPageHeader from '../_components/SimfoniaPageHeader'
import { updateOpportunity } from './_actions'
import { sf } from '@/lib/simfonia/ui'

const PipelineBoard = dynamic(() => import('./PipelineBoard'), {
  ssr: false,
  loading: () => null,
})

const DealDrawer = dynamic(() => import('./DealDrawer'), {
  ssr: false,
  loading: () => null,
})

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

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Tutti',
  open: 'Aperte',
  won: 'Vinte',
  lost: 'Perse',
}

export default function PipelineView({
  pipelines,
  opportunities,
  locationId,
  demoMode = false,
}: {
  pipelines: Pipeline[]
  opportunities: Opportunity[]
  locationId: string
  demoMode?: boolean
}) {
  const [selectedId, setSelectedId] = useState(pipelines[0]?.id ?? '')
  const [activeDealId, setActiveDealId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [reopeningId, setReopeningId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const filterMenuRef = useRef<HTMLDivElement>(null)
  const boardScrollRef = useRef<HTMLDivElement>(null)
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    if (!filterMenuOpen) return
    function onPointerDown(e: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [filterMenuOpen])

  function scrollBoard(direction: 'left' | 'right') {
    const el = boardScrollRef.current?.querySelector('[data-pipeline-scroll]') as HTMLElement
    if (!el) return
    el.scrollBy({ left: direction === 'right' ? 300 : -300, behavior: 'smooth' })
  }

  const pipeline = useMemo(
    () => pipelines.find((item) => item.id === selectedId),
    [pipelines, selectedId]
  )
  const stages = pipeline?.stages ?? []

  const stageMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const currentPipeline of pipelines) {
      for (const stage of currentPipeline.stages) {
        map[stage.id] = stage.name
      }
    }
    return map
  }, [pipelines])

  const selectedPipelineOpps = useMemo(
    () => opportunities.filter((opportunity) => opportunity.pipelineId === selectedId),
    [opportunities, selectedId]
  )

  const normalizedSearch = deferredSearch.trim().toLowerCase()

  const pipelineOpps = useMemo(
    () =>
      selectedPipelineOpps
        .filter((opportunity) => filter === 'all' || opportunity.status?.toLowerCase() === filter)
        .filter((opportunity) => {
          if (!normalizedSearch) return true
          return (
            opportunity.name?.toLowerCase().includes(normalizedSearch) ||
            opportunity.contact?.name?.toLowerCase().includes(normalizedSearch) ||
            opportunity.contact?.firstName?.toLowerCase().includes(normalizedSearch) ||
            opportunity.contact?.lastName?.toLowerCase().includes(normalizedSearch)
          )
        }),
    [filter, normalizedSearch, selectedPipelineOpps]
  )

  const openOpps = useMemo(
    () => selectedPipelineOpps.filter((opportunity) => (opportunity.status ?? 'open').toLowerCase() === 'open'),
    [selectedPipelineOpps]
  )
  const openValue = useMemo(
    () => openOpps.reduce((sum, opportunity) => sum + (opportunity.monetaryValue ?? 0), 0),
    [openOpps]
  )
  const wonOpps = useMemo(
    () => selectedPipelineOpps.filter((opportunity) => opportunity.status?.toLowerCase() === 'won'),
    [selectedPipelineOpps]
  )
  const wonValue = useMemo(
    () => wonOpps.reduce((sum, opportunity) => sum + (opportunity.monetaryValue ?? 0), 0),
    [wonOpps]
  )

  async function handleReopen(oppId: string, stageId: string) {
    setReopeningId(oppId)
    await updateOpportunity(oppId, { status: 'open', pipelineStageId: stageId }, locationId)
    setReopeningId(null)
    setFilter('open')
  }

  const q = `?locationId=${locationId}`
  const showBoard = stages.length > 0 && filter !== 'won' && filter !== 'lost' && viewMode === 'grid'
  const showGroupedList =
    stages.length > 0 && filter !== 'won' && filter !== 'lost' && viewMode === 'list'

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-0 flex-col gap-7">
      <SimfoniaPageHeader
        eyebrow="Vendite"
        title="Pipeline"
        description={
          <>
            <span>Gestisci le opportunità, trascina le card tra gli stage e monitora i risultati.</span>
            <span className="mt-2 block text-sm leading-relaxed text-[var(--shell-muted)]">
              <span className="font-semibold text-[var(--foreground)]">{openOpps.length}</span> aperte
              <span className="text-[var(--shell-line)]"> · </span>
              <span className="font-bold tabular-nums text-brand">€{openValue.toLocaleString('it-IT')}</span>
              {wonOpps.length > 0 && (
                <>
                  <span className="text-[var(--shell-line)]"> · </span>
                  <span className="font-bold tabular-nums text-[color:var(--shell-muted)]">
                    €{wonValue.toLocaleString('it-IT')} vinte
                  </span>
                </>
              )}
            </span>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {demoMode ? (
              <span
                className={sf.primaryBtn}
                style={{ backgroundColor: 'var(--brand)', borderColor: 'var(--brand)', opacity: 0.92, cursor: 'default' }}
              >
                <Plus className="h-4 w-4" />
                Nuovo Deal
              </span>
            ) : (
              <Link
                href={`/designs/simfonia/pipeline/new${q}`}
                className={sf.primaryBtn}
                style={{ backgroundColor: 'var(--brand)', borderColor: 'var(--brand)' }}
              >
                <Plus className="h-4 w-4" />
                Nuovo Deal
              </Link>
            )}
          </div>
        }
      />

      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${sf.card}`}>
      {/* Toolbar — z-index above <main> so filter popover paints over the board columns */}
      <div className="relative z-30 shrink-0 border-b border-[var(--shell-line)] bg-[color:color-mix(in_srgb,var(--shell-surface)_88%,white_12%)] px-5 py-3 backdrop-blur-sm sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {pipelines.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedId(p.id)
                  setActiveDealId(null)
                }}
                className={`relative shrink-0 px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedId === p.id
                    ? 'text-brand'
                    : 'text-[var(--shell-muted)] hover:bg-[var(--shell-soft)] hover:text-[var(--foreground)]'
                }`}
              >
                <span className="mr-1.5 inline-flex align-middle text-[var(--shell-muted)]">
                  <GitBranch className="inline h-3.5 w-3.5" />
                </span>
                {p.name}
                {selectedId === p.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-brand" />
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--shell-muted)]" />
              <input
                type="search"
                placeholder="Cerca deal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`h-9 w-44 bg-[var(--shell-canvas)] pl-8 pr-3 text-sm text-[var(--foreground)] sm:w-48 ${sf.input}`}
              />
            </div>

            <div className="relative z-40" ref={filterMenuRef}>
              <button
                type="button"
                onClick={() => setFilterMenuOpen((o) => !o)}
                className="relative z-40 flex h-9 items-center gap-1.5 rounded-2xl border border-[var(--shell-line)] bg-[var(--shell-surface)] px-3.5 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:bg-white"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtro
                <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                  {FILTER_LABELS[filter]}
                </span>
              </button>
              {filterMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 min-w-[180px] rounded-2xl border border-[var(--shell-line)] bg-[var(--shell-surface)] py-1 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]">
                  {(['all', 'open', 'won', 'lost'] as Filter[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        setFilter(f)
                        if (f === 'won' || f === 'lost') setViewMode('list')
                        setFilterMenuOpen(false)
                      }}
                      className={`flex w-full items-center px-3 py-2 text-left text-sm ${
                        filter === f ? 'bg-brand/10 font-semibold text-brand' : 'text-[var(--foreground)] hover:bg-[var(--shell-soft)]'
                      }`}
                    >
                      {FILTER_LABELS[f]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center overflow-hidden rounded-2xl border border-[var(--shell-line)] bg-[var(--shell-surface)] shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                disabled={filter === 'won' || filter === 'lost'}
                title="Vista colonne"
                className={`flex h-9 w-9 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  viewMode === 'grid' && filter !== 'won' && filter !== 'lost'
                    ? 'bg-brand/10 text-brand'
                    : 'text-[var(--shell-muted)] hover:bg-[var(--shell-soft)]'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="Vista elenco"
                className={`flex h-9 w-9 items-center justify-center transition-colors ${
                  viewMode === 'list' || filter === 'won' || filter === 'lost'
                    ? 'bg-brand/10 text-brand'
                    : 'text-[var(--shell-muted)] hover:bg-[var(--shell-soft)]'
                }`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {stages.length > 0 && filter !== 'won' && filter !== 'lost' && viewMode === 'grid' && (
        <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-1 sm:px-6">
          <button
            type="button"
            onClick={() => scrollBoard('left')}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--shell-line)] bg-[var(--shell-surface)] text-[var(--shell-muted)] shadow-sm hover:text-[var(--foreground)] hover:shadow-md"
            aria-label="Scorri a sinistra"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollBoard('right')}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--shell-line)] bg-[var(--shell-surface)] text-[var(--shell-muted)] shadow-sm hover:text-[var(--foreground)] hover:shadow-md"
            aria-label="Scorri a destra"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}

      <main ref={boardScrollRef} className="min-h-0 flex-1 overflow-hidden p-5 sm:p-6">
        {stages.length === 0 ? (
            <p className="pt-4 text-sm text-gray-500">
              Nessuno stage trovato.
            </p>
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
          ) : showGroupedList ? (
            <div className="h-full overflow-y-auto">
              <GroupedDealList
                stages={stages}
                opportunities={pipelineOpps}
                onDealClick={setActiveDealId}
              />
            </div>
          ) : showBoard ? (
            <div className="h-full min-h-[200px]">
              <PipelineBoard
                key={selectedId}
                pipelineId={selectedId}
                stages={stages}
                opportunities={pipelineOpps}
                onDealClick={setActiveDealId}
                locationId={locationId}
                demoMode={demoMode}
              />
            </div>
          ) : null}
      </main>
      </div>

      {activeDealId && (
        <DealDrawer dealId={activeDealId} stageMap={stageMap} locationId={locationId} onClose={() => setActiveDealId(null)} />
      )}
    </div>
  )
}

function GroupedDealList({
  stages,
  opportunities,
  onDealClick,
}: {
  stages: Stage[]
  opportunities: Opportunity[]
  onDealClick: (id: string) => void
}) {
  const byStage = new Map<string, Opportunity[]>()
  for (const s of stages) byStage.set(s.id, [])
  for (const o of opportunities) {
    const sid = o.pipelineStageId
    if (sid && byStage.has(sid)) byStage.get(sid)!.push(o)
    else if (sid && !byStage.has(sid)) {
      byStage.set(sid, [o])
    }
  }

  if (opportunities.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400">Nessun deal in questa vista.</p>
  }

  return (
    <div className="space-y-6">
      {stages.map((stage) => {
        const deals = byStage.get(stage.id) ?? []
        if (deals.length === 0) return null
        return (
          <section key={stage.id}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{stage.name}</h3>
            <ul className="space-y-2">
              {deals.map((opp) => {
                const contactName =
                  opp.contact?.name ||
                  [opp.contact?.firstName, opp.contact?.lastName].filter(Boolean).join(' ') ||
                  null
                return (
                  <li key={opp.id}>
                    <button
                      type="button"
                      onClick={() => onDealClick(opp.id)}
                      className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-brand/30 hover:shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{opp.name ?? '—'}</p>
                        {contactName && <p className="mt-0.5 truncate text-xs text-gray-500">{contactName}</p>}
                      </div>
                      <p className="ml-3 shrink-0 text-xs font-bold tabular-nums text-brand">
                        €{(opp.monetaryValue ?? 0).toLocaleString('it-IT')}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
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
  const total = opportunities.reduce((sum, o) => sum + (o.monetaryValue ?? 0), 0)

  if (opportunities.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400">Nessuna opportunità {label.toLowerCase()}.</p>
  }

  return (
    <div className="space-y-3">
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
          isWon ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
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
      {opportunities.map((opp) => {
        const contactName =
          opp.contact?.name || [opp.contact?.firstName, opp.contact?.lastName].filter(Boolean).join(' ') || null
        return (
          <div
            key={opp.id}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 transition hover:shadow-sm"
          >
            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onDealClick(opp.id)} role="presentation">
              <p className="truncate text-sm font-semibold text-gray-900">{opp.name ?? '—'}</p>
              {contactName && <p className="mt-0.5 truncate text-xs text-gray-500">{contactName}</p>}
              <p className="mt-1 text-xs font-bold tabular-nums text-brand">
                €{(opp.monetaryValue ?? 0).toLocaleString('it-IT')}
              </p>
            </div>
            <select
              className="ml-3 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 outline-none"
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
        )
      })}
    </div>
  )
}
