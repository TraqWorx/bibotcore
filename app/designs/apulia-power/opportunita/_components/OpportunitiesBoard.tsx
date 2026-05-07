'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { moveOpportunity } from '../_actions'

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

export default function OpportunitiesBoard({ pipelines, opportunities }: { pipelines: Pipeline[]; opportunities: Opportunity[] }) {
  const [pipelineId, setPipelineId] = useState<string>(pipelines[0]?.id ?? '')
  const [search, setSearch] = useState('')

  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? pipelines[0]
  const filteredOpps = useMemo(() => {
    if (!pipeline) return []
    let out = opportunities.filter((o) => o.pipelineId === pipeline.id)
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
  }, [opportunities, pipeline, search])

  if (pipelines.length === 0) {
    return (
      <div className="ap-card ap-card-pad" style={{ textAlign: 'center', color: 'var(--ap-text-faint)' }}>
        Nessuna pipeline configurata in GHL.
      </div>
    )
  }

  const totalValue = filteredOpps.reduce((s, o) => s + (o.monetaryValue ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select
          value={pipelineId}
          onChange={(e) => setPipelineId(e.target.value)}
          style={{ height: 36, fontSize: 13, padding: '0 12px', border: '1px solid var(--ap-line-strong)', borderRadius: 8, background: 'var(--ap-surface, #fff)', cursor: 'pointer' }}
        >
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({opportunities.filter((o) => o.pipelineId === p.id).length})</option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome, contatto, email, telefono…"
          style={{ height: 36, fontSize: 13, padding: '0 12px', border: '1px solid var(--ap-line-strong)', borderRadius: 8, flex: '1 1 280px', minWidth: 240, background: 'var(--ap-surface, #fff)' }}
        />
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ap-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {filteredOpps.length} opportunità · totale {fmtEur(totalValue)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stageOpps.length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: 'var(--ap-text-faint)', border: '1px dashed var(--ap-line)', borderRadius: 10 }}>
                    Nessuna opportunità.
                  </div>
                )}
                {stageOpps.map((o) => (
                  <OpportunityCard key={o.id} opp={o} pipeline={pipeline!} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OpportunityCard({ opp, pipeline }: { opp: Opportunity; pipeline: Pipeline }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleMove(newStageId: string) {
    if (newStageId === opp.pipelineStageId) return
    setError(null)
    startTransition(async () => {
      const r = await moveOpportunity(opp.id, newStageId)
      if (r?.error) setError(r.error)
      else router.refresh()
    })
  }

  return (
    <div className="ap-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, opacity: pending ? 0.6 : 1, transition: 'opacity 120ms' }}>
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
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
        <select
          value={opp.pipelineStageId}
          onChange={(e) => handleMove(e.target.value)}
          disabled={pending}
          style={{ flex: 1, height: 28, fontSize: 11, padding: '0 8px', border: '1px solid var(--ap-line)', borderRadius: 6, background: 'var(--ap-surface, #fff)', cursor: pending ? 'wait' : 'pointer' }}
        >
          {pipeline.stages.map((s) => (
            <option key={s.id} value={s.id}>→ {s.name}</option>
          ))}
        </select>
        {opp.contactId && (
          <Link
            href={`/designs/apulia-power/condomini?ghl=${opp.contactId}`}
            style={{ fontSize: 11, color: 'var(--ap-blue)', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            Apri →
          </Link>
        )}
      </div>
      {error && <div style={{ fontSize: 11, color: 'var(--ap-danger)' }}>{error}</div>}
    </div>
  )
}
