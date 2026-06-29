import { createAdminClient } from '@/lib/supabase-server'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

function initials(name: string) {
  return name.split(' ').map(p => p[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confermato', new: 'Confermato', cancelled: 'Annullato',
  showed: 'Completato', 'no-show': 'No-show',
}
const STATUS_CLASS: Record<string, string> = {
  confirmed: 'bs-badge-confirmed', new: 'bs-badge-confirmed',
  cancelled: 'bs-badge-cancelled', showed: 'bs-badge-showed',
  'no-show': 'bs-badge-cancelled',
}

export default async function Dashboard() {
  const sb = createAdminClient()
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const tomorrowStart = new Date(today)
  tomorrowStart.setDate(today.getDate() + 1)
  tomorrowStart.setHours(0, 0, 0, 0)
  const tomorrowEnd = new Date(tomorrowStart)
  tomorrowEnd.setHours(23, 59, 59, 999)

  const [
    { data: weekEvents },
    { data: todayEvents },
    { data: tomorrowEvents },
    { data: contacts },
  ] = await Promise.all([
    sb.from('cached_calendar_events')
      .select('ghl_id, title, start_time, appointment_status, contact_ghl_id')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .gte('start_time', weekStart.toISOString())
      .lte('start_time', weekEnd.toISOString()),
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
      .select('ghl_id, first_name, last_name')
      .eq('location_id', BELLESSERE_LOCATION_ID),
  ])

  const wEvents = weekEvents ?? []
  const tEvents = todayEvents ?? []
  const tmrEvents = tomorrowEvents ?? []
  const contactMap = new Map((contacts ?? []).map(c => [c.ghl_id, `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()]))

  const todayTotal = tEvents.length
  const confirmed = wEvents.filter(e => e.appointment_status === 'confirmed' || e.appointment_status === 'new').length
  const cancelled = wEvents.filter(e => e.appointment_status === 'cancelled').length
  const totalClients = (contacts ?? []).length

  const dateLabel = today.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="bs-page-eyebrow">Panoramica</div>
          <h1 className="bs-page-title">Dashboard</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="bs-date-chip">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
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
          <div className="bs-stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="bs-stat-value">{todayTotal}</div>
          <div className="bs-stat-label">Appuntamenti oggi</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="bs-stat-value">{confirmed}</div>
          <div className="bs-stat-label">Confermati (settimana)</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
          <div className="bs-stat-value">{cancelled}</div>
          <div className="bs-stat-label">Annullati (settimana)</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="bs-stat-value">{totalClients}</div>
          <div className="bs-stat-label">Clienti totali</div>
        </div>
      </div>

      {/* Today + Tomorrow side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Today */}
        <div className="bs-card">
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--bs-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Oggi</div>
              <div style={{ fontSize: 12, color: 'var(--bs-text-muted)', marginTop: 2 }}>
                {tEvents.length === 0 ? 'Nessun appuntamento' : `${tEvents.length} appuntament${tEvents.length === 1 ? 'o' : 'i'}`}
              </div>
            </div>
            <a href="/designs/bellessere/calendario" style={{ fontSize: 12, color: 'var(--bs-text-faint)', textDecoration: 'none' }}>
              Calendario →
            </a>
          </div>
          {tEvents.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>
              Nessun appuntamento per oggi
            </div>
          ) : (
            <div>
              {tEvents.slice(0, 6).map(ev => {
                const name = contactMap.get(ev.contact_ghl_id ?? '') || ev.title || '—'
                const time = ev.start_time
                  ? new Date(ev.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                  : '—'
                const statusCls = STATUS_CLASS[ev.appointment_status ?? 'new'] ?? 'bs-badge-pending'
                const statusLbl = STATUS_LABEL[ev.appointment_status ?? 'new'] ?? 'In attesa'
                return (
                  <div key={ev.ghl_id} className="bs-list-row" style={{ cursor: 'default' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--bs-text-muted)', width: 44, flexShrink: 0 }}>{time}</div>
                    <div className="bs-avatar" style={{ width: 34, height: 34, fontSize: 12 }}>{initials(name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                      {ev.title && <div style={{ fontSize: 11.5, color: 'var(--bs-text-muted)' }}>{ev.title}</div>}
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
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--bs-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Domani</div>
              <div style={{ fontSize: 12, color: 'var(--bs-text-muted)', marginTop: 2 }}>
                {tmrEvents.length === 0 ? 'Nessun appuntamento' : `${tmrEvents.length} appuntament${tmrEvents.length === 1 ? 'o' : 'i'}`}
              </div>
            </div>
            <a href="/designs/bellessere/appuntamenti" style={{ fontSize: 12, color: 'var(--bs-text-faint)', textDecoration: 'none' }}>
              Tutti →
            </a>
          </div>
          {tmrEvents.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>
              Nessun appuntamento per domani
            </div>
          ) : (
            <div>
              {tmrEvents.slice(0, 6).map(ev => {
                const name = contactMap.get(ev.contact_ghl_id ?? '') || ev.title || '—'
                const time = ev.start_time
                  ? new Date(ev.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                  : '—'
                const statusCls = STATUS_CLASS[ev.appointment_status ?? 'new'] ?? 'bs-badge-pending'
                const statusLbl = STATUS_LABEL[ev.appointment_status ?? 'new'] ?? 'In attesa'
                return (
                  <div key={ev.ghl_id} className="bs-list-row" style={{ cursor: 'default' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--bs-text-muted)', width: 44, flexShrink: 0 }}>{time}</div>
                    <div className="bs-avatar" style={{ width: 34, height: 34, fontSize: 12 }}>{initials(name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                      {ev.title && <div style={{ fontSize: 11.5, color: 'var(--bs-text-muted)' }}>{ev.title}</div>}
                    </div>
                    <span className={`bs-badge ${statusCls}`}>{statusLbl}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Week summary */}
      <div className="bs-card" style={{ padding: '20px 24px' }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 16 }}>Settimana in corso</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[
            { label: 'Confermati', value: confirmed, color: 'var(--bs-success)', bg: 'rgba(16,185,129,0.06)' },
            { label: 'Annullati', value: cancelled, color: 'var(--bs-danger)', bg: 'rgba(239,68,68,0.06)' },
            { label: 'Totale', value: wEvents.length, color: 'var(--bs-text)', bg: 'var(--bs-bg)' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '18px 12px', borderRadius: 12, background: s.bg }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--bs-text-muted)', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
