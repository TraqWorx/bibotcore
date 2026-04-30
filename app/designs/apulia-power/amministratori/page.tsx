import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listAdminsWithStats } from '@/lib/apulia/queries'
import { currentPeriod } from '@/lib/apulia/fields'

export const dynamic = 'force-dynamic'

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  const admins = await listAdminsWithStats()
  const totalDue = admins.filter((a) => !a.paidThisPeriod).reduce((s, a) => s + a.total, 0)
  const totalPaid = admins.filter((a) => a.paidThisPeriod).reduce((s, a) => s + a.total, 0)
  const period = currentPeriod()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="ap-page-title">Amministratori</h1>
          <p className="ap-page-subtitle">
            {admins.length} amministratori. Periodo corrente: <strong>{period}</strong>. Clic sul nome per dettaglio condomini, override e pagamento.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="ap-stat" data-tone="warn" style={{ minWidth: 180 }}>
            <div className="ap-stat-label">Da pagare</div>
            <div className="ap-stat-value">{fmtEur(totalDue)}</div>
          </div>
          <div className="ap-stat" data-tone="good" style={{ minWidth: 180 }}>
            <div className="ap-stat-label">Già pagato</div>
            <div className="ap-stat-value">{fmtEur(totalPaid)}</div>
          </div>
        </div>
      </header>

      <section className="ap-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="ap-table">
            <thead>
              <tr>
                <th>Amministratore</th>
                <th>Cod. Amm.</th>
                <th style={{ textAlign: 'right' }}>Compenso/POD</th>
                <th style={{ textAlign: 'right' }}>POD attivi</th>
                <th style={{ textAlign: 'right' }}>Switch-out</th>
                <th style={{ textAlign: 'right' }}>Da pagare</th>
                <th>Stato {period}</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--ap-text-faint)' }}>Nessun amministratore.</td></tr>}
              {admins.map((a) => (
                <tr key={a.contactId}>
                  <td>
                    <Link href={`/designs/apulia-power/amministratori/${a.contactId}`} style={{ textDecoration: 'none', color: 'var(--ap-text)', fontWeight: 600 }}>
                      {a.name}
                    </Link>
                    {a.email && <div style={{ fontSize: 11, color: 'var(--ap-text-faint)', marginTop: 2 }}>{a.email}</div>}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--ap-text-muted)' }}>{a.codiceAmministratore ?? '—'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(a.compensoPerPod)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.podsActive}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: a.podsSwitchedOut ? 'var(--ap-warning)' : 'var(--ap-text-faint)' }}>{a.podsSwitchedOut}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtEur(a.total)}</td>
                  <td>
                    {a.paidThisPeriod
                      ? <span className="ap-pill" data-tone="green">✓ Pagato {a.paidAt ? new Date(a.paidAt).toLocaleDateString('it-IT') : ''}</span>
                      : <span className="ap-pill" data-tone="amber">Da pagare</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
