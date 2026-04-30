import Link from 'next/link'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listAdminsWithStats, loadSnapshot } from '@/lib/apulia/queries'
import { currentPeriod } from '@/lib/apulia/fields'
import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

export default async function Page() {
  const session = await getApuliaSession()

  if (session.role === 'amministratore') return <AdminView codice={session.codiceAmministratore} contactId={session.contactId} />

  // Owner view
  const [snap, admins] = await Promise.all([loadSnapshot(), listAdminsWithStats()])
  const totalDue = admins.filter((a) => !a.paidThisPeriod).reduce((s, a) => s + a.total, 0)
  const totalPaid = admins.filter((a) => a.paidThisPeriod).reduce((s, a) => s + a.total, 0)
  const period = currentPeriod()

  // Recent imports + leads-per-store
  const sb = createAdminClient()
  const startOfMonth = new Date()
  startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
  const [{ data: recent }, { data: leadsByStore }] = await Promise.all([
    sb.from('apulia_imports').select('id, kind, filename, rows_total, created_at').order('created_at', { ascending: false }).limit(5),
    sb.rpc('apulia_lead_counts_per_store', { since_iso: startOfMonth.toISOString() }) as unknown as Promise<{ data: { slug: string; month_count: number; total_count: number }[] | null }>,
  ])
  const stores = await import('@/lib/apulia/stores').then((m) => m.listStores())
  const leadsMap = new Map((leadsByStore ?? []).map((r) => [r.slug, r]))
  const totalLeadsMonth = (leadsByStore ?? []).reduce((s, r) => s + (r.month_count || 0), 0)

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
          <div className="ap-stat-label">Lead questo mese</div>
          <div className="ap-stat-value">{totalLeadsMonth.toLocaleString('it-IT')}</div>
          <div className="ap-stat-foot">da QR / form pubblici</div>
        </div>
        <div className="ap-stat">
          <div className="ap-stat-label">Da pagare {period}</div>
          <div className="ap-stat-value">{fmtEur(totalDue)}</div>
          <div className="ap-stat-foot">{admins.filter((a) => !a.paidThisPeriod).length} amministratori in sospeso</div>
        </div>
        <div className="ap-stat" data-tone="good">
          <div className="ap-stat-label">Già pagato {period}</div>
          <div className="ap-stat-value">{fmtEur(totalPaid)}</div>
          <div className="ap-stat-foot">{admins.filter((a) => a.paidThisPeriod).length} amministratori liquidati</div>
        </div>
      </div>

      <section className="ap-card">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--ap-line)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 800 }}>Lead per store</h2>
          <Link href="/designs/apulia-power/stores" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-blue)', textDecoration: 'none' }}>Gestisci →</Link>
        </header>
        <table className="ap-table">
          <thead><tr><th>Store</th><th style={{ textAlign: 'right' }}>Mese corrente</th><th style={{ textAlign: 'right' }}>Totale</th></tr></thead>
          <tbody>
            {stores.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessuno store configurato.</td></tr>}
            {stores.map((s) => {
              const r = leadsMap.get(s.slug) as { month_count?: number; total_count?: number } | undefined
              return (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong>{s.city && <span style={{ color: 'var(--ap-text-muted)', fontSize: 11, marginLeft: 6 }}>{s.city}</span>}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{(r?.month_count ?? 0)}</td>
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
  const { data: payments } = await sb.from('apulia_payments').select('period, amount_cents, paid_at').eq('contact_id', contactId).order('paid_at', { ascending: false }).limit(6)

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
