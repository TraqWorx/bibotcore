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
    color: 'border-[#d7e8de] bg-[#edf7f1] text-[#5f8f76]',
    activeColor: 'border-[#bfd8c8] bg-[#dff3ea] ring-2 ring-[#d7e8de]',
    status: 'won' as const,
  },
  {
    id: '__lost__',
    label: 'Persa',
    color: 'border-[#edd9d4] bg-[#f7e7e3] text-[#9e6e63]',
    activeColor: 'border-[#e4c8c1] bg-[#f3dfd9] ring-2 ring-[#edd9d4]',
    status: 'lost' as const,
  },
] as const

export default function PipelineBoard({
  pipelineId,
  stages,
  opportunities,
  onDealClick,
  locationId,
  demoMode = false,
}: {
  pipelineId: string
  stages: Stage[]
  opportunities: Opportunity[]
  onDealClick?: (dealId: string) => void
  locationId: string
  demoMode?: boolean
}) {
  const [columns, setColumns] = useState<StageWithDeals[]>(() =>
    stages.map((stage) => ({
      ...stage,
      deals: opportunities.filter((o) => o.pipelineStageId === stage.id),
    }))
  )
  const [isDragging, setIsDragging] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

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
      if (demoMode) return
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

    if (demoMode) return

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
    if (demoMode) return
    await deleteOpportunity(dealId, locationId)
  }

  return (
    <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={onDragEnd}>
      <div ref={scrollRef} data-pipeline-scroll className="flex h-full gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth" style={{ scrollbarWidth: 'none' }}>
        {columns.map((stage) => {
          const stageTotal = stage.deals.reduce((sum, d) => sum + (d.monetaryValue ?? 0), 0)
          const stageAccent =
            stage.deals.length > 0
              ? 'border-[color:color-mix(in_srgb,var(--brand)_18%,var(--shell-line))]'
              : 'border-[var(--shell-line)]'
          return (
            <Droppable key={stage.id} droppableId={stage.id}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`relative isolate flex max-h-full w-[264px] shrink-0 flex-col overflow-hidden rounded-[28px] border bg-[var(--shell-surface)] shadow-[0_18px_38px_-30px_rgba(23,21,18,0.2)] ${stageAccent}`}
                >
                  <div className="sticky top-0 z-10 rounded-t-[28px] border-b border-[var(--shell-line)] bg-[color:color-mix(in_srgb,var(--shell-soft)_56%,white_44%)] px-4 pb-4 pt-4 backdrop-blur-md">
                    <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-brand/70 ring-4 ring-brand/10" />
                        <h3 className="truncate text-[15px] font-bold tracking-tight text-[var(--foreground)]">
                          {stage.name}
                        </h3>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--shell-line)] bg-[var(--shell-surface)]/90 px-2.5 py-1 font-semibold text-[var(--shell-muted)]">
                          {stage.deals.length === 1 ? '1 deal' : `${stage.deals.length} deal`}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--shell-line)] bg-[var(--shell-surface)]/90 px-2.5 py-1 font-semibold tabular-nums text-brand">
                          €{stageTotal.toLocaleString('it-IT')}
                        </span>
                      </div>
                    </div>
                    {demoMode ? (
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-[var(--shell-line)] bg-[var(--shell-surface)] text-brand"
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
                      </span>
                    ) : (
                      <Link
                        href={`/designs/simfonia/pipeline/new?pipelineId=${pipelineId}&stageId=${stage.id}&locationId=${locationId}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-[var(--shell-line)] bg-[var(--shell-surface)] text-brand transition-colors hover:bg-brand/10"
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
                    )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3">
                    {stage.deals.length === 0 && (
                      <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--shell-line)] bg-[var(--shell-surface)] px-5 text-center">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--shell-soft)] text-brand">
                          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3v18" />
                          </svg>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">Nessun deal in questo stage</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--shell-muted)]">
                          Trascina un deal qui oppure crea una nuova opportunita direttamente in questa colonna.
                        </p>
                      </div>
                    )}
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
                              className={`group relative mb-2.5 cursor-pointer rounded-[22px] border p-3 text-sm transition-all duration-200 ease-out ${
                                snapshot.isDragging
                                  ? 'z-10 border-brand/30 bg-white shadow-xl shadow-brand/10 ring-2 ring-brand/20'
                                  : 'border-[var(--shell-line)] bg-[var(--shell-surface)] shadow-[0_10px_24px_-20px_rgba(23,21,18,0.28)] hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-[0_18px_34px_-24px_rgba(23,21,18,0.28)]'
                              }`}
                            >
                              <div className="absolute inset-x-3 top-0 h-px bg-[color:color-mix(in_srgb,var(--brand)_18%,transparent)]" />
                              {/* Header: name + delete */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--foreground)]">{deal.name ?? '—'}</p>
                                  {contact && (
                                    <p className="mt-1 truncate text-[11px] text-[var(--shell-muted)]">{contact}</p>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => handleDelete(deal.id, e)}
                                  className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[var(--shell-muted)] transition-colors hover:bg-[#f7e7e3] hover:text-[#9e6e63] group-hover:flex"
                                  title="Elimina"
                                  type="button"
                                >
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                  </svg>
                                </button>
                              </div>

                              {/* Contact info */}
                              {(deal.contact?.company || deal.contact?.email) && (
                                <div className="mt-2 space-y-0.5 text-[10px] text-[var(--shell-muted)]">
                                  {deal.contact?.company ? <p className="truncate">{deal.contact.company}</p> : null}
                                  {deal.contact?.email ? <p className="truncate">{deal.contact.email}</p> : null}
                                </div>
                              )}

                              {/* Value */}
                              <div className="mt-2.5 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="inline-block text-sm font-bold tabular-nums text-brand">
                                    €{(deal.monetaryValue ?? 0).toLocaleString('it-IT')}
                                  </span>
                                </div>
                                {deal.assignedTo && (
                                  <span className="max-w-[90px] truncate rounded-full border border-[var(--shell-line)] bg-[var(--shell-soft)] px-2 py-0.5 text-[9px] font-medium text-[var(--shell-muted)]">
                                    {deal.assignedTo}
                                  </span>
                                )}
                              </div>

                              {/* Tags */}
                              {deal.contact?.tags && deal.contact.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {deal.contact.tags.slice(0, 2).map((tag) => (
                                    <span key={tag} className="rounded-full border border-[var(--shell-line)] bg-[var(--shell-soft)] px-2 py-0.5 text-[9px] font-semibold text-brand/80">
                                      {tag}
                                    </span>
                                  ))}
                                  {deal.contact.tags.length > 2 && (
                                    <span className="text-[9px] text-[var(--shell-muted)]">+{deal.contact.tags.length - 2}</span>
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
