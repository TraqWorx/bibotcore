import { listReviewsCached } from '@/lib/farmacia/reviews'
import SyncReviewsButton from './_components/SyncReviewsButton'

export const dynamic = 'force-dynamic'

function stars(rating: number | null): string {
  if (rating == null) return '—'
  const n = Math.round(rating)
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n))
}

export default async function RecensioniPage() {
  const reviews = await listReviewsCached()

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Recensioni</h1>
          <p style={{ color: 'var(--fc-text-muted)' }}>Recensioni dalla reputation di GoHighLevel.</p>
        </div>
        <SyncReviewsButton />
      </div>

      {reviews.length === 0 ? (
        <div className="fc-card" style={{ padding: 24, color: 'var(--fc-text-muted)' }}>
          Nessuna recensione in cache. Premi “Sincronizza recensioni”.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {reviews.map((r) => (
            <div key={r.id} className="fc-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong>{r.reviewer_name ?? 'Anonimo'}</strong>
                <span style={{ color: 'var(--fc-warning)' }}>{stars(r.rating)}</span>
              </div>
              {r.title && <div style={{ fontWeight: 600, marginTop: 4 }}>{r.title}</div>}
              {r.body && <p style={{ marginTop: 4, color: 'var(--fc-text)' }}>{r.body}</p>}
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fc-text-faint)' }}>
                {r.platform ?? '—'} · {r.review_date ? new Date(r.review_date).toLocaleDateString('it-IT') : '—'}
                {r.reply ? ' · risposta inviata' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
