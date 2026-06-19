'use client'

import { useState } from 'react'
import SegmentsEditor from './SegmentsEditor'
import CategoryMapForm from './CategoryMapForm'
import TagManager from './TagManager'
import type { SegmentConfig, TierStat } from '@/lib/farmacia/segments'

type Tab = 'cluster' | 'tag' | 'categorie' | 'sync'
function euros(c: number) { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(c / 100) }

interface CatRow { id: string; sku: string | null; ean: string | null; category: string }

export default function SettingsTabs({ config, clusters, cats, tags, pending, failed }: {
  config: SegmentConfig
  clusters: TierStat[]
  cats: CatRow[]
  tags: { tag: string; count: number }[]
  pending: number
  failed: number
}) {
  const [tab, setTab] = useState<Tab>('cluster')
  const tabs: { key: Tab; label: string }[] = [
    { key: 'cluster', label: 'Cluster' },
    { key: 'tag', label: 'Tag' },
    { key: 'categorie', label: 'Categorie' },
    { key: 'sync', label: 'Sincronizzazione' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--fc-line)', marginBottom: 20 }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t.key ? 700 : 400, borderBottom: tab === t.key ? '2px solid var(--fc-blue)' : '2px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cluster' && (
        <section>
          <p style={{ fontSize: 13, color: 'var(--fc-text-muted)', marginBottom: 8 }}>
            Soglie per livello (ordini e/o spesa). Il livello è calcolato in tempo reale; l&apos;anteprima qui sotto riflette le soglie salvate.
          </p>
          <SegmentsEditor initial={config.segments} initialMode={config.matchMode} />
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '20px 0 8px' }}>Anteprima distribuzione</h3>
          <div className="fc-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="fc-table" style={{ width: '100%' }}>
              <thead><tr><th>Fascia</th><th>Clienti</th><th>Fatturato</th><th>Scontrino medio</th></tr></thead>
              <tbody>
                {clusters.map((c) => (
                  <tr key={c.name}><td><span className="fc-pill" data-tone={c.color ?? 'gray'}>{c.name}</span></td><td>{c.count}</td><td>{euros(c.revenueCents)}</td><td>{euros(c.aovCents)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'tag' && <TagManager tags={tags} />}

      {tab === 'categorie' && (
        <section>
          <p style={{ fontSize: 13, color: 'var(--fc-text-muted)' }}>Categoria usata quando il file non la porta già (mappa SKU/EAN → categoria).</p>
          <CategoryMapForm />
          <div className="fc-card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
            <table className="fc-table" style={{ width: '100%' }}>
              <thead><tr><th>SKU</th><th>EAN</th><th>Categoria</th></tr></thead>
              <tbody>
                {cats.length === 0 && <tr><td colSpan={3} style={{ padding: 16, color: 'var(--fc-text-muted)' }}>Nessuna mappatura.</td></tr>}
                {cats.map((r) => <tr key={r.id}><td>{r.sku ?? '—'}</td><td>{r.ean ?? '—'}</td><td>{r.category}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'sync' && (
        <section>
          <div className="fc-card" style={{ padding: 16, display: 'flex', gap: 24 }}>
            <div><div style={{ fontSize: 22, fontWeight: 800 }}>{pending}</div><div style={{ fontSize: 12, color: 'var(--fc-text-muted)' }}>In coda</div></div>
            <div><div style={{ fontSize: 22, fontWeight: 800, color: failed > 0 ? 'var(--fc-danger)' : undefined }}>{failed}</div><div style={{ fontSize: 12, color: 'var(--fc-text-muted)' }}>Falliti</div></div>
            <div style={{ alignSelf: 'center', fontSize: 13, color: 'var(--fc-text-faint)' }}>La coda viene svuotata verso GHL ogni minuto.</div>
          </div>
        </section>
      )}
    </div>
  )
}
