'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { moveOpportunity, updateOpportunity, deleteOpportunity } from './_actions'

interface Stage {
  id: string
  name: string
}

interface Opportunity {
  id: string
  name?: string
  pipelineStageId?: string
  monetaryValue?: number
  status?: string
  assignedTo?: string | null
  lastUpdated?: string
  contact?: {
    name?: string | null
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    phone?: string | null
    company?: string | null
    tags?: string[]
  } | null
}

interface StageWithDeals extends Stage {
  deals: Opportunity[]
}

function contactDisplayName(contact?: Opportunity['contact']): string | null {
  if (!contact) return null
  if (contact.name) return contact.name
  const parts = [contact.firstName, contact.lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}

const STATUS_ZONES = [
  {
    id: '__won__',
    label: 'Vinta',
    color: 'border-emerald-300/80 bg-emerald-50/90 text-emerald-800',
    activeColor: 'border-emerald-400 bg-emerald-100 ring-2 ring-emerald-300/60',
    status: 'won' as const,
  },
  {
    id: '__lost__',
    label: 'Persa',
    color: 'border-red-300/80 bg-red-50/90 text-red-800',
    activeColor: 'border-red-400 bg-red-100 ring-2 ring-red-300/60',
    status: 'lost' as const,
  },
] as const

export default function PipelineBoard({
  pipelineId,
  stages,
  opportunities,
  onDealClick,
  locationId,
}: {
  pipelineId: string
  stages: Stage[]
  opportunities: Opportunity[]
  onDealClick?: (dealId: string) => void
  locationId: string
}) {
  const [columns, setColumns] = useState<StageWithDeals[]>(() =>
    stages.map((stage) => ({
      ...stage,
      deals: opportunities.filter((o) => o.pipelineStageId === stage.id),
    }))
  )
  const [isDragging, setIsDragging] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  function scrollBoard(direction: 'left' | 'right') {
    if (!scrollRef.current) return
    const amount = 320
    scrollRef.current.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' })
  }

  async function onDragEnd(result: DropResult) {
    setIsDragging(false)
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const statusZone = STATUS_ZONES.find((z) => z.id === destination.droppableId)
    if (statusZone) {
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          deals: col.deals.filter((d) => d.id !== draggableId),
        }))
      )
      await updateOpportunity(draggableId, { status: statusZone.status }, locationId)
      return
    }

    const sourceCol = columns.find((c) => c.id === source.droppableId)!
    const deal = sourceCol.deals[source.index]

    setColumns((prev) => {
      const next = prev.map((col) => ({ ...col, deals: [...col.deals] }))
      const src = next.find((c) => c.id === source.droppableId)!
      const dst = next.find((c) => c.id === destination.droppableId)!
      src.deals.splice(source.index, 1)
      dst.deals.splice(destination.index, 0, { ...deal, pipelineStageId: destination.droppableId })
      return next
    })

    try {
      await moveOpportunity(draggableId, destination.droppableId, locationId)
    } catch {
      setColumns((prev) => {
        const next = prev.map((col) => ({ ...col, deals: [...col.deals] }))
        const src = next.find((c) => c.id === destination.droppableId)!
        const dst = next.find((c) => c.id === source.droppableId)!
        const moved = src.deals.find((d) => d.id === draggableId)!
        src.deals.splice(src.deals.indexOf(moved), 1)
        dst.deals.splice(source.index, 0, deal)
        return next
      })
    }
  }

  async function handleDelete(dealId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setColumns((prev) => prev.map((col) => ({ ...col, deals: col.deals.filter((d) => d.id !== dealId) })))
    await deleteOpportunity(dealId, locationId)
  }

  return (
    <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={onDragEnd}>
      <div className="relative h-full">
        {/* Scroll arrows */}
        <button
          onClick={() => scrollBoard('left')}
          className="absolute left-0 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg border border-gray-200 text-gray-600 hover:bg-white hover:text-gray-900"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          onClick={() => scrollBoard('right')}
          className="absolute right-0 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg border border-gray-200 text-gray-600 hover:bg-white hover:text-gray-900"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        <div ref={scrollRef} className="flex h-full gap-3 overflow-x-auto px-12 pb-2 pt-1 scroll-smooth scrollbar-hide">
        {columns.map((stage) => {
          const stageTotal = stage.deals.reduce((sum, d) => sum + (d.monetaryValue ?? 0), 0)
          return (
            <Droppable key={stage.id} droppableId={stage.id}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm max-h-full"
                >
                  <div className="sticky top-0 z-10 border-b border-gray-200/60 bg-white/85 p-4 backdrop-blur-md">
                    <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold tracking-tight text-gray-900">
                          {stage.name}
                        </h3>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                          {stage.deals.length}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {stage.deals.length === 1 ? '1 opportunità' : `${stage.deals.length} opportunità`}
                        {stageTotal > 0 && (
                          <span className="ml-1.5 font-semibold tabular-nums text-gray-700">
                            · €{stageTotal.toLocaleString('it-IT')}
                          </span>
                        )}
                      </p>
                    </div>
                    <Link
                      href={`/designs/simfonia/pipeline/new?pipelineId=${pipelineId}&stageId=${stage.id}&locationId=${locationId}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-brand transition-colors hover:bg-brand/10"
                      title="Aggiungi opportunità"
                    >
                      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M7 1v12M1 7h12"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </Link>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {stage.deals.map((deal, index) => {
                      const contact = contactDisplayName(deal.contact)
                      return (
                        <Draggable key={deal.id} draggableId={deal.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => onDealClick?.(deal.id)}
                              className={`group relative mb-3 cursor-pointer rounded-2xl border p-3.5 text-sm transition-all duration-200 ease-out ${
                                snapshot.isDragging
                                  ? 'z-10 border-brand/30 bg-white shadow-xl shadow-brand/10 ring-2 ring-brand/20'
                                  : 'border-gray-200/90 bg-white shadow-sm hover:border-brand/25 hover:shadow-md'
                              }`}
                            >
                              {/* Header: name + delete */}
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold leading-snug text-gray-900">{deal.name ?? '—'}</p>
                                <button
                                  onClick={(e) => handleDelete(deal.id, e)}
                                  className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:flex"
                                  title="Elimina"
                                  type="button"
                                >
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                  </svg>
                                </button>
                              </div>

                              {/* Contact info */}
                              {contact && (
                                <div className="mt-1.5 space-y-0.5">
                                  <p className="text-xs font-medium text-gray-700">{contact}</p>
                                  {deal.contact?.company && (
                                    <p className="text-[10px] text-gray-400">{deal.contact.company}</p>
                                  )}
                                  {deal.contact?.email && (
                                    <p className="text-[10px] text-gray-400 truncate">{deal.contact.email}</p>
                                  )}
                                </div>
                              )}

                              {/* Value */}
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-xs font-bold tabular-nums text-brand">
                                  €{(deal.monetaryValue ?? 0).toLocaleString('it-IT')}
                                </span>
                                {deal.assignedTo && (
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 truncate max-w-[100px]">
                                    {deal.assignedTo}
                                  </span>
                                )}
                              </div>

                              {/* Tags */}
                              {deal.contact?.tags && deal.contact.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {deal.contact.tags.slice(0, 3).map((tag) => (
                                    <span key={tag} className="rounded-full bg-brand/8 px-1.5 py-0.5 text-[9px] font-semibold text-brand/70">
                                      {tag}
                                    </span>
                                  ))}
                                  {deal.contact.tags.length > 3 && (
                                    <span className="text-[9px] text-gray-400">+{deal.contact.tags.length - 3}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      )
                    })}

                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          )
        })}
      </div>
      </div>

      <div
        className={`grid grid-cols-2 gap-4 transition-all duration-300 ${
          isDragging
            ? 'mt-6 opacity-100'
            : 'pointer-events-none mt-0 h-0 overflow-hidden opacity-0'
        }`}
      >
        {STATUS_ZONES.map((zone) => (
          <Droppable key={zone.id} droppableId={zone.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex min-h-[4.5rem] items-center justify-center rounded-3xl border-2 border-dashed px-4 py-6 text-sm font-bold transition-colors ${
                  snapshot.isDraggingOver ? zone.activeColor : zone.color
                }`}
              >
                {zone.label}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  )
}
