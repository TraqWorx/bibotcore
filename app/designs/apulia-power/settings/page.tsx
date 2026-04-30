import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { APULIA_LOCATION_ID, APULIA_FIELD, currentPeriod } from '@/lib/apulia/fields'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
      <header>
        <h1 className="ap-page-title">Impostazioni</h1>
        <p className="ap-page-subtitle">Riferimenti tecnici della configurazione Apulia Power.</p>
      </header>

      <section className="ap-card ap-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800 }}>Periodi commissione</h2>
        <div style={{ fontSize: 13, color: 'var(--ap-text-muted)' }}>
          Le commissioni sono pagate semestralmente: <strong>01/01</strong> e <strong>01/07</strong>. Periodo corrente: <strong>{currentPeriod()}</strong>.
        </div>
      </section>

      <section className="ap-card ap-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800 }}>Riferimenti GHL</h2>
        <KV k="Location ID" v={APULIA_LOCATION_ID} />
        <KV k="Field: Commissione Totale" v={APULIA_FIELD.COMMISSIONE_TOTALE} />
        <KV k="Field: POD Override" v={APULIA_FIELD.POD_OVERRIDE} />
        <KV k="Field: Compenso per POD" v={APULIA_FIELD.COMPENSO_PER_POD} />
        <KV k="Field: Codice Amministratore" v={APULIA_FIELD.CODICE_AMMINISTRATORE} />
        <KV k="Field: POD/PDR" v={APULIA_FIELD.POD_PDR} />
      </section>

      <section className="ap-card ap-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800 }}>Logica di calcolo</h2>
        <p style={{ fontSize: 13, color: 'var(--ap-text-muted)', margin: 0 }}>
          Per ogni amministratore: commissione = somma per ogni POD attivo (tag <code>amministratore</code> sui contatti
          condomini con <code>Codice amministratore</code> uguale, tag <code>Switch-out</code> escluso) di
          <em> POD Override</em> oppure <em>compenso per ciascun pod</em> dell&apos;amministratore.
        </p>
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
