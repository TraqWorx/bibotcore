import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listAdminsWithStats } from '@/lib/apulia/queries'
import { currentPeriod } from '@/lib/apulia/fields'
import AdminsTable from './_components/AdminsTable'
import AddAdminPanel from './_components/AddAdminPanel'

export const dynamic = 'force-dynamic'

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  const admins = await listAdminsWithStats()
  const totalDue = admins.filter((a) => a.isDueNow).reduce((s, a) => s + a.total, 0)
  const totalPaid = admins.filter((a) => a.paidThisPeriod).reduce((s, a) => s + a.total, 0)
  const dueNowCount = admins.filter((a) => a.isDueNow).length
  const period = currentPeriod()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="ap-page-title">Amministratori</h1>
          <p className="ap-page-subtitle">
            {admins.length} amministratori · {dueNowCount > 0 ? <strong style={{ color: 'var(--ap-danger)' }}>{dueNowCount} da pagare oggi</strong> : 'Nessun pagamento dovuto oggi'}. Ogni amministratore ha un proprio ciclo di 6 mesi.
          </p>
          <div style={{ marginTop: 12 }}><AddAdminPanel /></div>
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
        <AdminsTable admins={admins} period={period} />
      </section>
    </div>
  )
}
