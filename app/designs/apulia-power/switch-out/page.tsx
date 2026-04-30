import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listCondomini } from '@/lib/apulia/queries'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  // Pull all switch-out PODs in one query (paginated to a generous max).
  const { rows, total } = await listCondomini({ stato: 'switch_out', pageSize: 5000, page: 1 })

  // Group by amministratore name
  const byAdmin = new Map<string, typeof rows>()
  for (const p of rows) {
    const k = p.amministratore ?? '— senza amministratore —'
    if (!byAdmin.has(k)) byAdmin.set(k, [])
    byAdmin.get(k)!.push(p)
  }
  const groups = [...byAdmin.entries()].sort((a, b) => b[1].length - a[1].length)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 className="ap-page-title">Switch-out</h1>
        <p className="ap-page-subtitle">{total.toLocaleString('it-IT')} POD usciti dal contratto, raggruppati per amministratore. Esclusi dal calcolo commissione.</p>
      </header>

      <section className="ap-card">
        <table className="ap-table">
          <thead>
            <tr>
              <th>Amministratore</th>
              <th style={{ textAlign: 'right' }}>POD switched-out</th>
              <th>POD recenti (primi 3)</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 28, color: 'var(--ap-text-faint)' }}>Nessun switch-out registrato.</td></tr>}
            {groups.map(([name, list]) => (
              <tr key={name}>
                <td style={{ fontWeight: 600 }}>{name}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{list.length}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--ap-text-muted)' }}>
                  {list.slice(0, 3).map((p) => p.pod).filter(Boolean).join(', ')}
                  {list.length > 3 && <span style={{ color: 'var(--ap-text-faint)' }}>{` +${list.length - 3}`}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
