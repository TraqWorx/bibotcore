import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listStores, leadFormUrlFor, bookingUrlFor, qrImageUrl } from '@/lib/apulia/stores'
import { listGhlForms, listGhlCalendars } from '@/lib/apulia/ghl-resources'
import { createAdminClient } from '@/lib/supabase-server'
import CopyButton from './_components/CopyButton'
import StoreResourcePicker from './_components/StoreResourcePicker'
import DateRangeForm from './_components/DateRangeForm'

export const dynamic = 'force-dynamic'

interface SearchParams { from?: string; to?: string }

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')
  const sp = await searchParams

  const sb = createAdminClient()
  // Default range: current month-to-date.
  const today = new Date()
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1)
  const fromStr = sp.from || defaultFrom.toISOString().slice(0, 10)
  const toStr = sp.to || today.toISOString().slice(0, 10)
  const fromIso = new Date(`${fromStr}T00:00:00`).toISOString()
  // To is exclusive end; add a day to include the entire 'to' day.
  const toEnd = new Date(`${toStr}T00:00:00`)
  toEnd.setDate(toEnd.getDate() + 1)
  const toIso = toEnd.toISOString()

  const [stores, ghlForms, ghlCalendars, { data: leadCountsRaw }] = await Promise.all([
    listStores(),
    listGhlForms(),
    listGhlCalendars(),
    sb.rpc('apulia_lead_counts_per_store_range', { from_iso: fromIso, to_iso: toIso }),
  ])
  const counts = new Map((leadCountsRaw ?? []).map((r: { slug: string; range_count: number; total_count: number }) => [r.slug, r]))
  const formOptions = ghlForms.map((f) => ({ id: f.id, name: f.name }))
  const calendarOptions = ghlCalendars.map((c) => ({ id: c.id, name: c.name, slug: c.slug ?? null, widgetSlug: c.widgetSlug ?? null }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 className="ap-page-title">Store fisici</h1>
        <p className="ap-page-subtitle">
          Per ogni store: form e calendario sono ospitati su GHL. Modifica il form/calendario in GHL e l&apos;URL aggiornato (e il QR) viene riflesso qui automaticamente. Per contare le iscrizioni, configura un workflow GHL sul form: <em>On Form Submission → Add Tag <code>&#123;slug&#125;</code></em> (es. <code>barletta</code>) o <code>store-&#123;slug&#125;</code>.
        </p>
      </header>

      <DateRangeForm initialFrom={fromStr} initialTo={toStr} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        {stores.map((s) => {
          const leadUrl = leadFormUrlFor(s.form_id)
          const bookingUrl = bookingUrlFor(s.calendar_widget_slug)
          const c = counts.get(s.slug) as { range_count?: number; total_count?: number } | undefined
          return (
            <div key={s.id} className="ap-card ap-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>{s.name}</div>
                  {s.city && <div style={{ fontSize: 12, color: 'var(--ap-text-muted)', marginTop: 2 }}>{s.city}</div>}
                </div>
                <span className="ap-pill" data-tone={s.active ? 'green' : 'gray'}>{s.active ? 'Attivo' : 'Disattivato'}</span>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div className="ap-stat" data-tone="accent" style={{ flex: 1 }}>
                  <div className="ap-stat-label">Lead nel periodo</div>
                  <div className="ap-stat-value">{c?.range_count ?? 0}</div>
                </div>
                <div className="ap-stat" data-tone="neutral" style={{ flex: 1 }}>
                  <div className="ap-stat-label">Lead totali</div>
                  <div className="ap-stat-value">{c?.total_count ?? 0}</div>
                </div>
              </div>

              <StoreResourcePicker
                storeId={s.id}
                forms={formOptions}
                calendars={calendarOptions}
                currentFormId={s.form_id}
                currentCalendarId={s.calendar_id}
                currentCalendarWidgetSlug={s.calendar_widget_slug}
              />

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>QR / Form lead</div>
                {leadUrl ? (
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
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--ap-text-faint)', margin: 0 }}>Seleziona un form GHL sopra per generare l&apos;URL pubblico e il QR.</p>
                )}
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Calendario prenotazioni</div>
                {bookingUrl ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <code style={{ fontSize: 11, padding: 8, background: 'var(--ap-bg)', borderRadius: 8, flex: 1, wordBreak: 'break-all' }}>{bookingUrl}</code>
                    <CopyButton text={bookingUrl} label="Copia" />
                    <a className="ap-btn ap-btn-ghost" style={{ height: 32, padding: '0 12px', fontSize: 11 }} href={bookingUrl} target="_blank" rel="noreferrer">Apri</a>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--ap-text-faint)', margin: 0 }}>Seleziona un calendario GHL sopra per attivare il link pubblico.</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
