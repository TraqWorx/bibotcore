import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { createAdminClient } from '@/lib/supabase-server'
import { listApuliaWorkflows } from '@/lib/apulia/workflows'
import { computeNextDue, getDefaultPaymentOffset } from '@/lib/apulia/payment-cycle'
import PodPaymentSchedule, { type PodScheduleEntry } from './_components/PodPaymentSchedule'
import SwitchOutSchedule, { type SwitchOutEntry } from './_components/SwitchOutSchedule'
import CompensiTable, { type CompensoEntry } from './_components/CompensiTable'
import SettingsTabs from './_components/SettingsTabs'
import SyncImportHistory from './_components/SyncImportHistory'
import SyncQueuePanel from './_components/SyncQueuePanel'
import TagManager from './_components/TagManager'
import WorkflowsPanel from './_components/WorkflowsPanel'
import { getSyncQueueStats, listSyncImports } from './_actions'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  const sb = createAdminClient()

  // Active PODs + admins + per-POD payment counts. Paginate everywhere
  // because PostgREST caps a single select at 1000 rows.
  type PodLite = {
    id: string
    pod_pdr: string | null
    first_name: string | null
    last_name: string | null
    cliente: string | null
    codice_amministratore: string | null
    amministratore_name: string | null
    pod_override: number | null
    cached_at: string
    first_payment_at: string | null
  }
  const fetchActivePods = async (): Promise<PodLite[]> => {
    const out: PodLite[] = []
    for (let from = 0; ; from += 1000) {
      const { data } = await sb.from('apulia_contacts')
        .select('id, pod_pdr, first_name, last_name, cliente, codice_amministratore, amministratore_name, pod_override, cached_at, first_payment_at')
        .eq('is_amministratore', false).eq('is_switch_out', false).neq('sync_status', 'pending_delete')
        .order('pod_pdr', { nullsFirst: false })
        .range(from, from + 999)
      if (!data || data.length === 0) break
      out.push(...(data as PodLite[]))
      if (data.length < 1000) break
    }
    return out
  }
  const fetchPodPaymentCounts = async (): Promise<Map<string, number>> => {
    const map = new Map<string, number>()
    const { data } = await sb.rpc('apulia_pod_payment_stats')
    for (const r of (data ?? []) as Array<{ pod_contact_id: string; paid_count: number }>) map.set(r.pod_contact_id, Number(r.paid_count))
    return map
  }

  type SwitchedPodLite = {
    id: string
    pod_pdr: string | null
    first_name: string | null
    last_name: string | null
    cliente: string | null
    codice_amministratore: string | null
    amministratore_name: string | null
    switched_out_at: string | null
  }
  const fetchSwitchedPods = async (): Promise<SwitchedPodLite[]> => {
    const out: SwitchedPodLite[] = []
    for (let from = 0; ; from += 1000) {
      const { data } = await sb.from('apulia_contacts')
        .select('id, pod_pdr, first_name, last_name, cliente, codice_amministratore, amministratore_name, switched_out_at')
        .eq('is_amministratore', false).eq('is_switch_out', true).neq('sync_status', 'pending_delete')
        .order('switched_out_at', { ascending: false, nullsFirst: false })
        .range(from, from + 999)
      if (!data || data.length === 0) break
      out.push(...(data as SwitchedPodLite[]))
      if (data.length < 1000) break
    }
    return out
  }

  const [
    { data: admins },
    { data: podCounts },
    activePods,
    podPaymentCounts,
    switchedPods,
  ] = await Promise.all([
    sb.from('apulia_contacts')
      .select('id, first_name, last_name, codice_amministratore, compenso_per_pod, commissione_totale, payment_offset_days')
      .eq('is_amministratore', true)
      .order('first_name'),
    sb.rpc('apulia_admin_pod_counts'),
    fetchActivePods(),
    fetchPodPaymentCounts(),
    fetchSwitchedPods(),
  ])

  const podCountMap = new Map(((podCounts ?? []) as Array<{ codice_amministratore: string; active: number }>).map((r) => [r.codice_amministratore, Number(r.active)]))
  const compensoByCode = new Map<string, number>()
  const offsetByCode = new Map<string, number | null>()
  const adminByCode = new Map<string, { id: string; name: string }>()
  for (const a of admins ?? []) {
    const name = [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Senza nome'
    if (a.codice_amministratore) {
      compensoByCode.set(a.codice_amministratore, Number(a.compenso_per_pod) || 0)
      offsetByCode.set(a.codice_amministratore, (a as { payment_offset_days?: number | null }).payment_offset_days ?? null)
      adminByCode.set(a.codice_amministratore, { id: a.id, name })
    }
  }
  const defaultOffset = await getDefaultPaymentOffset()

  const todayMs = Date.now()
  const podScheduleEntries: PodScheduleEntry[] = activePods.map((p) => {
    const paidCount = podPaymentCounts.get(p.id) ?? 0
    const anchorIso = p.first_payment_at ?? p.cached_at
    const offset = offsetByCode.get(p.codice_amministratore ?? '') ?? defaultOffset
    const nd = computeNextDue(anchorIso, offset, paidCount, p.cached_at)
    const nextDue: string | null = nd ? nd.toISOString() : null
    const isDueNow = nd ? nd.getTime() <= todayMs : false
    const override = Number(p.pod_override) || 0
    const compenso = compensoByCode.get(p.codice_amministratore ?? '') ?? 0
    const cliente = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.cliente || ''
    const adminRec = p.codice_amministratore ? adminByCode.get(p.codice_amministratore) : undefined
    return {
      contactId: p.id,
      pod: p.pod_pdr ?? '—',
      cliente,
      amministratore: adminRec?.name ?? p.amministratore_name ?? '',
      amministratoreId: adminRec?.id,
      firstPaymentAt: p.first_payment_at,
      nextDueDate: nextDue,
      paidCount,
      isDueNow,
      amount: override > 0 ? override : compenso,
    }
  })

  const compensiEntries: CompensoEntry[] = (admins ?? [])
    .map((a) => ({
      contactId: a.id,
      name: [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Senza nome',
      podsActive: podCountMap.get(a.codice_amministratore ?? '') ?? 0,
      compensoPerPod: Number(a.compenso_per_pod) || 0,
      total: Number(a.commissione_totale) || 0,
      paymentOffsetDays: (a as { payment_offset_days?: number | null }).payment_offset_days ?? null,
    }))
    .sort((a, b) => b.podsActive - a.podsActive)

  const switchOutEntries: SwitchOutEntry[] = switchedPods.map((p) => {
    const adminRec = p.codice_amministratore ? adminByCode.get(p.codice_amministratore) : undefined
    return {
      contactId: p.id,
      pod: p.pod_pdr ?? '—',
      cliente: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.cliente || '',
      amministratore: adminRec?.name ?? p.amministratore_name ?? '',
      amministratoreId: adminRec?.id,
      switchedOutAt: p.switched_out_at,
    }
  })

  const dueNowCount = podScheduleEntries.filter((p) => p.isDueNow).length
  const noCompensoCount = compensiEntries.filter((a) => a.compensoPerPod === 0).length
  const switchOutNoDateCount = switchOutEntries.filter((p) => !p.switchedOutAt).length

  const [queueStatsResult, syncImportsResult, workflowsResult] = await Promise.all([
    getSyncQueueStats(),
    listSyncImports(),
    listApuliaWorkflows().catch((e) => ({ error: e instanceof Error ? e.message : 'failed' })),
  ])
  const workflows = Array.isArray(workflowsResult) ? workflowsResult : []
  const workflowsError = !Array.isArray(workflowsResult) && 'error' in workflowsResult ? workflowsResult.error : null
  const queueStats = 'error' in queueStatsResult
    ? { pending: 0, inProgress: 0, failed: 0, completedLast24h: 0, oldestPendingMinutes: null }
    : queueStatsResult
  const syncImports = Array.isArray(syncImportsResult) ? syncImportsResult : []
  const queueBadge = queueStats.pending + queueStats.inProgress + queueStats.failed

  // Tag usage across the cache — one aggregate RPC (was a full-table scan).
  const { data: tagRows } = await sb.rpc('apulia_tag_counts')
  const tagUsage = ((tagRows ?? []) as Array<{ tag: string; cnt: number }>)
    .map((r) => ({ tag: r.tag, count: Number(r.cnt) }))
    .sort((a, b) => b.count - a.count)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
      <header>
        <h1 className="ap-page-title">Impostazioni</h1>
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
                  <h2 style={{ fontSize: 16, fontWeight: 800 }}>Date di pagamento per POD</h2>
                  <p style={{ fontSize: 12, color: 'var(--ap-text-muted)', marginTop: 4 }}>
                    Ogni POD ha un proprio ciclo di 6 mesi, ancorato alla data di inizio fornitura del file PDP.
                    Modificala manualmente se necessario; la prossima scadenza si aggiorna automaticamente (1° pagamento + N×6 mesi).
                  </p>
                </header>
                <div style={{ padding: '16px 20px' }}>
                  <PodPaymentSchedule pods={podScheduleEntries} />
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
                    in GHL Custom Dash e la commissione totale viene ricalcolata su tutti i POD attivi.
                  </p>
                </header>
                <div style={{ padding: '16px 20px' }}>
                  <CompensiTable admins={compensiEntries} defaultOffset={defaultOffset} />
                </div>
              </section>
            ),
          },
          {
            id: 'switchout',
            label: 'Switch-out',
            badge: switchOutNoDateCount > 0 ? switchOutNoDateCount : undefined,
            content: (
              <section className="ap-card">
                <header style={{ padding: '16px 20px', borderBottom: '1px solid var(--ap-line)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800 }}>Date di switch-out</h2>
                  <p style={{ fontSize: 12, color: 'var(--ap-text-muted)', marginTop: 4 }}>
                    Data reale di uscita dal contratto (Data esecuzione attività), impostata all&apos;import.
                    Correggila qui per singolo POD o in blocco selezionando più righe. Non incide sulle commissioni (già escluse dallo switch-out).
                  </p>
                </header>
                <div style={{ padding: '16px 20px' }}>
                  <SwitchOutSchedule pods={switchOutEntries} />
                </div>
              </section>
            ),
          },
          {
            id: 'sync',
            label: 'Coda sync',
            badge: queueBadge > 0 ? queueBadge : undefined,
            content: (
              <section className="ap-card">
                <header style={{ padding: '16px 20px', borderBottom: '1px solid var(--ap-line)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800 }}>Coda di sincronizzazione</h2>
                  <p style={{ fontSize: 12, color: 'var(--ap-text-muted)', marginTop: 4 }}>
                    Operazioni in attesa di essere sincronizzate. GHL Custom Dash è la fonte di verità;
                    le modifiche sono già applicate in locale e vengono propagate in background.
                  </p>
                </header>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <SyncQueuePanel initial={queueStats} />
                  <SyncImportHistory imports={syncImports} />
                </div>
              </section>
            ),
          },
          {
            id: 'tags',
            label: 'Tag',
            badge: tagUsage.length,
            content: (
              <section className="ap-card">
                <header style={{ padding: '16px 20px', borderBottom: '1px solid var(--ap-line)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800 }}>Gestione tag</h2>
                  <p style={{ fontSize: 12, color: 'var(--ap-text-muted)', marginTop: 4 }}>
                    Tutti i tag usati nei contatti Apulia (condomini + amministratori). Eliminandoli vengono rimossi anche da GHL Custom Dash.
                  </p>
                </header>
                <div style={{ padding: '16px 20px' }}>
                  <TagManager tags={tagUsage} />
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
            id: 'workflows',
            label: 'Automations',
            badge: workflows.filter((w) => (w.status ?? '').toLowerCase() === 'published').length || undefined,
            content: (
              <section className="ap-card">
                <header style={{ padding: '16px 20px', borderBottom: '1px solid var(--ap-line)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800 }}>Automations</h2>
                  <p style={{ fontSize: 12, color: 'var(--ap-text-muted)', marginTop: 4 }}>
                    Tutti i workflow configurati su Apulia. Solo lettura.
                  </p>
                </header>
                <div style={{ padding: '16px 20px' }}>
                  {workflowsError ? (
                    <div style={{ padding: 16, fontSize: 13, color: 'var(--ap-danger)' }}>
                      Errore caricamento workflow: {workflowsError}
                    </div>
                  ) : (
                    <WorkflowsPanel workflows={workflows} />
                  )}
                </div>
              </section>
            ),
          },
        ]}
      />
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
