import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { adminWithPods } from '@/lib/apulia/queries'
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
  // Resolve pod_contact_id → POD/PDR + cliente label so per-POD payments
  // are immediately readable in the storico table.
  const { data: rawPayments } = await sb
    .from('apulia_payments')
    .select('id, pod_contact_id, amount_cents, paid_at, note')
    .eq('contact_id', session.contactId)
    .order('paid_at', { ascending: false })
  const payments = (rawPayments ?? []) as Array<{ id: string; pod_contact_id: string | null; amount_cents: number; paid_at: string; note: string | null }>

  const podIds = Array.from(new Set(payments.map((p) => p.pod_contact_id).filter((x): x is string => !!x)))
  const podLabel = new Map<string, string>()
  if (podIds.length > 0) {
    const { data } = await sb.from('apulia_contacts').select('id, pod_pdr, first_name, last_name').in('id', podIds)
    for (const r of (data ?? []) as Array<{ id: string; pod_pdr: string | null; first_name: string | null; last_name: string | null }>) {
      const cliente = [r.first_name, r.last_name].filter(Boolean).join(' ')
      podLabel.set(r.id, [r.pod_pdr, cliente].filter(Boolean).join(' · ') || r.pod_pdr || cliente || r.id)
    }
  }

  const totalReceived = payments.reduce((s, p) => s + p.amount_cents, 0) / 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 className="ap-page-title">I miei pagamenti</h1>
        <p className="ap-page-subtitle">{admin.podsActive} POD attivi · compenso per POD <strong>{fmtEur(admin.compensoPerPod)}</strong>.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div className="ap-stat" data-tone={admin.isDueNow ? 'warn' : 'good'}>
          <div className="ap-stat-label">Da ricevere</div>
          <div className="ap-stat-value">{fmtEur(admin.total)}</div>
          <div className="ap-stat-foot">{admin.overdueCount && admin.overdueCount > 0 ? `${admin.overdueCount} POD da pagare` : 'Tutti i POD pagati'}</div>
        </div>
        <div className="ap-stat" data-tone="accent">
          <div className="ap-stat-label">Totale ricevuto</div>
          <div className="ap-stat-value">{fmtEur(totalReceived)}</div>
          <div className="ap-stat-foot">{payments.length} pagamenti totali</div>
        </div>
      </div>

      <section className="ap-card">
        <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)' }}><h2 style={{ fontSize: 14, fontWeight: 800 }}>Storico</h2></header>
        <table className="ap-table">
          <thead><tr><th>Quando</th><th>POD</th><th style={{ textAlign: 'right' }}>Importo</th><th>Stato</th></tr></thead>
          <tbody>
            {payments.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessun pagamento ancora ricevuto.</td></tr>}
            {payments.map((p) => {
              const lbl = p.pod_contact_id ? podLabel.get(p.pod_contact_id) : null
              return (
                <tr key={p.id}>
                  <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{new Date(p.paid_at).toLocaleDateString('it-IT')}</td>
                  <td style={{ fontFamily: p.pod_contact_id ? 'monospace' : undefined, fontSize: 12 }}>
                    {lbl ?? <span style={{ color: 'var(--ap-text-muted)', fontStyle: 'italic' }}>tutto l&apos;amministratore</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtEur(p.amount_cents / 100)}</td>
                  <td><span className="ap-pill" data-tone="green">✓ Ricevuto</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
