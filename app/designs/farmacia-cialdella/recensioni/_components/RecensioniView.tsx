'use client'

import { useMemo, useState } from 'react'
import type { ReviewRow } from '@/lib/farmacia/reviews'

function stars(rating: number | null): string {
  if (rating == null) return '—'
  const n = Math.round(rating)
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n))
}

export default function RecensioniView({ reviews }: { reviews: ReviewRow[] }) {
  const [voto, setVoto] = useState(0) // 0 = tutte

  const filtered = useMemo(() => (voto ? reviews.filter((r) => Math.round(r.rating ?? 0) === voto) : reviews), [reviews, voto])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setVoto(0)} className="fc-pill" data-tone={voto === 0 ? 'blue' : 'gray'} style={{ cursor: 'pointer', border: 'none' }}>Tutte</button>
        {[5, 4, 3, 2, 1].map((v) => (
          <button key={v} onClick={() => setVoto(v)} className="fc-pill" data-tone={voto === v ? 'amber' : 'gray'} style={{ cursor: 'pointer', border: 'none' }}>{v}★</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="fc-card" style={{ padding: 24, color: 'var(--fc-text-muted)' }}>Nessuna recensione{voto ? ` a ${voto} stelle` : ''}.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((r) => (
            <div key={r.id} className="fc-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong>{r.reviewer_name ?? 'Anonimo'}</strong>
                <span style={{ color: 'var(--fc-warning)' }}>{stars(r.rating)}</span>
              </div>
              {r.title && <div style={{ fontWeight: 600, marginTop: 4 }}>{r.title}</div>}
              {r.body && <p style={{ marginTop: 4 }}>{r.body}</p>}
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fc-text-faint)' }}>
                {r.platform ?? 'Google'} · {r.review_date ? new Date(r.review_date).toLocaleDateString('it-IT') : '—'}{r.reply ? ' · risposta inviata' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
