import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listAdminsWithStats } from '@/lib/apulia/queries'
import { createAdminClient } from '@/lib/supabase-server'
import { currentPeriod } from '@/lib/apulia/fields'

export const dynamic = 'force-dynamic'

function fmtEur(n: number): string { return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) }

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  const period = currentPeriod()
  const admins = await listAdminsWithStats()

  const sb = createAdminClient()
  const { data: payments } = await sb.from('apulia_payments')
    .select('contact_id, period, amount_cents, paid_at, paid_by')
    .order('paid_at', { ascending: false })

  // Group by period
  const periods = [...new Set([(period), ...(payments ?? []).map((p) => p.period)])].sort().reverse()
  const adminById = new Map(admins.map((a) => [a.contactId, a]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 className="ap-page-title">Pagamenti</h1>
        <p className="ap-page-subtitle">Storico pagamenti per periodo. Il periodo corrente è <strong>{period}</strong>.</p>
      </header>

      {periods.map((per) => {
        const periodPayments = (payments ?? []).filter((p) => p.period === per)
        const paidIds = new Set(periodPayments.map((p) => p.contact_id))
        const isCurrent = per === period
        const due = isCurrent ? admins.filter((a) => !paidIds.has(a.contactId)) : []
        const totalPaid = periodPayments.reduce((s, p) => s + p.amount_cents, 0) / 100
        const totalDue = due.reduce((s, a) => s + a.total, 0)
        return (
          <section key={per} className="ap-card">
            <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800 }}>
                Periodo {per}
                {isCurrent && <span className="ap-pill" data-tone="blue" style={{ marginLeft: 10, fontSize: 10 }}>corrente</span>}
              </h2>
              <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <span>Pagati: <strong>{fmtEur(totalPaid)}</strong></span>
                {isCurrent && <span>In sospeso: <strong style={{ color: 'var(--ap-warning)' }}>{fmtEur(totalDue)}</strong></span>}
              </div>
            </header>
            <table className="ap-table">
              <thead>
                <tr><th>Amministratore</th><th style={{ textAlign: 'right' }}>Importo</th><th>Quando</th><th>Da</th><th>Stato</th></tr>
              </thead>
              <tbody>
                {periodPayments.length === 0 && !due.length && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessun movimento.</td></tr>}
                {periodPayments.map((p) => {
                  const a = adminById.get(p.contact_id)
                  return (
                    <tr key={p.contact_id + p.period}>
                      <td>{a?.name ?? p.contact_id}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(p.amount_cents / 100)}</td>
                      <td>{new Date(p.paid_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td style={{ color: 'var(--ap-text-muted)', fontSize: 12 }}>{p.paid_by ?? '—'}</td>
                      <td><span className="ap-pill" data-tone="green">✓ Pagato</span></td>
                    </tr>
                  )
                })}
                {isCurrent && due.map((a) => (
                  <tr key={a.contactId}>
                    <td>{a.name}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(a.total)}</td>
                    <td>—</td>
                    <td>—</td>
                    <td><span className="ap-pill" data-tone="amber">Da pagare</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
    </div>
  )
}
