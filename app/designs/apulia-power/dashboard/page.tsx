import Link from 'next/link'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listAdminsWithStats, loadSnapshot } from '@/lib/apulia/queries'
import { currentPeriod, APULIA_FIELD } from '@/lib/apulia/fields'
import { createAdminClient } from '@/lib/supabase-server'
import { listTodayAppointmentsByStore } from '@/lib/apulia/appointments'
import DateRangeForm from '../stores/_components/DateRangeForm'

export const dynamic = 'force-dynamic'

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

interface SearchParams { from?: string; to?: string }

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await getApuliaSession()

  if (session.role === 'amministratore') return <AdminView codice={session.codiceAmministratore} contactId={session.contactId} />

  const sp = (await searchParams) ?? {}
  // Default range: current month → today.
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const defaultTo = now.toISOString().slice(0, 10)
  const fromIso = sp.from && sp.from.length === 10 ? sp.from : defaultFrom
  const toIso = sp.to && sp.to.length === 10 ? sp.to : defaultTo
  const fromTs = new Date(fromIso + 'T00:00:00Z').toISOString()
  const toTs = new Date(toIso + 'T23:59:59Z').toISOString()
  const isCustomRange = !!(sp.from || sp.to)

  // Owner view
  const [snap, admins] = await Promise.all([loadSnapshot(), listAdminsWithStats()])
  // "Da pagare" = totale commissioni non ancora incassate (sia scaduto sia futuro).
  // "Già pagato" = somma di chi ha già pagato il periodo corrente.
  const totalDue = admins.filter((a) => !a.paidThisPeriod).reduce((s, a) => s + a.total, 0)
  const totalPaid = admins.filter((a) => a.paidThisPeriod).reduce((s, a) => s + a.total, 0)
  const dueNowCount = admins.filter((a) => a.isDueNow).length
  const period = currentPeriod()

  // Recent imports + leads-per-store (selected range) + today's
  // appointments grouped by store.
  const sb = createAdminClient()
  const [{ data: recent }, { data: leadsByStore }, todayAppts] = await Promise.all([
    sb.from('apulia_imports').select('id, kind, filename, rows_total, created_at').order('created_at', { ascending: false }).limit(5),
    sb.rpc('apulia_lead_counts_per_store_range', { from_iso: fromTs, to_iso: toTs }) as unknown as Promise<{ data: { slug: string; range_count: number; total_count: number }[] | null }>,
    listTodayAppointmentsByStore(),
  ])
  const stores = await import('@/lib/apulia/stores').then((m) => m.listStores())
  const leadsMap = new Map((leadsByStore ?? []).map((r) => [r.slug, r]))
  const totalLeadsRange = (leadsByStore ?? []).reduce((s, r) => s + (r.range_count || 0), 0)
  const totalTodayAppts = todayAppts.reduce((s, x) => s + x.appointments.length, 0)
  const todayLabel = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

  const rangeLabel = isCustomRange
    ? `dal ${new Date(fromIso).toLocaleDateString('it-IT')} al ${new Date(toIso).toLocaleDateString('it-IT')}`
    : 'mese corrente'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 className="ap-page-title">Dashboard</h1>
        <p className="ap-page-subtitle">Panoramica della rete commerciale Apulia Power. Periodo corrente: <strong>{period}</strong>.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <div className="ap-stat" data-tone="accent">
          <div className="ap-stat-label">Condomini attivi</div>
          <div className="ap-stat-value">{snap.totalPodsActive.toLocaleString('it-IT')}</div>
          <div className="ap-stat-foot">{(snap.totalPodsActive + snap.totalPodsSwitchedOut).toLocaleString('it-IT')} totali · escl. switch-out</div>
        </div>
        <div className="ap-stat" data-tone="neutral">
          <div className="ap-stat-label">Amministratori</div>
          <div className="ap-stat-value">{snap.totalAdmins.toLocaleString('it-IT')}</div>
          <div className="ap-stat-foot">tutti i gestori condominiali</div>
        </div>
        <div className="ap-stat" data-tone="warn">
          <div className="ap-stat-label">Switch-out</div>
          <div className="ap-stat-value">{snap.totalPodsSwitchedOut.toLocaleString('it-IT')}</div>
          <div className="ap-stat-foot">esclusi dal calcolo commissione</div>
        </div>
        <div className="ap-stat" data-tone="accent">
          <div className="ap-stat-label">Lead nel periodo</div>
          <div className="ap-stat-value">{totalLeadsRange.toLocaleString('it-IT')}</div>
          <div className="ap-stat-foot">{rangeLabel} · da QR / form pubblici</div>
        </div>
        <div className="ap-stat" data-tone={dueNowCount > 0 ? 'warn' : undefined}>
          <div className="ap-stat-label">Da pagare</div>
          <div className="ap-stat-value">{fmtEur(totalDue)}</div>
          <div className="ap-stat-foot">{dueNowCount > 0 ? `${dueNowCount} con scadenza oggi o in arretrato` : 'Nessun arretrato — tutti programmati'}</div>
        </div>
        <div className="ap-stat" data-tone="good">
          <div className="ap-stat-label">Già pagato (totale)</div>
          <div className="ap-stat-value">{fmtEur(totalPaid)}</div>
          <div className="ap-stat-foot">{admins.filter((a) => a.paidThisPeriod).length} amministratori in corso</div>
        </div>
      </div>

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

      <DateRangeForm initialFrom={fromIso} initialTo={toIso} basePath="/designs/apulia-power/dashboard" />

      <section className="ap-card">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--ap-line)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 800 }}>Lead per store <span style={{ color: 'var(--ap-text-faint)', fontWeight: 500 }}>· {rangeLabel}</span></h2>
          <Link href="/designs/apulia-power/stores" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-blue)', textDecoration: 'none' }}>Gestisci →</Link>
        </header>
        <table className="ap-table">
          <thead><tr><th>Store</th><th style={{ textAlign: 'right' }}>Nel periodo</th><th style={{ textAlign: 'right' }}>Totale</th></tr></thead>
          <tbody>
            {stores.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessuno store configurato.</td></tr>}
            {stores.map((s) => {
              const r = leadsMap.get(s.slug) as { range_count?: number; total_count?: number } | undefined
              return (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong>{s.city && <span style={{ color: 'var(--ap-text-muted)', fontSize: 11, marginLeft: 6 }}>{s.city}</span>}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{(r?.range_count ?? 0)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--ap-text-muted)' }}>{(r?.total_count ?? 0)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 20 }}>
        <section className="ap-card">
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--ap-line)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 800 }}>Top amministratori per commissione</h2>
            <Link href="/designs/apulia-power/amministratori" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-blue)', textDecoration: 'none' }}>Tutti →</Link>
          </header>
          <table className="ap-table">
            <thead>
              <tr><th>Nome</th><th style={{ textAlign: 'right' }}>POD</th><th style={{ textAlign: 'right' }}>Da pagare</th><th>Pagamento</th></tr>
            </thead>
            <tbody>
              {admins.slice(0, 8).map((a) => (
                <tr key={a.contactId}>
                  <td>
                    <Link href={`/designs/apulia-power/amministratori/${a.contactId}`} style={{ color: 'var(--ap-text)', textDecoration: 'none', fontWeight: 600 }}>{a.name}</Link>
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.podsActive}{a.podsSwitchedOut > 0 && <span style={{ color: 'var(--ap-warning)', fontSize: 11, marginLeft: 4 }}>+{a.podsSwitchedOut} so</span>}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtEur(a.total)}</td>
                  <td>{a.paidThisPeriod ? <span className="ap-pill" data-tone="green">Pagato</span> : <span className="ap-pill" data-tone="amber">Da pagare</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="ap-card ap-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Azioni rapide</h2>
          <Link href="/designs/apulia-power/imports" className="ap-btn ap-btn-primary" style={{ width: '100%' }}>📥 Carica nuovi PDP</Link>
          <Link href="/designs/apulia-power/imports" className="ap-btn ap-btn-ghost" style={{ width: '100%' }}>📤 Carica Switch-out</Link>
          <hr style={{ border: 0, borderTop: '1px solid var(--ap-line)', margin: '4px 0' }} />
          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Import recenti</h3>
          {(recent ?? []).length === 0 && <div style={{ fontSize: 12, color: 'var(--ap-text-faint)' }}>Nessun import.</div>}
          {(recent ?? []).map((r) => (
            <div key={r.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--ap-line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="ap-pill" data-tone={r.kind === 'pdp' ? 'blue' : 'amber'} style={{ fontSize: 9 }}>{r.kind === 'pdp' ? 'PDP' : 'SO'}</span>
                <span style={{ color: 'var(--ap-text-muted)' }}>{new Date(r.created_at).toLocaleDateString('it-IT')}</span>
              </div>
              <div style={{ marginTop: 4, color: 'var(--ap-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.filename ?? ''}>{r.filename}</div>
              <div style={{ color: 'var(--ap-text-faint)', fontSize: 11 }}>{r.rows_total?.toLocaleString('it-IT')} righe</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

async function AdminView({ codice, contactId }: { codice?: string; contactId?: string }) {
  const period = currentPeriod()
  if (!contactId) {
    return (
      <div className="ap-card ap-card-pad">
        <p>Profilo non collegato. Contatta l&apos;amministrazione.</p>
      </div>
    )
  }
  const { adminWithPods } = await import('@/lib/apulia/queries')
  const { admin, activePods, switchedPods } = await adminWithPods(contactId)
  if (!admin) return <div className="ap-card ap-card-pad">Profilo non trovato.</div>

  const sb = createAdminClient()
  const [{ data: payments }, { data: contactRow }] = await Promise.all([
    sb.from('apulia_payments').select('period, amount_cents, paid_at').eq('contact_id', contactId).order('paid_at', { ascending: false }).limit(6),
    sb.from('apulia_contacts').select('email, phone, custom_fields').eq('id', contactId).maybeSingle(),
  ])

  // Read-only "Dettagli contatto" panel: show the admin their own GHL data
  // so they can verify what we have on file. Editing happens through the
  // owner — we don't expose the full editor here.
  const cf = (contactRow?.custom_fields ?? {}) as Record<string, string>
  const contactDetails: Array<{ label: string; value: string | null }> = [
    { label: 'Email', value: contactRow?.email ?? cf[APULIA_FIELD.EMAIL_BILLING] ?? null },
    { label: 'Telefono', value: contactRow?.phone ?? cf[APULIA_FIELD.TELEFONO_AMMINISTRATORE] ?? null },
    { label: 'Codice Fiscale', value: cf[APULIA_FIELD.CODICE_FISCALE_AMMINISTRATORE] ?? null },
    { label: 'Partita IVA', value: cf[APULIA_FIELD.PARTITA_IVA_AMMINISTRATORE] ?? null },
    // Indirizzo / Città / Provincia field IDs aren't exported as constants;
    // pull by raw id (also referenced this way in import-admins.ts).
    { label: 'Indirizzo', value: cf['oCvfwCelHDn6gWEljqUJ'] ?? null },
    { label: 'Città', value: cf['EXO9WD4aLV2aPiMYxXUU'] ?? null },
    { label: 'Provincia', value: cf['opaPQWrWwDiaAeyoMbN5'] ?? null },
  ].filter((d) => d.value && d.value.trim() !== '')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 className="ap-page-title">Ciao {admin.name}</h1>
        <p className="ap-page-subtitle">Cod. Amministratore: <strong style={{ fontFamily: 'monospace' }}>{codice ?? '—'}</strong> · Periodo corrente: <strong>{period}</strong>.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <div className="ap-stat" data-tone="accent">
          <div className="ap-stat-label">Condomini attivi</div>
          <div className="ap-stat-value">{admin.podsActive}</div>
        </div>
        <div className="ap-stat" data-tone="warn">
          <div className="ap-stat-label">Switch-out</div>
          <div className="ap-stat-value">{admin.podsSwitchedOut}</div>
        </div>
        <div className="ap-stat" data-tone={admin.paidThisPeriod ? 'good' : 'neutral'}>
          <div className="ap-stat-label">Da ricevere {period}</div>
          <div className="ap-stat-value">{fmtEur(admin.total)}</div>
          <div className="ap-stat-foot">{admin.paidThisPeriod ? `Ricevuto il ${admin.paidAt ? new Date(admin.paidAt).toLocaleDateString('it-IT') : ''}` : 'In attesa di pagamento'}</div>
        </div>
      </div>

      {contactDetails.length > 0 && (
        <section className="ap-card">
          <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 14, fontWeight: 800 }}>Dettagli contatto</h2>
            <span style={{ fontSize: 11, color: 'var(--ap-text-faint)' }}>Per modifiche, contatta l&apos;amministrazione.</span>
          </header>
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {contactDetails.map((d) => (
              <div key={d.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{d.label}</span>
                <span style={{ fontSize: 13 }}>{d.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="ap-card">
        <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)' }}><h2 style={{ fontSize: 14, fontWeight: 800 }}>I miei condomini attivi</h2></header>
        <table className="ap-table">
          <thead><tr><th>POD/PDR</th><th>Cliente</th><th style={{ textAlign: 'right' }}>Compenso</th></tr></thead>
          <tbody>
            {activePods.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessun condominio attivo.</td></tr>}
            {activePods.map((p) => (
              <tr key={p.contactId}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.pod}</td>
                <td>{p.cliente ?? '—'}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtEur(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {switchedPods.length > 0 && (
        <section className="ap-card">
          <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)' }}><h2 style={{ fontSize: 14, fontWeight: 800 }}>Switch-out · esclusi dal calcolo</h2></header>
          <table className="ap-table">
            <thead><tr><th>POD/PDR</th><th>Cliente</th></tr></thead>
            <tbody>
              {switchedPods.map((p) => (
                <tr key={p.contactId}><td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.pod}</td><td>{p.cliente ?? '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(payments ?? []).length > 0 && (
        <section className="ap-card">
          <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)' }}><h2 style={{ fontSize: 14, fontWeight: 800 }}>Pagamenti ricevuti</h2></header>
          <table className="ap-table">
            <thead><tr><th>Periodo</th><th style={{ textAlign: 'right' }}>Importo</th><th>Quando</th></tr></thead>
            <tbody>
              {(payments ?? []).map((p) => (
                <tr key={p.period}>
                  <td style={{ fontWeight: 600 }}>{p.period}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(p.amount_cents / 100)}</td>
                  <td>{new Date(p.paid_at).toLocaleDateString('it-IT')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
