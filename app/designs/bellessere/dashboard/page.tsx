import { createAdminClient } from '@/lib/supabase-server'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    confirmed: 'bs-badge-confirmed',
    new: 'bs-badge-confirmed',
    cancelled: 'bs-badge-cancelled',
    showed: 'bs-badge-showed',
    'no-show': 'bs-badge-cancelled',
  }
  const labels: Record<string, string> = {
    confirmed: 'Confermato', new: 'Confermato', cancelled: 'Annullato',
    showed: 'Completato', 'no-show': 'No-show', invalid: 'Invalido',
  }
  const cls = map[s] ?? 'bs-badge-pending'
  const label = labels[s] ?? 'In attesa'
  return <span className={`bs-badge ${cls}`}>{label}</span>
}

export default async function Dashboard() {
  const sb = createAdminClient()
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const todayStart = `${todayStr}T00:00:00.000Z`
  const todayEnd = `${todayStr}T23:59:59.999Z`

  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const [
    { data: allEvents },
    { data: todayEvents },
    { data: contacts },
  ] = await Promise.all([
    sb.from('cached_calendar_events')
      .select('ghl_id, title, start_time, end_time, appointment_status, contact_ghl_id')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .gte('start_time', weekStart.toISOString())
      .lte('start_time', weekEnd.toISOString()),
    sb.from('cached_calendar_events')
      .select('ghl_id, title, start_time, appointment_status, contact_ghl_id')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .gte('start_time', todayStart)
      .lte('start_time', todayEnd)
      .order('start_time', { ascending: true }),
    sb.from('cached_contacts')
      .select('ghl_id, first_name, last_name')
      .eq('location_id', BELLESSERE_LOCATION_ID),
  ])

  const events = allEvents ?? []
  const tEvents = todayEvents ?? []
  const contactMap = new Map((contacts ?? []).map(c => [c.ghl_id, `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()]))

  const totalToday = tEvents.length
  const pending = events.filter(e => e.appointment_status === 'new' || e.appointment_status === 'pending').length
  const confirmed = events.filter(e => e.appointment_status === 'confirmed').length
  const totalClients = (contacts ?? []).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="bs-page-eyebrow">Benvenuto</div>
          <h1 className="bs-page-title">Dashboard</h1>
        </div>
        <a href="/designs/bellessere/appuntamenti" className="bs-btn-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuovo appuntamento
        </a>
      </div>

      {/* Stats */}
      <div className="bs-stats-grid">
        <div className="bs-stat-card">
          <div className="bs-stat-value">{totalToday}</div>
          <div className="bs-stat-label">Appuntamenti oggi</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-value">{pending}</div>
          <div className="bs-stat-label">In attesa (settimana)</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-value">{confirmed}</div>
          <div className="bs-stat-label">Confermati (settimana)</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-value">{totalClients}</div>
          <div className="bs-stat-label">Clienti totali</div>
        </div>
      </div>

      {/* Today's schedule */}
      <div className="bs-card">
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--bs-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Agenda di oggi</div>
            <div style={{ fontSize: 12.5, color: 'var(--bs-text-muted)', marginTop: 2 }}>
              {tEvents.length} appuntamenti · {todayStr}
            </div>
          </div>
          <a href="/designs/bellessere/calendario" className="bs-btn-ghost" style={{ fontSize: 12.5 }}>
            Vedi calendario →
          </a>
        </div>

        {tEvents.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>
            Nessun appuntamento per oggi.
          </div>
        ) : (
          <div>
            {tEvents.map(ev => {
              const name = contactMap.get(ev.contact_ghl_id ?? '') || ev.title || '—'
              const time = ev.start_time ? new Date(ev.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—'
              return (
                <div key={ev.ghl_id} className="bs-list-row" style={{ cursor: 'default' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bs-text-muted)', width: 52, flexShrink: 0 }}>{time}</div>
                  <div className="bs-avatar">{initials(name)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{name}</div>
                    <div style={{ fontSize: 12, color: 'var(--bs-text-muted)' }}>{ev.title || 'Appuntamento'}</div>
                  </div>
                  {statusBadge(ev.appointment_status ?? 'new')}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* This week summary */}
      <div className="bs-card" style={{ padding: '20px 22px' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Riepilogo settimana</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { label: 'Confermati', value: confirmed, color: 'var(--bs-success)' },
            { label: 'In attesa', value: pending, color: 'var(--bs-warning)' },
            { label: 'Annullati', value: events.filter(e => e.appointment_status === 'cancelled').length, color: 'var(--bs-danger)' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '16px', borderRadius: 10, background: 'var(--bs-bg)' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--bs-text-muted)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
