import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { adminWithPods } from '@/lib/apulia/queries'
import SettingsTabs from '../settings/_components/SettingsTabs'

export const dynamic = 'force-dynamic'

function fmtEur(n: number): string { return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) }

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role === 'owner') redirect('/designs/apulia-power/condomini')
  if (!session.contactId) {
    return <div className="ap-card ap-card-pad">Profilo non collegato.</div>
  }

  const { admin, activePods, switchedPods } = await adminWithPods(session.contactId)
  if (!admin) return <div className="ap-card ap-card-pad">Profilo non trovato.</div>

  function fmtDate(iso?: string): string {
    return iso ? new Date(iso).toLocaleDateString('it-IT') : '—'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 className="ap-page-title">I miei condomini</h1>
        <p className="ap-page-subtitle">{activePods.length} attivi, {switchedPods.length} switch-out. Compenso per POD: <strong>{fmtEur(admin.compensoPerPod)}</strong>.</p>
      </header>

      <SettingsTabs
        tabs={[
          {
            id: 'attivi',
            label: 'Attivi',
            badge: activePods.length || undefined,
            content: (
              <section className="ap-card">
                <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 800 }}>Attivi <span style={{ color: 'var(--ap-text-faint)', fontWeight: 500 }}>· {activePods.length}</span></h2>
                  <span className="ap-pill" data-tone="blue">Inclusi nella commissione</span>
                </header>
                <table className="ap-table">
                  <thead><tr><th>Aggiunto il</th><th>POD/PDR</th><th>Cliente</th><th style={{ textAlign: 'right' }}>Compenso</th></tr></thead>
                  <tbody>
                    {activePods.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessun condominio attivo.</td></tr>}
                    {activePods.map((p) => (
                      <tr key={p.contactId}>
                        <td style={{ fontSize: 12, color: 'var(--ap-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(p.addedAt)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.pod}</td>
                        <td>{p.cliente ?? '—'}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ),
          },
          {
            id: 'switchout',
            label: 'Switch-out',
            badge: switchedPods.length || undefined,
            content: (
              <section className="ap-card">
                <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 800 }}>Switch-out <span style={{ color: 'var(--ap-text-faint)', fontWeight: 500 }}>· {switchedPods.length}</span></h2>
                  <span className="ap-pill" data-tone="gray">Esclusi dalla commissione</span>
                </header>
                <table className="ap-table">
                  <thead><tr><th>Aggiunto il</th><th>POD/PDR</th><th>Cliente</th></tr></thead>
                  <tbody>
                    {switchedPods.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessun switch-out.</td></tr>}
                    {switchedPods.map((p) => (
                      <tr key={p.contactId}>
                        <td style={{ fontSize: 12, color: 'var(--ap-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(p.addedAt)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.pod}</td>
                        <td>{p.cliente ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ),
          },
        ]}
      />
    </div>
  )
}
