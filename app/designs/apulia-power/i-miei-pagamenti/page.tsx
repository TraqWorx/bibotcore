import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { adminWithPods } from '@/lib/apulia/queries'
import { currentPeriod } from '@/lib/apulia/fields'
import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function fmtEur(n: number): string { return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) }

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role === 'owner') redirect('/designs/apulia-power/pagamenti')
  if (!session.contactId) return <div className="ap-card ap-card-pad">Profilo non collegato.</div>

  const { admin } = await adminWithPods(session.contactId)
  if (!admin) return <div className="ap-card ap-card-pad">Profilo non trovato.</div>

  const sb = createAdminClient()
  const { data: payments } = await sb
    .from('apulia_payments')
    .select('period, amount_cents, paid_at')
    .eq('contact_id', session.contactId)
    .order('paid_at', { ascending: false })

  const period = currentPeriod()
  const paid = (payments ?? []).find((p) => p.period === period)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 className="ap-page-title">I miei pagamenti</h1>
        <p className="ap-page-subtitle">Periodo corrente: <strong>{period}</strong>. {admin.podsActive} POD attivi · compenso per POD <strong>{fmtEur(admin.compensoPerPod)}</strong>.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div className="ap-stat" data-tone={paid ? 'good' : 'warn'}>
          <div className="ap-stat-label">Da ricevere {period}</div>
          <div className="ap-stat-value">{fmtEur(admin.total)}</div>
          <div className="ap-stat-foot">{paid ? `Ricevuto il ${new Date(paid.paid_at).toLocaleDateString('it-IT')}` : 'In attesa'}</div>
        </div>
        <div className="ap-stat" data-tone="accent">
          <div className="ap-stat-label">Totale ricevuto storico</div>
          <div className="ap-stat-value">{fmtEur((payments ?? []).reduce((s, p) => s + p.amount_cents, 0) / 100)}</div>
          <div className="ap-stat-foot">{(payments ?? []).length} pagamenti</div>
        </div>
      </div>

      <section className="ap-card">
        <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)' }}><h2 style={{ fontSize: 14, fontWeight: 800 }}>Storico</h2></header>
        <table className="ap-table">
          <thead><tr><th>Periodo</th><th style={{ textAlign: 'right' }}>Importo</th><th>Quando</th><th>Stato</th></tr></thead>
          <tbody>
            {(payments ?? []).length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessun pagamento ancora ricevuto.</td></tr>}
            {(payments ?? []).map((p) => (
              <tr key={p.period}>
                <td style={{ fontWeight: 600 }}>{p.period}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(p.amount_cents / 100)}</td>
                <td>{new Date(p.paid_at).toLocaleDateString('it-IT')}</td>
                <td><span className="ap-pill" data-tone="green">✓ Ricevuto</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
