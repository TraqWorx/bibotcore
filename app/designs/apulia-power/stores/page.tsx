import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listStores, leadFormUrlFor, bookingUrlFor, qrImageUrl } from '@/lib/apulia/stores'
import { createAdminClient } from '@/lib/supabase-server'
import CopyButton from './_components/CopyButton'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  const stores = await listStores()

  // Lead counts per store, this month + all time
  const sb = createAdminClient()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const { data: leadCountsRaw } = await sb.rpc('apulia_lead_counts_per_store', { since_iso: startOfMonth.toISOString() })
  const counts = new Map((leadCountsRaw ?? []).map((r: { slug: string; month_count: number; total_count: number }) => [r.slug, r]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 className="ap-page-title">Store fisici</h1>
        <p className="ap-page-subtitle">
          Per ogni store: link pubblico per i QR (form di acquisizione lead), link calendario per le prenotazioni in store. Le persone che si registrano vengono taggate <code>lead</code> e <code>store-{'{slug}'}</code>.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        {stores.map((s) => {
          const leadUrl = leadFormUrlFor(s.slug)
          const bookingUrl = bookingUrlFor(s.calendar_widget_slug)
          const c = counts.get(s.slug) as { month_count?: number; total_count?: number } | undefined
          return (
            <div key={s.id} className="ap-card ap-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>{s.name}</div>
                  {s.city && <div style={{ fontSize: 12, color: 'var(--ap-text-muted)', marginTop: 2 }}>{s.city}</div>}
                </div>
                <span className={`ap-pill`} data-tone={s.active ? 'green' : 'gray'}>{s.active ? 'Attivo' : 'Disattivato'}</span>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div className="ap-stat" data-tone="accent" style={{ flex: 1 }}>
                  <div className="ap-stat-label">Lead questo mese</div>
                  <div className="ap-stat-value">{c?.month_count ?? 0}</div>
                </div>
                <div className="ap-stat" data-tone="neutral" style={{ flex: 1 }}>
                  <div className="ap-stat-label">Lead totali</div>
                  <div className="ap-stat-value">{c?.total_count ?? 0}</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>QR / Form lead</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrImageUrl(leadUrl, 140)} alt={`QR ${s.name}`} width={140} height={140} style={{ borderRadius: 12, border: '1px solid var(--ap-line)' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                    <code style={{ fontSize: 11, padding: 8, background: 'var(--ap-bg)', borderRadius: 8, wordBreak: 'break-all' }}>{leadUrl}</code>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <CopyButton text={leadUrl} label="Copia link" />
                      <a className="ap-btn ap-btn-ghost" style={{ height: 32, padding: '0 12px', fontSize: 11 }} href={leadUrl} target="_blank" rel="noreferrer">Apri</a>
                      <a className="ap-btn ap-btn-ghost" style={{ height: 32, padding: '0 12px', fontSize: 11 }} href={qrImageUrl(leadUrl, 1024)} target="_blank" rel="noreferrer">QR HD</a>
                    </div>
                  </div>
                </div>
              </div>

              {bookingUrl && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Calendario prenotazioni</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <code style={{ fontSize: 11, padding: 8, background: 'var(--ap-bg)', borderRadius: 8, flex: 1, wordBreak: 'break-all' }}>{bookingUrl}</code>
                    <CopyButton text={bookingUrl} label="Copia" />
                    <a className="ap-btn ap-btn-ghost" style={{ height: 32, padding: '0 12px', fontSize: 11 }} href={bookingUrl} target="_blank" rel="noreferrer">Apri</a>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
