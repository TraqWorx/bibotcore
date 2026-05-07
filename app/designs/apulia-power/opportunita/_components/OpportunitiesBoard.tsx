'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { moveOpportunity, resyncOpportunities } from '../_actions'
import OpportunityDrawer from './OpportunityDrawer'

interface Stage { id: string; name: string; position?: number }
interface Pipeline { id: string; name: string; stages: Stage[] }
interface Opportunity {
  id: string
  name?: string
  pipelineId: string
  pipelineStageId: string
  status?: string
  monetaryValue?: number
  contactId?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  contactTags?: string[]
  updatedAt?: string
}

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

export default function OpportunitiesBoard({ pipelines, opportunities, syncedAt }: { pipelines: Pipeline[]; opportunities: Opportunity[]; syncedAt: string | null }) {
  const [pipelineId, setPipelineId] = useState<string>(pipelines[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [opps, setOpps] = useState(opportunities)
  const [pendingSync, startSyncTransition] = useTransition()
  const [syncFlash, setSyncFlash] = useState<string | null>(null)
  const [drawerOppId, setDrawerOppId] = useState<string | null>(null)
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Keep local copy in sync with server-provided list when it changes.
  useEffect(() => { setOpps(opportunities) }, [opportunities])

  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? pipelines[0]
  const filteredOpps = useMemo(() => {
    if (!pipeline) return [] as Opportunity[]
    let out = opps.filter((o) => o.pipelineId === pipeline.id)
    const q = search.trim().toLowerCase()
    if (q) {
      out = out.filter((o) =>
        (o.name ?? '').toLowerCase().includes(q) ||
        (o.contactName ?? '').toLowerCase().includes(q) ||
        (o.contactEmail ?? '').toLowerCase().includes(q) ||
        (o.contactPhone ?? '').includes(q),
      )
    }
    return out
  }, [opps, pipeline, search])

  if (pipelines.length === 0) {
    return (
      <div className="ap-card ap-card-pad" style={{ textAlign: 'center', color: 'var(--ap-text-faint)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span>Nessuna pipeline in cache.</span>
        <button className="ap-btn ap-btn-primary" onClick={triggerSync} disabled={pendingSync} style={{ alignSelf: 'center' }}>
          {pendingSync ? 'Sincronizzo…' : 'Sincronizza da GHL'}
        </button>
      </div>
    )
  }

  function triggerSync() {
    setSyncFlash(null)
    startSyncTransition(async () => {
      const r = await resyncOpportunities()
      if ('error' in r && r.error) setSyncFlash(`Errore: ${r.error}`)
      else if ('pipelines' in r) setSyncFlash(`✓ ${r.pipelines} pipeline · ${r.opportunities} opportunità`)
      router.refresh()
      setTimeout(() => setSyncFlash(null), 4000)
    })
  }

  function onDragEnd(res: DropResult) {
    if (!res.destination) return
    const fromStage = res.source.droppableId
    const toStage = res.destination.droppableId
    if (fromStage === toStage) return
    const oppId = res.draggableId
    // Optimistic — flip stage locally; server action confirms.
    setOpps((prev) => prev.map((o) => o.id === oppId ? { ...o, pipelineStageId: toStage } : o))
    void moveOpportunity(oppId, toStage).then((r) => {
      if (r?.error) {
        // Revert on error.
        setOpps((prev) => prev.map((o) => o.id === oppId ? { ...o, pipelineStageId: fromStage } : o))
        setSyncFlash(`Errore: ${r.error}`)
        setTimeout(() => setSyncFlash(null), 4000)
      }
    })
  }

  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  const totalValue = filteredOpps.reduce((s, o) => s + (o.monetaryValue ?? 0), 0)
  const drawerOpp = drawerOppId ? opps.find((o) => o.id === drawerOppId) : null

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            style={{ height: 36, fontSize: 13, padding: '0 12px', border: '1px solid var(--ap-line-strong)', borderRadius: 8, background: 'var(--ap-surface, #fff)', cursor: 'pointer' }}
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({opps.filter((o) => o.pipelineId === p.id).length})</option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome, contatto, email, telefono…"
            style={{ height: 36, fontSize: 13, padding: '0 12px', border: '1px solid var(--ap-line-strong)', borderRadius: 8, flex: '1 1 240px', minWidth: 220, background: 'var(--ap-surface, #fff)' }}
          />
          <button
            type="button"
            onClick={triggerSync}
            disabled={pendingSync}
            className="ap-btn ap-btn-ghost"
            style={{ height: 36 }}
            title={syncedAt ? `Ultimo sync: ${new Date(syncedAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}` : 'Mai sincronizzato'}
          >
            {pendingSync ? '↻ Sync…' : '↻ Aggiorna da GHL'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--ap-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {filteredOpps.length} · {fmtEur(totalValue)}
          </span>
          {syncFlash && (
            <span style={{ fontSize: 12, fontWeight: 600, color: syncFlash.startsWith('Errore') ? 'var(--ap-danger)' : 'var(--ap-success)' }}>
              {syncFlash}
            </span>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => scrollBy(-360)}
            aria-label="Scorri a sinistra"
            style={arrowBtnStyle('left')}
          >‹</button>
          <button
            type="button"
            onClick={() => scrollBy(360)}
            aria-label="Scorri a destra"
            style={arrowBtnStyle('right')}
          >›</button>
          <DragDropContext onDragEnd={onDragEnd}>
            <div ref={scrollRef} style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, scrollBehavior: 'smooth', paddingLeft: 36, paddingRight: 36 }}>
              {pipeline?.stages.map((stage) => {
                const stageOpps = filteredOpps.filter((o) => o.pipelineStageId === stage.id)
                const stageValue = stageOpps.reduce((s, o) => s + (o.monetaryValue ?? 0), 0)
                return (
                  <div key={stage.id} style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 }}>
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--ap-bg-muted, #f1f5f9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stage.name}</strong>
                      <span style={{ fontSize: 11, color: 'var(--ap-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {stageOpps.length} · {fmtEur(stageValue)}
                      </span>
                    </div>
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80,
                            padding: 4, borderRadius: 8,
                            background: snapshot.isDraggingOver ? 'color-mix(in srgb, var(--ap-blue-soft) 40%, transparent)' : 'transparent',
                            transition: 'background 120ms',
                          }}
                        >
                          {stageOpps.length === 0 && !snapshot.isDraggingOver && (
                            <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: 'var(--ap-text-faint)', border: '1px dashed var(--ap-line)', borderRadius: 10 }}>
                              Nessuna opportunità.
                            </div>
                          )}
                          {stageOpps.map((o, idx) => (
                            <Draggable key={o.id} draggableId={o.id} index={idx}>
                              {(p, snap) => (
                                <div
                                  ref={p.innerRef}
                                  {...p.draggableProps}
                                  {...p.dragHandleProps}
                                  style={{
                                    ...p.draggableProps.style,
                                    transition: snap.isDragging ? p.draggableProps.style?.transition : 'box-shadow 100ms',
                                  }}
                                >
                                  <OpportunityCard
                                    opp={o}
                                    isDragging={snap.isDragging}
                                    onOpen={() => setDrawerOppId(o.id)}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}
            </div>
          </DragDropContext>
        </div>
      </div>

      {drawerOpp && <OpportunityDrawer opp={drawerOpp} pipeline={pipeline!} onClose={() => setDrawerOppId(null)} />}
    </>
  )
}

function arrowBtnStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    [side]: 0,
    top: 16,
    bottom: 16,
    width: 28,
    background: 'color-mix(in srgb, var(--ap-surface, #fff) 92%, transparent)',
    border: '1px solid var(--ap-line)',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--ap-text-muted)',
    zIndex: 5,
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  }
}

function OpportunityCard({ opp, isDragging, onOpen }: { opp: Opportunity; isDragging: boolean; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      className="ap-card"
      style={{
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        cursor: 'pointer',
        background: isDragging ? 'color-mix(in srgb, var(--ap-blue-soft) 40%, white)' : undefined,
        boxShadow: isDragging ? '0 8px 22px rgba(0,0,0,0.18)' : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
        <strong style={{ fontSize: 13 }}>{opp.contactName ?? opp.name ?? 'Senza nome'}</strong>
        {opp.monetaryValue != null && opp.monetaryValue > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-blue)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtEur(opp.monetaryValue)}
          </span>
        )}
      </div>
      {opp.name && opp.contactName && opp.name !== opp.contactName && (
        <div style={{ fontSize: 11, color: 'var(--ap-text-muted)' }}>{opp.name}</div>
      )}
      {opp.contactPhone && (
        <div style={{ fontSize: 11, color: 'var(--ap-text-muted)' }}>📞 {opp.contactPhone}</div>
      )}
      {opp.contactEmail && (
        <div style={{ fontSize: 11, color: 'var(--ap-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opp.contactEmail}</div>
      )}
      {opp.contactTags && opp.contactTags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {opp.contactTags.slice(0, 3).map((t) => (
            <span key={t} className="ap-pill" data-tone="gray" style={{ fontSize: 9 }}>{t}</span>
          ))}
          {opp.contactTags.length > 3 && (
            <span style={{ fontSize: 9, color: 'var(--ap-text-faint)' }}>+{opp.contactTags.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}
