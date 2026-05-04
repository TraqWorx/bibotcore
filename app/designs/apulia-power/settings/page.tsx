import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { APULIA_LOCATION_ID, APULIA_FIELD, currentPeriod } from '@/lib/apulia/fields'
import { createAdminClient } from '@/lib/supabase-server'
import { ResyncButton } from './_components/SettingsForms'
import AdminPaymentSchedule, { type AdminScheduleEntry } from './_components/AdminPaymentSchedule'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  const sb = createAdminClient()

  const [
    { count: cacheCount },
    { data: lastSync },
    { data: admins },
    { data: schedule },
    { data: podCounts },
  ] = await Promise.all([
    sb.from('apulia_contacts').select('id', { count: 'exact', head: true }),
    sb.from('apulia_contacts').select('cached_at').order('cached_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('apulia_contacts').select('id, first_name, last_name, codice_amministratore, first_payment_at').eq('is_amministratore', true).order('first_name'),
    sb.rpc('apulia_admin_schedule'),
    sb.rpc('apulia_admin_pod_counts'),
  ])

  type ScheduleRow = { contact_id: string; first_payment_at: string | null; paid_count: number; next_period_idx: number; next_due_date: string | null; is_due_now: boolean; overdue_count: number }
  const scheduleMap = new Map(((schedule ?? []) as ScheduleRow[]).map((s) => [s.contact_id, s]))
  const podCountMap = new Map(((podCounts ?? []) as Array<{ codice_amministratore: string; active: number }>).map((r) => [r.codice_amministratore, Number(r.active)]))

  const adminEntries: AdminScheduleEntry[] = (admins ?? []).map((a) => {
    const sched = scheduleMap.get(a.id)
    return {
      contactId: a.id,
      name: [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Senza nome',
      podsActive: podCountMap.get(a.codice_amministratore ?? '') ?? 0,
      firstPaymentAt: a.first_payment_at,
      nextDueDate: sched?.next_due_date ?? null,
      paidCount: sched?.paid_count ?? 0,
      isDueNow: sched?.is_due_now ?? false,
      overdueCount: sched?.overdue_count ?? 0,
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1080 }}>
      <header>
        <h1 className="ap-page-title">Impostazioni</h1>
        <p className="ap-page-subtitle">Periodo corrente: <strong>{currentPeriod()}</strong>. Configura le date di pagamento per ogni amministratore.</p>
      </header>

      <section className="ap-card">
        <header style={{ padding: '16px 20px', borderBottom: '1px solid var(--ap-line)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>Giorno di Pagamento</h2>
          <p style={{ fontSize: 12, color: 'var(--ap-text-muted)', marginTop: 4 }}>
            Ogni amministratore ha un proprio ciclo di 6 mesi. La prima data viene impostata automaticamente al primo upload PDP che lo include.
            Modificala manualmente se necessario; la prossima scadenza si aggiorna automaticamente.
          </p>
        </header>
        <div style={{ padding: '16px 20px' }}>
          <AdminPaymentSchedule admins={adminEntries} />
        </div>
      </section>

      <section className="ap-card ap-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800 }}>Cache contatti</h2>
        <p style={{ fontSize: 13, color: 'var(--ap-text-muted)', margin: 0 }}>
          {(cacheCount ?? 0).toLocaleString('it-IT')} contatti in cache. Ultimo aggiornamento:{' '}
          <strong>{lastSync?.cached_at ? new Date(lastSync.cached_at).toLocaleString('it-IT') : 'mai'}</strong>.
        </p>
        <p style={{ fontSize: 12, color: 'var(--ap-text-faint)', margin: 0 }}>
          La cache si aggiorna automaticamente dopo ogni import e ogni modifica. Usa il pulsante per
          forzare una risincronizzazione completa da Bibot.
        </p>
        <ResyncButton />
      </section>

      <section className="ap-card ap-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800 }}>Formato file di import</h2>
        <p style={{ fontSize: 13, color: 'var(--ap-text-muted)', margin: 0 }}>
          <strong>PDP ATTIVI</strong> richiede almeno: <code>POD/PDR</code>, <code>Cliente</code> (o <code>Full Name</code>), <code>Fornitura : Cliente : Codice amministratore</code>.
          Le altre colonne in italiano si auto-mappano sui custom field corrispondenti.
        </p>
        <p style={{ fontSize: 13, color: 'var(--ap-text-muted)', margin: 0 }}>
          <strong>Switch-out</strong> richiede almeno: <code>Pod Pdr</code> (o <code>POD/PDR</code>) per il match.
        </p>
        <p style={{ fontSize: 12, color: 'var(--ap-text-faint)', margin: 0 }}>
          Salva sempre il CSV con la colonna POD formattata come <em>Testo</em>: i numeri lunghi salvati come Numero diventano notazione scientifica (es. <code>8.82601E+11</code>) e perdono cifre.
        </p>
      </section>

      <section className="ap-card ap-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800 }}>Riferimenti tecnici</h2>
        <KV k="Location ID" v={APULIA_LOCATION_ID} />
        <KV k="Commissione Totale" v={APULIA_FIELD.COMMISSIONE_TOTALE} />
        <KV k="POD Override" v={APULIA_FIELD.POD_OVERRIDE} />
        <KV k="Compenso per POD" v={APULIA_FIELD.COMPENSO_PER_POD} />
        <KV k="Codice Amministratore" v={APULIA_FIELD.CODICE_AMMINISTRATORE} />
      </section>
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--ap-line)' }}>
      <span style={{ color: 'var(--ap-text-muted)' }}>{k}</span>
      <code style={{ fontSize: 12, color: 'var(--ap-text)' }}>{v}</code>
    </div>
  )
}
