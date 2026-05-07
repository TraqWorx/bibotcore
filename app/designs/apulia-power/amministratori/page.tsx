import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listAdminsWithStats } from '@/lib/apulia/queries'
import { currentPeriod } from '@/lib/apulia/fields'
import AdminsTable from './_components/AdminsTable'
import AddAdminPanel from './_components/AddAdminPanel'
import { ResyncButton } from '../settings/_components/SettingsForms'
import StaleSyncTrigger from '../_components/StaleSyncTrigger'
import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function fmtEur(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  const sb = createAdminClient()
  // Scope "Pagato questo mese" to the current calendar month — each POD
  // has its own 6-month cycle anchored to when it was added, so semester
  // buckets are meaningless across admins. The calendar month is a
  // simple "what cash went out this month" indicator. /pagamenti shows
  // the full history.
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const fetchPaidThisMonth = async (): Promise<number> => {
    let total = 0
    for (let from = 0; ; from += 1000) {
      const { data } = await sb
        .from('apulia_payments')
        .select('amount_cents')
        .gte('paid_at', monthStart.toISOString())
        .range(from, from + 999)
      if (!data || data.length === 0) break
      for (const r of data as Array<{ amount_cents: number }>) total += Number(r.amount_cents) || 0
      if (data.length < 1000) break
    }
    return total / 100
  }
  const [admins, { data: latestCache }, paidThisMonthTotal] = await Promise.all([
    listAdminsWithStats(),
    sb.from('apulia_contacts').select('cached_at').order('cached_at', { ascending: false }).limit(1).maybeSingle(),
    fetchPaidThisMonth(),
  ])
  const cacheAgeMinutes = latestCache?.cached_at
    ? (Date.now() - new Date(latestCache.cached_at).getTime()) / 60000
    : Number.POSITIVE_INFINITY
  const totalDue = admins.reduce((s, a) => s + a.total, 0)
  const dueNowCount = admins.filter((a) => a.isDueNow).length
  const monthLabel = monthStart.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="ap-page-title">Amministratori</h1>
          <p className="ap-page-subtitle">
            {admins.length} amministratori · {dueNowCount > 0 ? <strong style={{ color: 'var(--ap-danger)' }}>{dueNowCount} da pagare oggi</strong> : 'Nessun pagamento dovuto oggi'}. Ogni amministratore ha un proprio ciclo di 6 mesi.
          </p>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <AddAdminPanel />
            <ResyncButton />
            <StaleSyncTrigger ageMinutes={cacheAgeMinutes} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="ap-stat" data-tone="warn" style={{ minWidth: 180 }}>
            <div className="ap-stat-label">Da pagare</div>
            <div className="ap-stat-value">{fmtEur(totalDue)}</div>
          </div>
          <div className="ap-stat" data-tone="good" style={{ minWidth: 180 }}>
            <div className="ap-stat-label">Pagato {monthLabel}</div>
            <div className="ap-stat-value">{fmtEur(paidThisMonthTotal)}</div>
            <div className="ap-stat-foot">
              <Link href="/designs/apulia-power/pagamenti" style={{ color: 'var(--ap-blue)', textDecoration: 'none', fontWeight: 700 }}>
                Storico completo →
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="ap-card">
        <AdminsTable admins={admins} period={currentPeriod()} />
      </section>
    </div>
  )
}
