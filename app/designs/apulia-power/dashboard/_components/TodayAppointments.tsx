import { listTodayAppointmentsByStore } from '@/lib/apulia/appointments'

/**
 * Today's appointments per store. Split out of the dashboard and streamed,
 * because it calls GHL's calendar API once per store: the rest of the page is
 * database-only and should not wait a second or two for a third party before
 * anything appears.
 */
export default async function TodayAppointments() {
  const todayAppts = await listTodayAppointmentsByStore()
  const totalTodayAppts = todayAppts.reduce((s, x) => s + x.appointments.length, 0)
  const todayLabel = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <section className="ap-card">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--ap-line)', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, textTransform: 'capitalize' }}>
          📅 Appuntamenti di oggi <span style={{ color: 'var(--ap-text-faint)', fontWeight: 500, textTransform: 'lowercase' }}>· {todayLabel}</span>
        </h2>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-text-muted)' }}>
          {totalTodayAppts} {totalTodayAppts === 1 ? 'appuntamento' : 'appuntamenti'} totali
        </span>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, padding: 16 }}>
        {todayAppts.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)', fontSize: 13 }}>
            Nessuno store configurato.
          </div>
        )}
        {todayAppts.map((s) => (
          <div key={s.storeSlug} style={{ border: '1px solid var(--ap-line)', borderRadius: 10, padding: 12, background: s.appointments.length > 0 ? 'color-mix(in srgb, var(--ap-blue-soft) 25%, white)' : 'var(--ap-surface, #fff)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{s.storeName}</div>
                {s.city && <div style={{ fontSize: 11, color: 'var(--ap-text-muted)' }}>{s.city}</div>}
              </div>
              <span className="ap-pill" data-tone={s.appointments.length > 0 ? 'blue' : 'gray'} style={{ fontSize: 11 }}>
                {s.appointments.length}
              </span>
            </div>
            {!s.calendarId && (
              <div style={{ fontSize: 11, color: 'var(--ap-text-faint)', fontStyle: 'italic' }}>Nessun calendario configurato.</div>
            )}
            {s.error && (
              <div style={{ fontSize: 11, color: 'var(--ap-danger)' }}>Errore: {s.error}</div>
            )}
            {s.calendarId && !s.error && s.appointments.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--ap-text-faint)' }}>Nessun appuntamento oggi.</div>
            )}
            {s.appointments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {s.appointments.map((a) => (
                  <div key={a.id} style={{ fontSize: 12, padding: '6px 0', borderTop: '1px solid var(--ap-line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                      <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ap-text)' }}>
                        {new Date(a.startTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                      {a.appointmentStatus && (
                        <span className="ap-pill" data-tone={
                          a.appointmentStatus === 'confirmed' ? 'green'
                          : a.appointmentStatus === 'cancelled' || a.appointmentStatus === 'noshow' ? 'red'
                          : 'amber'
                        } style={{ fontSize: 9 }}>
                          {a.appointmentStatus}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 2, color: 'var(--ap-text)', fontWeight: 600 }}>
                      {a.contactName ?? a.title ?? 'Senza nome'}
                    </div>
                    {a.contactPhone && (
                      <div style={{ fontSize: 11, color: 'var(--ap-text-muted)' }}>📞 {a.contactPhone}</div>
                    )}
                    {a.contactEmail && !a.contactPhone && (
                      <div style={{ fontSize: 11, color: 'var(--ap-text-muted)' }}>{a.contactEmail}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/** Same frame as the card above, so the layout does not jump when it arrives. */
export function TodayAppointmentsSkeleton() {
  const todayLabel = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <section className="ap-card">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--ap-line)', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, textTransform: 'capitalize' }}>
          📅 Appuntamenti di oggi <span style={{ color: 'var(--ap-text-faint)', fontWeight: 500, textTransform: 'lowercase' }}>· {todayLabel}</span>
        </h2>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-text-faint)' }}>caricamento…</span>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, padding: 16 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ border: '1px solid var(--ap-line)', borderRadius: 10, padding: 12, height: 86, background: 'var(--ap-surface, #fff)', opacity: 0.5 }} />
        ))}
      </div>
    </section>
  )
}
