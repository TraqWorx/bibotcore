'use client'

import { useState } from 'react'
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
  contact?: { name?: string; firstName?: string; lastName?: string }
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
  { id: '__won__', label: 'Vinta', color: 'border-green-300 bg-green-50 text-green-700', activeColor: 'border-green-400 bg-green-100 ring-2 ring-green-300', status: 'won' },
  { id: '__lost__', label: 'Persa', color: 'border-red-300 bg-red-50 text-red-700', activeColor: 'border-red-400 bg-red-100 ring-2 ring-red-300', status: 'lost' },
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

  async function onDragEnd(result: DropResult) {
    setIsDragging(false)
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    // Check if dropped on a status zone
    const statusZone = STATUS_ZONES.find((z) => z.id === destination.droppableId)
    if (statusZone) {
      // Remove deal from board and update status
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          deals: col.deals.filter((d) => d.id !== draggableId),
        }))
      )
      await updateOpportunity(draggableId, { status: statusZone.status }, locationId)
      return
    }

    // Normal stage-to-stage move
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
    setColumns((prev) =>
      prev.map((col) => ({ ...col, deals: col.deals.filter((d) => d.id !== dealId) }))
    )
    await deleteOpportunity(dealId, locationId)
  }

  return (
    <DragDropContext
      onDragStart={() => setIsDragging(true)}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((stage) => {
          const stageTotal = stage.deals.reduce((sum, d) => sum + (d.monetaryValue ?? 0), 0)
          return (
            <Droppable key={stage.id} droppableId={stage.id}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="w-[280px] shrink-0 rounded-2xl border border-[rgba(42,0,204,0.12)] bg-[#FAFAFF] p-3"
                >
                  {/* Stage header */}
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">{stage.name}</h3>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {stage.deals.length} opportunità
                        {stageTotal > 0 && (
                          <span className="ml-1.5 font-medium text-gray-500">
                            · €{stageTotal.toLocaleString()}
                          </span>
                        )}
                      </p>
                    </div>
                    <Link
                      href={`/designs/simfonia/pipeline/new?pipelineId=${pipelineId}&stageId=${stage.id}&locationId=${locationId}`}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-[#2A00CC] transition-colors duration-150 hover:bg-[rgba(42,0,204,0.08)]"
                      title="Aggiungi opportunità"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </Link>
                  </div>

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
                            className={`group relative mb-2 cursor-pointer rounded-xl border p-3 text-sm transition-colors duration-150 ease-out ${
                              snapshot.isDragging ? 'shadow-lg border-[rgba(42,0,204,0.2)] bg-white' : 'border-gray-200 bg-white hover:border-[rgba(42,0,204,0.2)] hover:shadow-sm'
                            }`}
                          >
                            <p className="pr-6 font-medium leading-snug text-gray-900">{deal.name ?? '—'}</p>
                            {contact && (
                              <p className="mt-0.5 text-xs text-gray-400">{contact}</p>
                            )}
                            <p className="mt-1 text-xs font-medium" style={{ color: '#2A00CC' }}>
                              €{(deal.monetaryValue ?? 0).toLocaleString()}
                            </p>
                            {/* Delete button on hover */}
                            <button
                              onClick={(e) => handleDelete(deal.id, e)}
                              className="absolute right-2 top-2 hidden h-5 w-5 items-center justify-center rounded text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:flex"
                              title="Delete"
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </Draggable>
                    )
                  })}

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          )
        })}
      </div>

      {/* Won / Lost drop zones — visible while dragging */}
      <div
        className={`mt-4 grid grid-cols-2 gap-4 transition-colors duration-200 ${
          isDragging ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none h-0 mt-0 overflow-hidden'
        }`}
      >
        {STATUS_ZONES.map((zone) => (
          <Droppable key={zone.id} droppableId={zone.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex items-center justify-center rounded-2xl border-2 border-dashed py-6 text-sm font-bold transition-colors ${
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
