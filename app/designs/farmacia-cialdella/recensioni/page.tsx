import { listReviewsCached } from '@/lib/farmacia/reviews'
import SyncReviewsButton from './_components/SyncReviewsButton'
import RecensioniView from './_components/RecensioniView'

export const dynamic = 'force-dynamic'

export default async function RecensioniPage() {
  const reviews = await listReviewsCached(500)

  const rated = reviews.filter((r) => r.rating != null)
  const avg = rated.length ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length : 0
  const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString()
  const last30 = reviews.filter((r) => r.review_date && r.review_date >= cutoff).length

  const stats = [
    { label: 'Rating medio', value: avg ? `${avg.toFixed(1)} ★` : '—' },
    { label: 'Totale recensioni', value: String(reviews.length) },
    { label: 'Nuove (30 giorni)', value: String(last30) },
  ]

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Recensioni Google</h1>
          <p style={{ color: 'var(--fc-text-muted)' }}>Recensioni dello store fisico dalla reputation di GoHighLevel.</p>
        </div>
        <SyncReviewsButton />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16, marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.label} className="fc-stat" data-tone="neutral">
            <div style={{ fontSize: 24, fontWeight: 800 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--fc-text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <RecensioniView reviews={reviews} />
    </div>
  )
}
