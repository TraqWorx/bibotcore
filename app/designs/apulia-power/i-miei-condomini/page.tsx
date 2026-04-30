import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { adminWithPods } from '@/lib/apulia/queries'

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 className="ap-page-title">I miei condomini</h1>
        <p className="ap-page-subtitle">{activePods.length} attivi, {switchedPods.length} switch-out. Compenso per POD: <strong>{fmtEur(admin.compensoPerPod)}</strong>.</p>
      </header>

      <section className="ap-card">
        <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)' }}><h2 style={{ fontSize: 14, fontWeight: 800 }}>Attivi</h2></header>
        <table className="ap-table">
          <thead><tr><th>POD/PDR</th><th>Cliente</th><th style={{ textAlign: 'right' }}>Compenso</th></tr></thead>
          <tbody>
            {activePods.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--ap-text-faint)' }}>Nessuno.</td></tr>}
            {activePods.map((p) => (
              <tr key={p.contactId}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.pod}</td>
                <td>{p.cliente ?? '—'}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {switchedPods.length > 0 && (
        <section className="ap-card">
          <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--ap-line)' }}><h2 style={{ fontSize: 14, fontWeight: 800 }}>Switch-out</h2></header>
          <table className="ap-table">
            <thead><tr><th>POD/PDR</th><th>Cliente</th></tr></thead>
            <tbody>
              {switchedPods.map((p) => (
                <tr key={p.contactId}><td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.pod}</td><td>{p.cliente ?? '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
