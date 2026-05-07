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
  // Cumulative "Già pagato" reads directly from apulia_payments. Paginate
  // so we don't hit the PostgREST 1000-row cap once history grows.
  const fetchPaidTotal = async (): Promise<number> => {
    let total = 0
    for (let from = 0; ; from += 1000) {
      const { data } = await sb.from('apulia_payments').select('amount_cents').range(from, from + 999)
      if (!data || data.length === 0) break
      for (const r of data) total += Number((r as { amount_cents: number }).amount_cents) || 0
      if (data.length < 1000) break
    }
    return total / 100
  }
  const [admins, { data: latestCache }, totalPaidAllTime] = await Promise.all([
    listAdminsWithStats(),
    sb.from('apulia_contacts').select('cached_at').order('cached_at', { ascending: false }).limit(1).maybeSingle(),
    fetchPaidTotal(),
  ])
  const cacheAgeMinutes = latestCache?.cached_at
    ? (Date.now() - new Date(latestCache.cached_at).getTime()) / 60000
    : Number.POSITIVE_INFINITY
  // "Da pagare" = somma dei POD attualmente da pagare (scaduti).
  // "Già pagato" = totale cumulativo di tutto ciò che è stato registrato
  // come pagamento (cresce nel tempo).
  const totalDue = admins.reduce((s, a) => s + a.total, 0)
  const totalPaid = totalPaidAllTime
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
            <div className="ap-stat-label">Già pagato</div>
            <div className="ap-stat-value">{fmtEur(totalPaid)}</div>
            <div className="ap-stat-foot">cumulativo · tutti i pagamenti registrati</div>
          </div>
        </div>
      </header>

      <section className="ap-card">
        <AdminsTable admins={admins} period={period} />
      </section>
    </div>
  )
}
