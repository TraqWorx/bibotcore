/* Public Scope-of-Work document for Apulia Power.
   Designed for screen + browser-print → PDF. */
import PrintButton from './_components/PrintButton'

export const dynamic = 'force-static'
export const metadata = { title: 'Scope of Work — Apulia Power · Bibot' }

export default function Page() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="sow">
        <header className="sow-header">
          <div className="sow-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bibot-logo.png" alt="Bibot" className="sow-logo" />
            <div>
              <div className="sow-brand-name">Bibot</div>
              <div className="sow-brand-tag">Soluzioni CRM personalizzate</div>
            </div>
          </div>
          <div className="sow-meta">
            <div><strong>Documento:</strong> Scope of Work</div>
            <div><strong>Cliente:</strong> Apulia Power</div>
            <div><strong>Versione:</strong> 1.0</div>
          </div>
        </header>

        <h1 className="sow-title">Dashboard Custom — Apulia Power</h1>
        <p className="sow-subtitle">
          Soluzione esterna per la gestione operativa della rete commerciale, costruita su misura
          per superare i limiti tecnici della piattaforma standard.
        </p>

        <Section n="1" title="Premessa">
          <p>
            Apulia Power gestisce una rete commerciale articolata in <strong>7 store fisici</strong>,
            oltre <strong>150 amministratori di condominio</strong> e migliaia di POD attivi. La
            piattaforma CRM standard (GoHighLevel) supporta i flussi base — contatti, pipeline,
            calendari — ma non risponde alle esigenze di calcolo automatico delle commissioni,
            visualizzazione aggregata per amministratore e gestione dei pagamenti semestrali.
          </p>
          <p>
            Bibot propone un&apos;applicazione esterna integrata che lavora sopra il CRM e fornisce
            un&apos;interfaccia operativa dedicata, rapida e completamente automatizzata.
          </p>
        </Section>

        <Section n="2" title="Limitazioni della piattaforma standard">
          <ul>
            <li>
              <strong>Calcolo commissioni cross-contatto.</strong> I workflow nativi non possono
              aggregare dati su più contatti: è impossibile contare i POD attivi per un dato
              amministratore e scrivere il totale sul suo profilo.
            </li>
            <li>
              <strong>Override per singolo POD.</strong> Non esiste un&apos;interfaccia tabellare per
              modificare il compenso di un singolo POD e veder ricalcolato in tempo reale il totale.
            </li>
            <li>
              <strong>Tracciamento pagamenti.</strong> Non esiste un registro nativo dei pagamenti
              semestrali con stato Pagato / Da pagare per amministratore, né un workflow di chiusura
              periodo.
            </li>
            <li>
              <strong>Cross-reference Switch-out.</strong> L&apos;upload settimanale del file
              Switch-out non si aggancia automaticamente ai contatti esistenti per esclusione dal
              calcolo commissione.
            </li>
            <li>
              <strong>Filtri avanzati.</strong> La vista contatti standard non permette filtri
              combinati su POD/PDR, amministratore, comune, stato, con ricerca testuale veloce.
            </li>
            <li>
              <strong>Custom field sui form QR.</strong> I form pubblici di acquisizione lead
              richiedono auto-tagging per store e propagazione immediata in dashboard, non gestito
              nativamente.
            </li>
            <li>
              <strong>Affidabilità.</strong> In caso di interruzione del servizio CRM, i dati non
              sono accessibili per l&apos;operatività interna.
            </li>
          </ul>
        </Section>

        <Section n="3" title="Soluzione proposta">
          <p>
            Una <strong>web app dedicata</strong>, ospitata su dominio Bibot, con accesso protetto
            magic-link per il titolare e per ogni amministratore di condominio. La dashboard riflette
            in tempo reale i dati del CRM e arricchisce la gestione con automazioni cross-contatto.
          </p>
          <p>
            <strong>Architettura.</strong> I contatti e i custom field vengono mantenuti in una cache
            locale Postgres per garantire prestazioni istantanee, filtri ricchi e continuità di
            servizio anche in caso di indisponibilità del CRM. Ogni modifica nel CRM viene propagata
            in tempo reale via webhook, con un job di riconciliazione completa ogni 6 ore come rete
            di sicurezza.
          </p>
        </Section>

        <Section n="4" title="Funzionalità incluse">
          <SubSection title="Dashboard del titolare">
            <ul>
              <li>KPI principali: condomini attivi, amministratori, switch-out, da pagare, lead ultimi 40 giorni.</li>
              <li>Top amministratori per commissione con stato di pagamento del periodo corrente.</li>
              <li>Tabella lead per store: nuovi nei 40 giorni e totale storico.</li>
              <li>Feed import recenti con esito.</li>
            </ul>
          </SubSection>

          <SubSection title="Gestione amministratori">
            <ul>
              <li>Lista completa con compenso/POD, conteggio POD attivi, switch-out, importo da pagare e stato pagamento.</li>
              <li>Selezione multipla con azione di pagamento massivo (Paga tutti) per chiudere il periodo in un click.</li>
              <li>Profilo dettagliato per ogni amministratore: anagrafica, codice fiscale, partita IVA, indirizzo di fatturazione, telefono, email.</li>
              <li>Lista condomini attivi con override per singolo POD modificabile inline e ricalcolo automatico del totale.</li>
              <li>Lista condomini switched-out (esclusi dal calcolo).</li>
              <li>Storico pagamenti per periodo (semestrali) con marca temporale e operatore.</li>
              <li>Pulsante &laquo;Segna come pagato&raquo; con conferma e annullamento.</li>
            </ul>
          </SubSection>

          <SubSection title="Condomini (POD)">
            <ul>
              <li>Lista paginata di tutti i POD con ricerca testuale veloce (POD/PDR, cliente, amministratore).</li>
              <li>Filtri combinabili: amministratore, comune, stato (attivi vs switch-out).</li>
              <li>Indicizzazione trigram per ricerche fuzzy istantanee.</li>
            </ul>
          </SubSection>

          <SubSection title="Switch-out">
            <ul>
              <li>Lista completa dei POD usciti con colonna amministratore.</li>
              <li>Filtri per amministratore e comune.</li>
              <li>Esclusione automatica dal calcolo commissione futuro.</li>
            </ul>
          </SubSection>

          <SubSection title="Import e automazioni">
            <ul>
              <li>Upload drag-and-drop file <em>PDP ATTIVI</em> (settimanale) e <em>Switch-out</em> (settimanale) in due aree separate.</li>
              <li>Barra di avanzamento real-time con conteggio righe processate.</li>
              <li>Logica idempotente: re-import sicuri (nessun duplicato), riattivazione automatica dei POD che ritornano tra i PDP attivi (rimozione del tag Switch-out).</li>
              <li>Ricalcolo commissioni amministratori automatico al termine di ogni import.</li>
              <li>Storico import con esito, file, righe, durata.</li>
            </ul>
          </SubSection>

          <SubSection title="Store fisici e lead capture">
            <ul>
              <li>Sezione Store Fisici con i 7 punti vendita (Bisceglie, Barletta, Casagiove, Caserta, Napoli Secondigliano, Torino, Messina).</li>
              <li>Per ogni store: <strong>QR code generato automaticamente</strong> da stampare su flyer e materiali POP.</li>
              <li>Form pubblico mobile-friendly su dominio Bibot, brandizzato Apulia Power, una pagina per store.</li>
              <li>Submit del form crea automaticamente il contatto nel CRM con tag <code>lead</code> e <code>store-{'{slug}'}</code>, abilitando i flussi di benvenuto già configurati lato CRM.</li>
              <li>Anti-bot honeypot integrato.</li>
              <li>Link diretti ai calendari di prenotazione per ogni store (booking widget Bibot esistente).</li>
              <li>Conteggio lead per store: ultimi 40 giorni e totale storico.</li>
            </ul>
          </SubSection>

          <SubSection title="Pagamenti">
            <ul>
              <li>Registro cross-amministratore raggruppato per periodo (H1 / H2).</li>
              <li>Per ogni periodo: pagati vs in sospeso, totale, dettaglio amministratore.</li>
              <li>Click su un nome amministratore apre la sua scheda con storico completo.</li>
            </ul>
          </SubSection>

          <SubSection title="Area amministratore (vista personale)">
            <ul>
              <li>Login magic-link sull&apos;email registrata nel CRM.</li>
              <li>Dashboard personale con: numero condomini attivi, switch-out, importo da ricevere nel periodo.</li>
              <li>Lista i miei condomini con compenso per ciascuno.</li>
              <li>Lista i miei switch-out (esclusi dal calcolo).</li>
              <li>Storico personale dei pagamenti ricevuti.</li>
              <li>Visibilità limitata ai propri dati (filtraggio automatico via Codice amministratore).</li>
            </ul>
          </SubSection>

          <SubSection title="Impostazioni operative">
            <ul>
              <li>Date di pagamento configurabili (default 01/01 e 01/07).</li>
              <li>Compenso per POD modificabile per amministratore.</li>
              <li>Sincronizzazione manuale dalla CRM in caso di edit diretto sul CRM.</li>
              <li>Riferimenti tecnici (custom field, location ID).</li>
            </ul>
          </SubSection>
        </Section>

        <Section n="5" title="Affidabilità e prestazioni">
          <ul>
            <li><strong>Cache locale</strong> di tutti i contatti: lettura istantanea, indipendente dal CRM.</li>
            <li><strong>Sincronizzazione bidirezionale</strong>: webhook real-time + cron full-sync ogni 6 ore.</li>
            <li><strong>Filtri DB-side</strong>: ricerche su migliaia di contatti in &lt;100ms.</li>
            <li><strong>Sicurezza</strong>: auth Supabase, ruoli distinti (titolare vs amministratore), RLS abilitata su tutte le tabelle interne.</li>
            <li><strong>Token CRM auto-rinnovati</strong> ogni 2 ore per garantire continuità.</li>
            <li><strong>Pannello di diagnostica</strong> con stato connessioni, cron job e cache.</li>
          </ul>
        </Section>

        <Section n="6" title="Stack tecnico">
          <ul>
            <li>Frontend: <strong>Next.js 16</strong> (App Router, Turbopack), TypeScript, Tailwind / CSS scoped.</li>
            <li>Backend: API serverless su <strong>Vercel</strong>, runtime Node.js.</li>
            <li>Database: <strong>Supabase</strong> (Postgres + auth + cron pg_cron + pg_net).</li>
            <li>Hosting: <strong>core.bibotcrm.it</strong>, dominio dedicato, SSL automatico.</li>
            <li>Integrazione CRM: API REST + webhook + token OAuth.</li>
          </ul>
        </Section>

        <Section n="7" title="Tempistiche">
          <p>
            Implementazione completa: <strong>già consegnata</strong> (in produzione su core.bibotcrm.it).
            Eventuali iterazioni o adattamenti richiesti dal cliente verranno valutati separatamente.
          </p>
        </Section>

        <Section n="8" title="Investimento">
          <div className="sow-price">
            <div className="sow-price-label">Compenso una tantum</div>
            <div className="sow-price-amount">€ 800</div>
            <div className="sow-price-note">IVA esclusa · pagamento alla consegna</div>
          </div>
          <p>
            Il prezzo include progettazione, sviluppo, deploy in produzione, configurazione iniziale,
            formazione operativa e correzioni di eventuali difetti riscontrati nei primi 30 giorni.
          </p>
        </Section>

        <Section n="9" title="Esclusioni">
          <ul>
            <li>Costo della piattaforma CRM (a carico del cliente).</li>
            <li>Costi infrastrutturali Vercel / Supabase oltre il piano Hobby (se necessari).</li>
            <li>Workflow lato CRM (campagne welcome lead, reminder appuntamenti, follow-up switch-out): vanno configurati nel CRM dal cliente o quotati separatamente.</li>
            <li>Sviluppi di nuove funzionalità non incluse in questo documento.</li>
          </ul>
        </Section>

        <footer className="sow-footer">
          <div>
            Bibot · soluzioni CRM personalizzate<br />
            <a href="https://core.bibotcrm.it">core.bibotcrm.it</a> · info@bibotcrm.it
          </div>
          <div className="sow-footer-right">
            Documento generato il {new Date().toLocaleDateString('it-IT')}
          </div>
        </footer>

        <PrintButton />
      </main>
    </>
  )
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="sow-section">
      <h2><span className="sow-num">{n}</span>{title}</h2>
      {children}
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sow-subsection">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

const CSS = `
:root {
  --sow-purple: #3a06b3;
  --sow-purple-soft: #efeaff;
  --sow-cyan: #66ddff;
  --sow-text: #0f0a2a;
  --sow-muted: #5b5773;
  --sow-line: #e2dff0;
  --sow-bg: #f8f6ff;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; background: var(--sow-bg); color: var(--sow-text); -webkit-font-smoothing: antialiased; }
.sow { max-width: 920px; margin: 0 auto; padding: 60px 56px; background: white; box-shadow: 0 24px 48px -16px rgba(0,0,0,0.06); border-radius: 12px; line-height: 1.6; }
.sow-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding-bottom: 28px; border-bottom: 2px solid var(--sow-purple); margin-bottom: 36px; }
.sow-brand { display: flex; align-items: center; gap: 16px; }
.sow-logo { width: 64px; height: 64px; border-radius: 12px; }
.sow-brand-name { font-weight: 900; font-size: 22px; color: var(--sow-purple); letter-spacing: -0.02em; }
.sow-brand-tag { font-size: 12px; color: var(--sow-muted); margin-top: 2px; }
.sow-meta { font-size: 12px; color: var(--sow-muted); text-align: right; line-height: 1.7; }
.sow-meta strong { color: var(--sow-text); font-weight: 700; }
.sow-title { font-size: 32px; font-weight: 900; letter-spacing: -0.02em; margin: 0 0 6px; color: var(--sow-text); line-height: 1.15; }
.sow-subtitle { font-size: 15px; color: var(--sow-muted); margin: 0 0 36px; max-width: 640px; }
.sow-section { margin-bottom: 32px; page-break-inside: avoid; }
.sow-section h2 { font-size: 18px; font-weight: 800; letter-spacing: -0.01em; color: var(--sow-purple); margin: 0 0 14px; padding-bottom: 6px; border-bottom: 1px solid var(--sow-line); display: flex; align-items: baseline; gap: 12px; }
.sow-num { display: inline-block; min-width: 28px; height: 28px; line-height: 28px; text-align: center; background: var(--sow-purple); color: white; border-radius: 8px; font-size: 13px; font-weight: 800; }
.sow-section p { margin: 0 0 12px; font-size: 14px; }
.sow-section ul { margin: 0; padding-left: 20px; font-size: 14px; }
.sow-section li { margin-bottom: 6px; }
.sow-section li strong { color: var(--sow-text); }
.sow-subsection { margin-top: 16px; padding: 16px 18px; background: var(--sow-purple-soft); border-radius: 10px; border-left: 3px solid var(--sow-purple); }
.sow-subsection h3 { margin: 0 0 8px; font-size: 14px; font-weight: 800; color: var(--sow-purple); letter-spacing: -0.01em; }
.sow-subsection ul { padding-left: 18px; }
.sow-subsection li { font-size: 13.5px; margin-bottom: 4px; }
.sow-section code { background: var(--sow-purple-soft); padding: 1px 6px; border-radius: 4px; font-size: 12px; color: var(--sow-purple); font-weight: 600; }
.sow-price { background: linear-gradient(135deg, var(--sow-purple) 0%, #5d20d4 100%); color: white; padding: 28px 32px; border-radius: 14px; text-align: center; margin: 12px 0 16px; }
.sow-price-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.16em; opacity: 0.85; font-weight: 600; }
.sow-price-amount { font-size: 56px; font-weight: 900; letter-spacing: -0.04em; margin: 6px 0; line-height: 1; }
.sow-price-note { font-size: 12px; opacity: 0.85; }
.sow-footer { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-top: 48px; padding-top: 22px; border-top: 1px solid var(--sow-line); font-size: 12px; color: var(--sow-muted); line-height: 1.7; }
.sow-footer a { color: var(--sow-purple); text-decoration: none; font-weight: 600; }
.sow-footer-right { text-align: right; }
.sow-actions { position: fixed; bottom: 24px; right: 24px; }
.sow-print { background: var(--sow-purple); color: white; border: none; padding: 12px 20px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; box-shadow: 0 8px 24px -8px rgba(58, 6, 179, 0.4); }
.sow-print:hover { transform: translateY(-1px); }
@media print {
  body { background: white; }
  .sow { box-shadow: none; max-width: 100%; padding: 24px; }
  .sow-actions { display: none; }
  .sow-section { page-break-inside: avoid; }
}
@media (max-width: 720px) {
  .sow { padding: 28px 18px; border-radius: 0; }
  .sow-header { flex-direction: column; }
  .sow-meta { text-align: left; }
  .sow-title { font-size: 26px; }
  .sow-price-amount { font-size: 44px; }
}
`
