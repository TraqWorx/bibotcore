import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { APULIA_LOCATION_ID, APULIA_FIELD, currentPeriod } from '@/lib/apulia/fields'
import { createAdminClient } from '@/lib/supabase-server'
import { PayoutScheduleForm, ResyncButton } from './_components/SettingsForms'

export const dynamic = 'force-dynamic'

interface PayoutSchedule { H1: string; H2: string }

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  const sb = createAdminClient()
  const { data: scheduleRow } = await sb.from('apulia_settings').select('value').eq('key', 'payout_schedule').maybeSingle()
  const schedule = (scheduleRow?.value as PayoutSchedule | undefined) ?? { H1: '01-01', H2: '07-01' }
  const { count: cacheCount } = await sb.from('apulia_contacts').select('id', { count: 'exact', head: true })
  const { data: lastSync } = await sb.from('apulia_contacts').select('cached_at').order('cached_at', { ascending: false }).limit(1).maybeSingle()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
      <header>
        <h1 className="ap-page-title">Impostazioni</h1>
        <p className="ap-page-subtitle">Periodo corrente: <strong>{currentPeriod()}</strong>.</p>
      </header>

      <section className="ap-card ap-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800 }}>Date di pagamento</h2>
        <PayoutScheduleForm initial={schedule} />
      </section>

      <section className="ap-card ap-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800 }}>Cache contatti</h2>
        <p style={{ fontSize: 13, color: 'var(--ap-text-muted)', margin: 0 }}>
          {(cacheCount ?? 0).toLocaleString('it-IT')} contatti in cache. Ultimo aggiornamento:{' '}
          <strong>{lastSync?.cached_at ? new Date(lastSync.cached_at).toLocaleString('it-IT') : 'mai'}</strong>.
        </p>
        <p style={{ fontSize: 12, color: 'var(--ap-text-faint)', margin: 0 }}>
          La cache si aggiorna automaticamente dopo ogni import e ogni modifica di override. Usa il pulsante per
          forzare una risincronizzazione completa da Bibot (utile se qualcuno modifica un contatto direttamente in Bibot).
        </p>
        <ResyncButton />
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
