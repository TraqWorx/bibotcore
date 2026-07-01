import { createAdminClient } from '@/lib/supabase-server'
import { refreshIfNeeded } from '@/lib/ghl/refreshIfNeeded'
import { BELLESSERE_LOCATION_ID } from '@/lib/bellessere/constants'

export const dynamic = 'force-dynamic'

const GHL = 'https://services.leadconnectorhq.com'

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

const PIE_COLORS = ['#C9A84C', '#6366F1', '#10B981', '#EF4444', '#F59E0B']

function PerformanceRing({ pct, color }: { pct: number; color: string }) {
  const r = 20; const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" style={{ flexShrink: 0 }}>
      <circle cx="26" cy="26" r={r} fill="none" stroke="#E8EAED" strokeWidth="4" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" transform="rotate(-90 26 26)" />
      <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="800" fill="#111">{pct}%</text>
    </svg>
  )
}

function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null
  const r = 52; const cx = 60; const cy = 60; const ir = 28
  let currentAngle = -Math.PI / 2
  const paths = slices.map(s => {
    const start = currentAngle
    const sweep = (s.value / total) * 2 * Math.PI
    currentAngle += sweep
    const x1 = cx + r * Math.cos(start); const y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(currentAngle); const y2 = cy + r * Math.sin(currentAngle)
    const large = sweep > Math.PI ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`
    return { ...s, d }
  })
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
      {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} stroke="white" strokeWidth="2" />)}
      <circle cx={cx} cy={cy} r={ir} fill="white" />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#111">{total}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="9" fill="#888">totale</text>
    </svg>
  )
}

async function getGhlUsers(token: string): Promise<{ id: string; name: string }[]> {
  try {
    const res = await fetch(`${GHL}/users/?locationId=${BELLESSERE_LOCATION_ID}&type=LOCATION`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
    })
    const data = await res.json()
    return (data?.users ?? []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))
  } catch { return [] }
}

export default async function Dashboard() {
  const sb = createAdminClient()
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)
  const tomorrowStart = new Date(today); tomorrowStart.setDate(today.getDate() + 1); tomorrowStart.setHours(0, 0, 0, 0)
  const tomorrowEnd = new Date(tomorrowStart); tomorrowEnd.setHours(23, 59, 59, 999)

  // Fetch GHL token for users
  const { data: conn } = await sb
    .from('ghl_connections')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('location_id', BELLESSERE_LOCATION_ID)
    .single()
  const token = conn ? await refreshIfNeeded(BELLESSERE_LOCATION_ID, conn).catch(() => null) : null

  const [
    { data: monthEvents },
    { data: todayEvents },
    { data: tomorrowEvents },
    { data: contacts },
    users,
  ] = await Promise.all([
    sb.from('cached_calendar_events')
      .select('ghl_id, title, start_time, appointment_status, contact_ghl_id, user_id, calendar_id')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .gte('start_time', monthStart.toISOString())
      .lte('start_time', monthEnd.toISOString()),
    sb.from('cached_calendar_events')
      .select('ghl_id, title, start_time, appointment_status, contact_ghl_id, user_id')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .gte('start_time', `${todayStr}T00:00:00.000Z`)
      .lte('start_time', `${todayStr}T23:59:59.999Z`)
      .order('start_time', { ascending: true }),
    sb.from('cached_calendar_events')
      .select('ghl_id, title, start_time, appointment_status, contact_ghl_id, user_id')
      .eq('location_id', BELLESSERE_LOCATION_ID)
      .gte('start_time', tomorrowStart.toISOString())
      .lte('start_time', tomorrowEnd.toISOString())
      .order('start_time', { ascending: true }),
    sb.from('cached_contacts')
      .select('ghl_id, first_name, last_name, date_added')
      .eq('location_id', BELLESSERE_LOCATION_ID),
    token ? getGhlUsers(token) : Promise.resolve([] as { id: string; name: string }[]),
  ])

  const mEvents = monthEvents ?? []
  const tEvents = todayEvents ?? []
  const tmrEvents = tomorrowEvents ?? []
  const allContacts = contacts ?? []

  const contactMap = new Map(allContacts.map(c => [c.ghl_id, `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()]))
  const userMap = new Map(users.map(u => [u.id, u.name]))

  // Stats
  const todayTotal = tEvents.length
  const todayPending = tEvents.filter(e => !e.appointment_status || e.appointment_status === 'new' || e.appointment_status === 'pending').length
  const newClientsThisMonth = allContacts.filter(c => c.date_added && c.date_added >= monthStart.toISOString()).length
  const totalClients = allContacts.length

  // Performance (month)
  const totalM = mEvents.length
  const confirmedM = mEvents.filter(e => e.appointment_status === 'confirmed' || e.appointment_status === 'new').length
  const showedM = mEvents.filter(e => e.appointment_status === 'showed').length
  const noshowM = mEvents.filter(e => e.appointment_status === 'no-show' || e.appointment_status === 'noshow').length
  const cancelledM = mEvents.filter(e => e.appointment_status === 'cancelled').length
  const bookingRate = totalM > 0 ? Math.round((confirmedM / totalM) * 100) : 0
  const showRate = (showedM + noshowM) > 0 ? Math.round((showedM / (showedM + noshowM)) * 100) : 0

  // Operatori stats this month
  const userCounts: Record<string, number> = {}
  for (const e of mEvents) {
    if (e.user_id) userCounts[e.user_id] = (userCounts[e.user_id] ?? 0) + 1
  }
  const operatori = users
    .map(u => ({ name: u.name, count: userCounts[u.id] ?? 0 }))
    .filter(o => o.count > 0)
    .sort((a, b) => b.count - a.count)

  // Top 5 services by title this month
  const titleCounts: Record<string, number> = {}
  for (const e of mEvents) {
    if (e.title) titleCounts[e.title] = (titleCounts[e.title] ?? 0) + 1
  }
  const topServices = Object.entries(titleCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value], i) => ({ label: name, value, color: PIE_COLORS[i] }))

  // Top clients by appointment count this month
  const clientApptCount: Record<string, number> = {}
  for (const e of mEvents) {
    if (e.contact_ghl_id) clientApptCount[e.contact_ghl_id] = (clientApptCount[e.contact_ghl_id] ?? 0) + 1
  }
  const topClients = Object.entries(clientApptCount)
    .sort(([, a], [, b]) => b - a).slice(0, 5)
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
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
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
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
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
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
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
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            {noshowM > 0 && <div className="bs-stat-badge bs-stat-badge-warning">{noshowM} no-show</div>}
          </div>
          <div className="bs-stat-value">{cancelledM}</div>
          <div className="bs-stat-label">Annullati (mese)</div>
        </div>
        <div className="bs-stat-card">
          <div className="bs-stat-header">
            <div className="bs-stat-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </div>
          <div className="bs-stat-value">{totalM}</div>
          <div className="bs-stat-label">Totale (mese)</div>
        </div>
      </div>

      {/* 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
        {/* LEFT: Today + Tomorrow */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            { label: 'Agenda di oggi', sub: tEvents.length === 0 ? 'Nessun appuntamento' : `${tEvents.length} appuntament${tEvents.length === 1 ? 'o' : 'i'} in programma`, evts: tEvents, link: '/designs/bellessere/calendario', linkLabel: 'Vedi calendario' },
            { label: 'Domani', sub: tmrEvents.length === 0 ? 'Nessun appuntamento' : `${tmrEvents.length} appuntament${tmrEvents.length === 1 ? 'o' : 'i'}`, evts: tmrEvents.slice(0, 5), link: '/designs/bellessere/appuntamenti', linkLabel: 'Tutti' },
          ].map(section => (
            <div key={section.label} className="bs-card">
              <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--bs-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{section.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--bs-text-muted)', marginTop: 3 }}>{section.sub}</div>
                </div>
                <a href={section.link} style={{ fontSize: 12.5, color: 'var(--bs-text-faint)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {section.linkLabel}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </a>
              </div>
              {section.evts.length === 0 ? (
                <div style={{ padding: '32px 22px', textAlign: 'center', color: 'var(--bs-text-faint)', fontSize: 13 }}>
                  Nessun appuntamento
                </div>
              ) : (
                <div>
                  {section.evts.map(ev => {
                    const name = contactMap.get(ev.contact_ghl_id ?? '') || ev.title || 'Cliente'
                    const opName = ev.user_id ? userMap.get(ev.user_id) : null
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
                          <div style={{ fontSize: 11.5, color: 'var(--bs-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ev.title && <span>{ev.title}</span>}
                            {opName && <span style={{ opacity: 0.7 }}>{ev.title ? ' · ' : ''}{opName}</span>}
                          </div>
                        </div>
                        <span className={`bs-badge ${statusCls}`}>{statusLbl}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* RIGHT: Performance + Top Clients */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="bs-card" style={{ padding: '20px 22px' }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 20 }}>Performance</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Tasso di prenotazione', sublabel: 'Questo mese', value: bookingRate, color: '#10B981' },
                { label: 'Tasso di presenza', sublabel: `Presenze / (presenze + no-show)`, value: showRate, color: '#C9A84C' },
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

          <div className="bs-card">
            <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid var(--bs-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Top Clienti</div>
              <a href="/designs/bellessere/clienti" style={{ fontSize: 12, color: 'var(--bs-text-faint)', textDecoration: 'none' }}>Vedi tutti</a>
            </div>
            {topClients.length === 0 ? (
              <div style={{ padding: '24px 22px', fontSize: 13, color: 'var(--bs-text-faint)', textAlign: 'center' }}>Nessun dato</div>
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

      {/* Bottom stats: Operatori + Service pie */}
      {(operatori.length > 0 || topServices.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: topServices.length > 0 && operatori.length > 0 ? '1fr 1fr' : '1fr', gap: 20 }}>
          {/* Operatori table */}
          {operatori.length > 0 && (
            <div className="bs-card">
              <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid var(--bs-line)' }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>Operatori — questo mese</div>
                <div style={{ fontSize: 12.5, color: 'var(--bs-text-muted)', marginTop: 3 }}>Appuntamenti gestiti per operatore</div>
              </div>
              <div>
                {operatori.map((op, i) => {
                  const pct = totalM > 0 ? Math.round((op.count / totalM) * 100) : 0
                  return (
                    <div key={op.name} style={{ padding: '12px 22px', borderBottom: i < operatori.length - 1 ? '1px solid var(--bs-line)' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="bs-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials(op.name)}</div>
                          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{op.name}</span>
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{op.count} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--bs-text-faint)' }}>({pct}%)</span></div>
                      </div>
                      <div style={{ height: 5, background: 'var(--bs-line)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--bs-gold)', borderRadius: 3, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top services pie */}
          {topServices.length > 0 && (
            <div className="bs-card" style={{ padding: '20px 22px' }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 18 }}>Servizi più prenotati</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <DonutChart slices={topServices} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {topServices.map((s, i) => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--bs-text-muted)', flexShrink: 0 }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
