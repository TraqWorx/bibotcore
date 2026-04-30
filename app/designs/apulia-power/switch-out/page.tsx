import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { loadSnapshot } from '@/lib/apulia/queries'
import { APULIA_FIELD, APULIA_TAG, getField } from '@/lib/apulia/fields'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')

  const snap = await loadSnapshot()
  const switched = snap.pods.filter((p) => p.tags?.includes(APULIA_TAG.SWITCH_OUT))

  // Group by amministratore name
  const byAdmin = new Map<string, typeof switched>()
  for (const p of switched) {
    const k = getField(p.customFields, APULIA_FIELD.AMMINISTRATORE_CONDOMINIO) ?? '—'
    if (!byAdmin.has(k)) byAdmin.set(k, [])
    byAdmin.get(k)!.push(p)
  }
  const groups = [...byAdmin.entries()].sort((a, b) => b[1].length - a[1].length)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 className="ap-page-title">Switch-out</h1>
        <p className="ap-page-subtitle">{switched.length.toLocaleString('it-IT')} POD usciti dal contratto. Esclusi dal calcolo commissione.</p>
      </header>

      <section className="ap-card">
        <table className="ap-table">
          <thead>
            <tr>
              <th>Amministratore</th>
              <th style={{ textAlign: 'right' }}>POD switched-out</th>
              <th>Esempi</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 28, color: 'var(--ap-text-faint)' }}>Nessun switch-out registrato.</td></tr>}
            {groups.map(([name, list]) => (
              <tr key={name}>
                <td style={{ fontWeight: 600 }}>{name}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{list.length}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--ap-text-muted)' }}>
                  {list.slice(0, 3).map((p) => getField(p.customFields, APULIA_FIELD.POD_PDR)).filter(Boolean).join(', ')}
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
