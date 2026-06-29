import { createAdminClient } from '@/lib/supabase-server'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

function initials(name: string) {
  return name.split(' ').map(p => p[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

const STATUS_CLS: Record<string, string> = {
  confirmed: 'bs-badge-confirmed', new: 'bs-badge-confirmed',
  cancelled: 'bs-badge-cancelled', showed: 'bs-badge-showed', 'no-show': 'bs-badge-cancelled',
}
const STATUS_LBL: Record<string, string> = {
  confirmed: 'Confermato', new: 'Confermato', cancelled: 'Annullato',
  showed: 'Completato', 'no-show': 'No-show',
}

function PerformanceRing({ pct, color }: { pct: number; color: string }) {
  const r = 20; const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" style={{ flexShrink: 0 }}>
      <circle cx="26" cy="26" r={r} fill="none" stroke="#E8EAED" strokeWidth="4" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="800" fill="#111">{pct}%</text>
    </svg>
  )
}

export default async function Dashboard() {
  const sb = createAdminClient()
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)

  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay()); weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23, 59, 59, 999)

  const tomorrowStart = new Date(today); tomorrowStart.setDate(today.getDate() + 1); tomorrowStart.setHours(0, 0, 0, 0)
  const tomorrowEnd = new Date(tomorrowStart); tomorrowEnd.setHours(23, 59, 59, 999)

  const [
    { data: monthEvents },
    { data: todayEvents },
    { data: tomorrowEvents },
    { data: contacts },
  ] = await Promise.all([
    sb.from('cached_calendar_events')
      .select('ghl_id, title, start_time, appointment_status, contact_ghl_id')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .gte('start_time', monthStart.toISOString())
      .lte('start_time', monthEnd.toISOString()),
    sb.from('cached_calendar_events')
      .select('ghl_id, title, start_time, appointment_status, contact_ghl_id')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .gte('start_time', `${todayStr}T00:00:00.000Z`)
      .lte('start_time', `${todayStr}T23:59:59.999Z`)
      .order('start_time', { ascending: true }),
    sb.from('cached_calendar_events')
      .select('ghl_id, title, start_time, appointment_status, contact_ghl_id')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .gte('start_time', tomorrowStart.toISOString())
      .lte('start_time', tomorrowEnd.toISOString())
      .order('start_time', { ascending: true }),
    sb.from('cached_contacts')
      .select('ghl_id, first_name, last_name, date_added')
      .eq('location_id', BELLESSERE_LOCATION_ID),
  ])

  const mEvents = monthEvents ?? []
  const tEvents = todayEvents ?? []
  const tmrEvents = tomorrowEvents ?? []
  const allContacts = contacts ?? []

  const contactMap = new Map(allContacts.map(c => [c.ghl_id, `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()]))

  // Stats
  const todayTotal = tEvents.length
  const todayPending = tEvents.filter(e => !e.appointment_status || e.appointment_status === 'new' || e.appointment_status === 'pending').length
  const newClientsThisMonth = allContacts.filter(c => c.date_added && c.date_added >= monthStart.toISOString()).length
  const totalClients = allContacts.length

  // Performance (month)
  const totalM = mEvents.length
  const confirmedM = mEvents.filter(e => e.appointment_status === 'confirmed' || e.appointment_status === 'new').length
  const showedM = mEvents.filter(e => e.appointment_status === 'showed').length
  const cancelledM = mEvents.filter(e => e.appointment_status === 'cancelled').length
  const bookingRate = totalM > 0 ? Math.round((confirmedM / totalM) * 100) : 0
  const showRate = confirmedM > 0 ? Math.round(((showedM) / (confirmedM + showedM || 1)) * 100) : 0

  // Top clients by appointment count this month
  const clientApptCount: Record<string, number> = {}
  for (const e of mEvents) {
    if (e.contact_ghl_id) clientApptCount[e.contact_ghl_id] = (clientApptCount[e.contact_ghl_id] ?? 0) + 1
  }
  const topClients = Object.entries(clientApptCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, count]) => ({ id, name: contactMap.get(id) || 'Cliente', count }))

  const dateLabel = today.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="bs-page-eyebrow">Bentornato</div>
          <h1 className="bs-page-title">Dashboard</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="bs-date-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style={{ textTransform: 'capitalize' }}>{dateLabel}</span>
          </div>
          <a href="/designs/bellessere/appuntamenti" className="bs-btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nuovo appuntamento
          </a>
        </div>
      </div>

      {/* Stat cards */}
      <div className="bs-stats-grid">
        <div className="bs-stat-card">
          <div className="bs-stat-header">
            <div className="bs-stat-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            {todayPending > 0 && <div className="bs-stat-badge bs-stat-badge-warning">{todayPending} in attesa</div>}
          </div>
          <div className="bs-stat-value">{todayTotal}</div>
          <div className="bs-stat-label">Appuntamenti oggi</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-header">
            <div className="bs-stat-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            {newClientsThisMonth > 0 && <div className="bs-stat-badge bs-stat-badge-success">+{newClientsThisMonth} nuovi</div>}
          </div>
          <div className="bs-stat-value">{totalClients}</div>
          <div className="bs-stat-label">Clienti totali</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-header">
            <div className="bs-stat-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </div>
          <div className="bs-stat-value">{confirmedM}</div>
          <div className="bs-stat-label">Confermati (mese)</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-header">
            <div className="bs-stat-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            {cancelledM > 0 && <div className="bs-stat-badge bs-stat-badge-warning">{cancelledM} annullati</div>}
          </div>
          <div className="bs-stat-value">{totalM}</div>
          <div className="bs-stat-label">Totale (mese)</div>
        </div>
      </div>

      {/* 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
        {/* LEFT: Today + Tomorrow */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Today's schedule */}
          <div className="bs-card">
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--bs-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Agenda di oggi</div>
                <div style={{ fontSize: 12.5, color: 'var(--bs-text-muted)', marginTop: 3 }}>
                  {tEvents.length === 0 ? 'Nessun appuntamento' : `${tEvents.length} appuntament${tEvents.length === 1 ? 'o' : 'i'} in programma`}
                </div>
              </div>
              <a href="/designs/bellessere/calendario" style={{ fontSize: 12.5, color: 'var(--bs-text-faint)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                Vedi calendario
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
            </div>
            {tEvents.length === 0 ? (
              <div style={{ padding: '40px 22px', textAlign: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>
                Nessun appuntamento per oggi
              </div>
            ) : (
              <div>
                {tEvents.map(ev => {
                  const name = contactMap.get(ev.contact_ghl_id ?? '') || ev.title || 'Cliente'
                  const time = ev.start_time ? new Date(ev.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—'
                  const statusCls = STATUS_CLS[ev.appointment_status ?? 'new'] ?? 'bs-badge-pending'
                  const statusLbl = STATUS_LBL[ev.appointment_status ?? 'new'] ?? 'In attesa'
                  return (
                    <div key={ev.ghl_id} className="bs-list-row" style={{ cursor: 'default' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--bs-text-muted)', width: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--bs-text-faint)" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {time}
                      </div>
                      <div className="bs-avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{initials(name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                        {ev.title && <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>{ev.title}</div>}
                      </div>
                      <span className={`bs-badge ${statusCls}`}>{statusLbl}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Tomorrow */}
          <div className="bs-card">
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--bs-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Domani</div>
                <div style={{ fontSize: 12.5, color: 'var(--bs-text-muted)', marginTop: 3 }}>
                  {tmrEvents.length === 0 ? 'Nessun appuntamento' : `${tmrEvents.length} appuntament${tmrEvents.length === 1 ? 'o' : 'i'}`}
                </div>
              </div>
              <a href="/designs/bellessere/appuntamenti" style={{ fontSize: 12.5, color: 'var(--bs-text-faint)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                Tutti
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
            </div>
            {tmrEvents.length === 0 ? (
              <div style={{ padding: '32px 22px', textAlign: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>
                Nessun appuntamento per domani
              </div>
            ) : (
              <div>
                {tmrEvents.slice(0, 5).map(ev => {
                  const name = contactMap.get(ev.contact_ghl_id ?? '') || ev.title || 'Cliente'
                  const time = ev.start_time ? new Date(ev.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—'
                  const statusCls = STATUS_CLS[ev.appointment_status ?? 'new'] ?? 'bs-badge-pending'
                  const statusLbl = STATUS_LBL[ev.appointment_status ?? 'new'] ?? 'In attesa'
                  return (
                    <div key={ev.ghl_id} className="bs-list-row" style={{ cursor: 'default' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--bs-text-muted)', width: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--bs-text-faint)" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {time}
                      </div>
                      <div className="bs-avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{initials(name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                        {ev.title && <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>{ev.title}</div>}
                      </div>
                      <span className={`bs-badge ${statusCls}`}>{statusLbl}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Performance + Top Clients */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Performance */}
          <div className="bs-card" style={{ padding: '20px 22px' }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 20 }}>Performance</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Tasso di prenotazione', sublabel: 'Questo mese', value: bookingRate, color: '#10B981' },
                { label: 'Tasso di presenza', sublabel: 'Appuntamenti mantenuti', value: showRate, color: '#C9A84C' },
                { label: 'Tasso di completamento', sublabel: 'Servizi completati', value: totalM > 0 ? Math.round((showedM / totalM) * 100) : 0, color: '#6366F1' },
              ].map(p => (
                <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <PerformanceRing pct={p.value} color={p.color} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>{p.sublabel}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Clients */}
          <div className="bs-card">
            <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid var(--bs-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Top Clienti</div>
              <a href="/designs/bellessere/clienti" style={{ fontSize: 12, color: 'var(--bs-text-faint)', textDecoration: 'none' }}>Vedi tutti</a>
            </div>
            {topClients.length === 0 ? (
              <div style={{ padding: '24px 22px', fontSize: 13, color: 'var(--bs-text-faint)', textAlign: 'center' }}>Nessun dato disponibile</div>
            ) : (
              <div>
                {topClients.map((c, i) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderBottom: i < topClients.length - 1 ? '1px solid var(--bs-line)' : 'none' }}>
                    <div className="bs-avatar" style={{ width: 34, height: 34, fontSize: 12 }}>{initials(c.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>{c.count} appuntament{c.count === 1 ? 'o' : 'i'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
