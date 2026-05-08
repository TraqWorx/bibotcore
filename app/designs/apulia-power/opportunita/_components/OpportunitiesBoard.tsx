'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
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
          {pendingSync ? 'Sincronizzo…' : 'Sincronizza'}
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
    setOpps((prev) => prev.map((o) => o.id === oppId ? { ...o, pipelineStageId: toStage } : o))
    void moveOpportunity(oppId, toStage).then((r) => {
      if (r?.error) {
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
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            style={{ height: 38, fontSize: 13, padding: '0 14px', border: '1px solid var(--ap-line-strong)', borderRadius: 12, background: 'var(--ap-surface, #fff)', cursor: 'pointer', fontWeight: 600 }}
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
            style={{ height: 38, fontSize: 13, padding: '0 14px', border: '1px solid var(--ap-line-strong)', borderRadius: 12, flex: '1 1 240px', minWidth: 220, background: 'var(--ap-surface, #fff)' }}
          />
          <button
            type="button"
            onClick={triggerSync}
            disabled={pendingSync}
            className="ap-btn ap-btn-ghost"
            style={{ height: 38, borderRadius: 12 }}
            title={syncedAt ? `Ultimo sync: ${new Date(syncedAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}` : 'Mai sincronizzato'}
          >
            {pendingSync ? '↻ Sync…' : '↻ Aggiorna'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--ap-text-muted)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {filteredOpps.length} · {fmtEur(totalValue)}
          </span>
          {syncFlash && (
            <span style={{ fontSize: 12, fontWeight: 600, color: syncFlash.startsWith('Errore') ? 'var(--ap-danger)' : 'var(--ap-success)' }}>
              {syncFlash}
            </span>
          )}
        </div>

        {/* Board */}
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => scrollBy(-360)} aria-label="Scorri a sinistra" style={arrowBtn('left')}>‹</button>
          <button type="button" onClick={() => scrollBy(360)} aria-label="Scorri a destra" style={arrowBtn('right')}>›</button>
          <DragDropContext onDragEnd={onDragEnd}>
            <div
              ref={scrollRef}
              style={{
                display: 'flex',
                gap: 16,
                overflowX: 'auto',
                paddingBottom: 16,
                paddingTop: 4,
                paddingLeft: 44,
                paddingRight: 44,
                scrollBehavior: 'smooth',
                scrollbarWidth: 'none',
              }}
            >
              {pipeline?.stages.map((stage) => {
                const stageOpps = filteredOpps.filter((o) => o.pipelineStageId === stage.id)
                const stageValue = stageOpps.reduce((s, o) => s + (o.monetaryValue ?? 0), 0)
                const accent = stageOpps.length > 0
                  ? 'color-mix(in srgb, var(--ap-blue) 18%, var(--ap-line))'
                  : 'var(--ap-line)'
                return (
                  <div
                    key={stage.id}
                    style={{
                      flex: '0 0 280px',
                      display: 'flex',
                      flexDirection: 'column',
                      maxHeight: 'calc(100vh - 240px)',
                      borderRadius: 24,
                      border: `1px solid ${accent}`,
                      background: 'var(--ap-surface, #fff)',
                      boxShadow: '0 18px 38px -30px rgba(23,21,18,0.2)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Sticky stage header */}
                    <div
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                        padding: '14px 16px 12px',
                        background: 'color-mix(in srgb, var(--ap-bg-muted, #f1f5f9) 70%, white)',
                        borderBottom: '1px solid var(--ap-line)',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'color-mix(in srgb, var(--ap-blue) 70%, transparent)', boxShadow: '0 0 0 4px color-mix(in srgb, var(--ap-blue) 12%, transparent)' }} />
                        <h3 style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em', margin: 0, color: 'var(--ap-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stage.name}</h3>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <span style={pillStyle('muted')}>
                          {stageOpps.length === 1 ? '1 opp' : `${stageOpps.length} opp`}
                        </span>
                        <span style={pillStyle('accent')}>
                          {fmtEur(stageValue)}
                        </span>
                      </div>
                    </div>

                    {/* Scrollable cards */}
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: 12,
                            background: snapshot.isDraggingOver
                              ? 'color-mix(in srgb, var(--ap-blue-soft) 30%, transparent)'
                              : 'transparent',
                            transition: 'background 140ms',
                          }}
                        >
                          {stageOpps.length === 0 && !snapshot.isDraggingOver && (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 160,
                                padding: 20,
                                borderRadius: 20,
                                border: '1px dashed var(--ap-line)',
                                background: 'color-mix(in srgb, var(--ap-bg-muted, #f1f5f9) 40%, transparent)',
                                textAlign: 'center',
                              }}
                            >
                              <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--ap-bg-muted, #f1f5f9)', color: 'var(--ap-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>＋</div>
                              <p style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: 'var(--ap-text)' }}>Nessuna opportunità</p>
                              <p style={{ marginTop: 4, fontSize: 11, color: 'var(--ap-text-muted)' }}>Trascina qui una card per spostarla.</p>
                            </div>
                          )}
                          {stageOpps.map((o, idx) => (
                            <Draggable key={o.id} draggableId={o.id} index={idx}>
                              {(p, snap) => (
                                <div
                                  ref={p.innerRef}
                                  {...p.draggableProps}
                                  {...p.dragHandleProps}
                                  onClick={() => setDrawerOppId(o.id)}
                                  style={{
                                    ...p.draggableProps.style,
                                    marginBottom: 10,
                                    padding: 12,
                                    borderRadius: 18,
                                    border: snap.isDragging
                                      ? '1px solid color-mix(in srgb, var(--ap-blue) 35%, transparent)'
                                      : '1px solid var(--ap-line)',
                                    background: snap.isDragging
                                      ? 'color-mix(in srgb, var(--ap-blue-soft) 50%, white)'
                                      : 'var(--ap-surface, #fff)',
                                    boxShadow: snap.isDragging
                                      ? '0 18px 34px -18px rgba(23,21,18,0.25), 0 0 0 3px color-mix(in srgb, var(--ap-blue) 18%, transparent)'
                                      : '0 10px 24px -22px rgba(23,21,18,0.28)',
                                    cursor: 'pointer',
                                    transition: snap.isDragging ? p.draggableProps.style?.transition : 'box-shadow 120ms, transform 120ms, border 120ms',
                                    position: 'relative',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!snap.isDragging) {
                                      ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'
                                      ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 18px 34px -22px rgba(23,21,18,0.32)'
                                      ;(e.currentTarget as HTMLDivElement).style.borderColor = 'color-mix(in srgb, var(--ap-blue) 25%, var(--ap-line))'
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!snap.isDragging) {
                                      ;(e.currentTarget as HTMLDivElement).style.transform = ''
                                      ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 10px 24px -22px rgba(23,21,18,0.28)'
                                      ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--ap-line)'
                                    }
                                  }}
                                >
                                  {/* accent line on top */}
                                  <div style={{ position: 'absolute', top: 0, left: 12, right: 12, height: 1, background: 'color-mix(in srgb, var(--ap-blue) 18%, transparent)' }} />

                                  {/* Title row */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                                    <strong
                                      style={{
                                        fontSize: 13.5,
                                        lineHeight: 1.3,
                                        color: 'var(--ap-text)',
                                        overflow: 'hidden',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                      }}
                                    >
                                      {o.contactName ?? o.name ?? 'Senza nome'}
                                    </strong>
                                  </div>

                                  {/* Subtitle if name differs from contact */}
                                  {o.name && o.contactName && o.name !== o.contactName && (
                                    <div style={{ fontSize: 11, color: 'var(--ap-text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                                  )}

                                  {/* Contact info */}
                                  {(o.contactPhone || o.contactEmail) && (
                                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                      {o.contactPhone && (
                                        <div style={{ fontSize: 10.5, color: 'var(--ap-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📞 {o.contactPhone}</div>
                                      )}
                                      {o.contactEmail && (
                                        <div style={{ fontSize: 10.5, color: 'var(--ap-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.contactEmail}</div>
                                      )}
                                    </div>
                                  )}

                                  {/* Value row */}
                                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ap-blue)', fontVariantNumeric: 'tabular-nums' }}>
                                      {o.monetaryValue != null && o.monetaryValue > 0 ? fmtEur(o.monetaryValue) : '—'}
                                    </span>
                                    {o.status && (
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 999, border: '1px solid var(--ap-line)', background: 'var(--ap-bg-muted, #f1f5f9)', color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        {o.status}
                                      </span>
                                    )}
                                  </div>

                                  {/* Tags */}
                                  {o.contactTags && o.contactTags.length > 0 && (
                                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                      {o.contactTags.slice(0, 2).map((t) => (
                                        <span key={t} style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--ap-line)', background: 'var(--ap-bg-muted, #f1f5f9)', color: 'color-mix(in srgb, var(--ap-blue) 80%, var(--ap-text))' }}>{t}</span>
                                      ))}
                                      {o.contactTags.length > 2 && (
                                        <span style={{ fontSize: 9, color: 'var(--ap-text-faint)' }}>+{o.contactTags.length - 2}</span>
                                      )}
                                    </div>
                                  )}
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

function arrowBtn(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    [side]: 4,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 32,
    height: 32,
    borderRadius: 16,
    background: 'var(--ap-surface, #fff)',
    border: '1px solid var(--ap-line)',
    cursor: 'pointer',
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--ap-text-muted)',
    zIndex: 5,
    boxShadow: '0 6px 18px -8px rgba(23,21,18,0.28)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  }
}

function pillStyle(tone: 'muted' | 'accent'): React.CSSProperties {
  if (tone === 'accent') {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: 999,
      border: '1px solid var(--ap-line)',
      background: 'var(--ap-surface, #fff)',
      color: 'var(--ap-blue)',
      fontSize: 11,
      fontWeight: 700,
      fontVariantNumeric: 'tabular-nums',
    }
  }
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid var(--ap-line)',
    background: 'var(--ap-surface, #fff)',
    color: 'var(--ap-text-muted)',
    fontSize: 11,
    fontWeight: 700,
  }
}
