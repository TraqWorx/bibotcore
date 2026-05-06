'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getSyncOpsForImport, type SyncImportSummary, type SyncOpDetail } from '../_actions'

interface Props {
  imports: SyncImportSummary[]
}

export default function SyncImportHistory({ imports }: Props) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [opsCache, setOpsCache] = useState<Record<string, SyncOpDetail[]>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'failed'>('failed')
  const [, startTransition] = useTransition()

  if (imports.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--ap-text-faint)', margin: 0 }}>Nessuna sincronizzazione recente.</p>
  }

  function toggle(key: string) {
    if (openId === key) { setOpenId(null); return }
    setOpenId(key)
    if (!opsCache[key]) {
      setLoading(key)
      startTransition(async () => {
        const importId = key === '__manual__' ? null : key
        const r = await getSyncOpsForImport(importId)
        if ('error' in r) {
          setLoading(null)
          return
        }
        setOpsCache((prev) => ({ ...prev, [key]: r }))
        setLoading(null)
      })
    }
  }

  function refresh() { router.refresh() }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--ap-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Storia sincronizzazione</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'failed')} className="ap-input" style={{ height: 30, fontSize: 12 }}>
            <option value="failed">Solo falliti</option>
            <option value="all">Tutti</option>
          </select>
          <button className="ap-btn" onClick={refresh} style={{ height: 30, fontSize: 12 }}>↻</button>
        </div>
      </div>

      {imports.map((imp) => {
        const key = imp.importId ?? '__manual__'
        const isOpen = openId === key
        const ops = opsCache[key]
        const visibleOps = (ops ?? []).filter((o) => filter === 'all' || o.status === 'failed')

        return (
          <div key={key} className="ap-card" style={{ overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => toggle(key)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                fontSize: 13,
                textAlign: 'left',
                color: 'var(--ap-text)',
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700 }}>
                  {imp.importId == null ? 'Modifiche manuali' : labelForKind(imp.kind)}
                  {imp.filename && <span style={{ fontWeight: 400, color: 'var(--ap-text-muted)' }}> · {imp.filename}</span>}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ap-text-faint)' }}>
                  {imp.startedAt ? new Date(imp.startedAt).toLocaleString('it-IT') : '—'}
                </span>
              </span>
              <span style={{ display: 'flex', gap: 6, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                <Pill tone="green">✓ {imp.completed}</Pill>
                {imp.failed > 0 && <Pill tone="red">✗ {imp.failed}</Pill>}
                {imp.pending > 0 && <Pill tone="amber">⏳ {imp.pending}</Pill>}
                {imp.inProgress > 0 && <Pill tone="blue">⟳ {imp.inProgress}</Pill>}
                <span style={{ fontSize: 14, color: 'var(--ap-text-muted)', minWidth: 14, textAlign: 'center' }}>
                  {isOpen ? '▾' : '▸'}
                </span>
              </span>
            </button>
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--ap-line)', padding: '8px 0' }}>
                {loading === key && <p style={{ padding: '8px 14px', fontSize: 12, color: 'var(--ap-text-muted)', margin: 0 }}>Carico operazioni…</p>}
                {!loading && (!ops || ops.length === 0) && <p style={{ padding: '8px 14px', fontSize: 12, color: 'var(--ap-text-faint)', margin: 0 }}>Nessuna operazione.</p>}
                {!loading && ops && ops.length > 0 && (
                  <>
                    {visibleOps.length === 0 && filter === 'failed' && (
                      <p style={{ padding: '8px 14px', fontSize: 12, color: 'var(--ap-text-faint)', margin: 0 }}>
                        Nessun errore in questa coda. (Mostra <em>tutti</em> per vedere le {ops.length} operazioni.)
                      </p>
                    )}
                    {visibleOps.length > 0 && (
                      <table className="ap-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Stato</th>
                            <th>Contatto</th>
                            <th>Azione</th>
                            <th>Tentativi</th>
                            <th>Errore / GHL id</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleOps.slice(0, 200).map((o) => (
                            <OpRow key={o.id} op={o} />
                          ))}
                          {visibleOps.length > 200 && (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ap-text-faint)', padding: '8px 14px' }}>
                                +{visibleOps.length - 200} altre… (limita per import troppo grandi)
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function OpRow({ op }: { op: SyncOpDetail }) {
  const tone = op.status === 'completed' ? 'green' : op.status === 'failed' ? 'red' : op.status === 'in_progress' ? 'blue' : 'amber'
  const contactLabel = op.contactName ?? '—'
  const sub = op.contactCode ? `code ${op.contactCode}` : op.contactPod ? `POD ${op.contactPod}` : null
  return (
    <tr>
      <td><Pill tone={tone}>{statoLabel(op.status)}</Pill></td>
      <td>
        {op.contactId ? (
          <span>{contactLabel}{sub && <span style={{ color: 'var(--ap-text-faint)', fontSize: 11 }}> · {sub}</span>}</span>
        ) : '—'}
      </td>
      <td>{op.action}</td>
      <td style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>{op.attempts}</td>
      <td style={{ maxWidth: 360, fontSize: 11, color: 'var(--ap-text-muted)' }}>
        {op.lastError ?? (op.ghlId ? <span style={{ fontFamily: 'monospace' }}>{op.ghlId}</span> : '—')}
      </td>
    </tr>
  )
}

function Pill({ tone, children }: { tone: 'green' | 'red' | 'amber' | 'blue'; children: React.ReactNode }) {
  return <span className="ap-pill" data-tone={tone} style={{ fontSize: 11 }}>{children}</span>
}

function statoLabel(s: string): string {
  switch (s) {
    case 'pending': return 'in attesa'
    case 'in_progress': return 'in corso'
    case 'completed': return 'OK'
    case 'failed': return 'fallito'
    default: return s
  }
}

function labelForKind(k: string | null): string {
  if (k === 'pdp') return 'Import PDP'
  if (k === 'admins') return 'Import Amministratori'
  if (k === 'switch_out') return 'Import Switch-out'
  return 'Sync'
}
