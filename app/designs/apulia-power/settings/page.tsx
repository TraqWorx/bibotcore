import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { APULIA_LOCATION_ID, APULIA_FIELD, currentPeriod } from '@/lib/apulia/fields'
import { createAdminClient } from '@/lib/supabase-server'
import { ResyncButton } from './_components/SettingsForms'
import AdminPaymentSchedule, { type AdminScheduleEntry } from './_components/AdminPaymentSchedule'
import CompensiTable, { type CompensoEntry } from './_components/CompensiTable'
import SettingsTabs from './_components/SettingsTabs'

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
    sb.from('apulia_contacts')
      .select('id, first_name, last_name, codice_amministratore, first_payment_at, compenso_per_pod, commissione_totale')
      .eq('is_amministratore', true)
      .order('first_name'),
    sb.rpc('apulia_admin_schedule'),
    sb.rpc('apulia_admin_pod_counts'),
  ])

  type ScheduleRow = { contact_id: string; first_payment_at: string | null; paid_count: number; next_period_idx: number; next_due_date: string | null; is_due_now: boolean; overdue_count: number }
  const scheduleMap = new Map(((schedule ?? []) as ScheduleRow[]).map((s) => [s.contact_id, s]))
  const podCountMap = new Map(((podCounts ?? []) as Array<{ codice_amministratore: string; active: number }>).map((r) => [r.codice_amministratore, Number(r.active)]))

  const adminScheduleEntries: AdminScheduleEntry[] = (admins ?? []).map((a) => {
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

  const compensiEntries: CompensoEntry[] = (admins ?? [])
    .map((a) => ({
      contactId: a.id,
      name: [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Senza nome',
      podsActive: podCountMap.get(a.codice_amministratore ?? '') ?? 0,
      compensoPerPod: Number(a.compenso_per_pod) || 0,
      total: Number(a.commissione_totale) || 0,
    }))
    .sort((a, b) => b.podsActive - a.podsActive)

  const dueNowCount = adminScheduleEntries.filter((a) => a.isDueNow).length
  const noCompensoCount = compensiEntries.filter((a) => a.compensoPerPod === 0).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
      <header>
        <h1 className="ap-page-title">Impostazioni</h1>
        <p className="ap-page-subtitle">Periodo corrente: <strong>{currentPeriod()}</strong>.</p>
      </header>

      <SettingsTabs
        tabs={[
          {
            id: 'schedule',
            label: 'Giorno di Pagamento',
            badge: dueNowCount > 0 ? dueNowCount : undefined,
            content: (
              <section className="ap-card">
                <header style={{ padding: '16px 20px', borderBottom: '1px solid var(--ap-line)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800 }}>Date di pagamento per amministratore</h2>
                  <p style={{ fontSize: 12, color: 'var(--ap-text-muted)', marginTop: 4 }}>
                    Ogni amministratore ha un proprio ciclo di 6 mesi. La prima data viene impostata automaticamente al primo upload PDP che lo include.
                    Modificala manualmente se necessario; la prossima scadenza si aggiorna automaticamente.
                  </p>
                </header>
                <div style={{ padding: '16px 20px' }}>
                  <AdminPaymentSchedule admins={adminScheduleEntries} />
                </div>
              </section>
            ),
          },
          {
            id: 'compensi',
            label: 'Compensi per POD',
            badge: noCompensoCount > 0 ? noCompensoCount : undefined,
            content: (
              <section className="ap-card">
                <header style={{ padding: '16px 20px', borderBottom: '1px solid var(--ap-line)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800 }}>Compenso per POD per amministratore</h2>
                  <p style={{ fontSize: 12, color: 'var(--ap-text-muted)', marginTop: 4 }}>
                    Modifica direttamente il compenso per POD di ciascun amministratore. La modifica viene scritta sul custom field
                    in Bibot e la commissione totale viene ricalcolata su tutti i POD attivi.
                  </p>
                </header>
                <div style={{ padding: '16px 20px' }}>
                  <CompensiTable admins={compensiEntries} />
                </div>
              </section>
            ),
          },
          {
            id: 'import',
            label: 'Formato file di import',
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--ap-text-faint)', margin: 0 }}>
                  Puoi caricare direttamente il file <strong>.xlsx</strong> esportato da Excel, oppure un CSV. Per i CSV, salva la colonna POD/PDR come <em>Testo</em> per evitare la conversione in notazione scientifica (es. <code>8.82601E+11</code>); l&apos;import xlsx preserva sempre la stringa originale.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
                  <ImportColumnsCard
                    title="Amministratori"
                    requiredCols={[
                      'Fornitura : Cliente : Amministratore condominio',
                      'Fornitura : Cliente : Codice amministratore',
                    ]}
                    optionalCols={[
                      'compenso per ciascun pod',
                      'Fornitura : Cliente : Amministratore condominio : Codice fiscale Amministratore',
                      'Fornitura : Cliente : Amministratore condominio : Partita IVA',
                      'Fornitura : Dati di fatturazione : Indirizzo',
                      'Fornitura : Dati di fatturazione : Indirizzo (Città)',
                      'Fornitura : Dati di fatturazione : Indirizzo (Stato/Provincia)',
                      'Fornitura : Cliente : Numero Telefono Amministratore',
                      'Fornitura : Dati di fatturazione : Email',
                    ]}
                    note="Match per Codice amministratore. I nuovi vengono creati con tag amministratore e 1° pagamento = oggi."
                  />
                  <ImportColumnsCard
                    title="PDP ATTIVI"
                    requiredCols={[
                      'POD/PDR',
                      'Cliente',
                      'Fornitura : Cliente : Codice amministratore',
                    ]}
                    optionalCols={[
                      'Commodity',
                      'Fornitura : Cliente : Record Type Testuale',
                      'Fornitura : Opportunità : Data firma contratto',
                      'Inizio fornitura',
                      'Data inizio validità nuova offerta',
                      'Fornitura : Cliente : Codice Identificativo Univoco',
                      'Fornitura : Cliente : Codice fiscale',
                      'Referente commerciale',
                      'Fornitura : Cliente : Amministratore condominio',
                      'Fornitura : Cliente : Amministratore condominio : Codice fiscale Amministratore',
                      'Fornitura : Cliente : Amministratore condominio : Partita IVA',
                      'Fornitura : Dati di fatturazione : Indirizzo',
                      'Fornitura : Dati di fatturazione : Indirizzo (Città)',
                      'Fornitura : Dati di fatturazione : Indirizzo (Stato/Provincia)',
                      'DDF modalità invio fatt',
                      'Fornitura : Cliente : Numero Telefono Amministratore',
                      'Fornitura : Dati di fatturazione : Email',
                      'Fornitura : Dati di fatturazione : Codice sdi',
                      'Modalità di pagamento',
                      'Fornitura : Modalita di pagamento : Codice fiscale titolare Conto Corrente',
                      'Fornitura : Modalita di pagamento : IBAN',
                      'Contratto commerciale',
                      'Periodicità di Fatturazione',
                      'Consumo annuo (smc)',
                      'Consumo annuo (kWh)',
                      'Codice sconto',
                      'Consorzio',
                      'Fornitura : Consorzio : Codice consorzio',
                      'Fornitura : Consorzio : ID Consorzio',
                      'Analisi acque',
                      'Data inizio validità offerta',
                      'Data fine validità offerta',
                      'Stato',
                      'Fornitura : Opportunità : Tipo di record Opportunità',
                      'Fornitura : Opportunità : ID opportunità',
                      'Fornitura : Cliente : ID clienti',
                      'ID forniture',
                      'Fornitura : Dati di fatturazione : Indirizzo (CAP)',
                      'Matricola contatore',
                      'Potenza impegnata',
                      'IVA',
                      'Tensione',
                      'Valore tensione',
                      'Tipo tensione',
                      'Fornitura : Cliente : Numero di cellulare',
                      'Fornitura : Cliente : Numero di telefono',
                      'Fornitura : Opportunità : Promo Privacy',
                      'Opportunità',
                    ]}
                    note="Match per POD/PDR. I nuovi POD vengono creati e collegati all'amministratore tramite Codice amministratore."
                  />
                  <ImportColumnsCard
                    title="Switch-out"
                    requiredCols={['Pod Pdr']}
                    optionalCols={[
                      'Fornitura: Commodity',
                      'Target cliente',
                      'Fornitura: Indirizzo e comune',
                      'Numero ordine',
                      'Servizio',
                      'Descrizione',
                      'Data esecuzione attività',
                      'Data creazione',
                      'Cognome / Ragione sociale: Cognome / Ragione sociale',
                      'Fornitura: Amministratore',
                      'Fornitura: Consumo annuo (kWh)',
                      'Fornitura: Consumo annuo (smc)',
                      'Fornitura: Stato',
                    ]}
                    note="Match per Pod Pdr. I POD trovati vengono marcati come switch-out e usciti dal calcolo commissione."
                  />
                </div>
              </div>
            ),
          },
          {
            id: 'cache',
            label: 'Cache contatti',
            content: (
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
            ),
          },
          {
            id: 'tech',
            label: 'Riferimenti tecnici',
            content: (
              <section className="ap-card ap-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h2 style={{ fontSize: 14, fontWeight: 800 }}>Riferimenti tecnici</h2>
                <KV k="Location ID" v={APULIA_LOCATION_ID} />
                <KV k="Commissione Totale" v={APULIA_FIELD.COMMISSIONE_TOTALE} />
                <KV k="POD Override" v={APULIA_FIELD.POD_OVERRIDE} />
                <KV k="Compenso per POD" v={APULIA_FIELD.COMPENSO_PER_POD} />
                <KV k="Codice Amministratore" v={APULIA_FIELD.CODICE_AMMINISTRATORE} />
              </section>
            ),
          },
        ]}
      />
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

function ImportColumnsCard({
  title,
  requiredCols,
  optionalCols,
  note,
}: {
  title: string
  requiredCols: string[]
  optionalCols: string[]
  note?: string
}) {
  return (
    <section className="ap-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--ap-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 11, color: 'var(--ap-text-faint)', fontVariantNumeric: 'tabular-nums' }}>
          {requiredCols.length + optionalCols.length} colonne
        </span>
      </header>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Obbligatorie
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {requiredCols.map((c) => (
              <li key={c} style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--ap-text)', wordBreak: 'break-word', padding: '3px 8px', background: 'var(--ap-bg-muted, #fff7ed)', border: '1px solid var(--ap-warning, #fbbf24)', borderRadius: 6 }}>
                {c}
              </li>
            ))}
          </ul>
        </div>
        {optionalCols.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Opzionali
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {optionalCols.map((c) => (
                <li key={c} style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--ap-text-muted)', wordBreak: 'break-word', padding: '2px 0' }}>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
        {note && (
          <p style={{ fontSize: 11, color: 'var(--ap-text-faint)', margin: 0, lineHeight: 1.5 }}>{note}</p>
        )}
      </div>
    </section>
  )
}
