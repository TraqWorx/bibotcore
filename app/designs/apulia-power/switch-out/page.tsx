import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listCondomini } from '@/lib/apulia/queries'

export const dynamic = 'force-dynamic'

interface SearchParams {
  q?: string
  comune?: string
  amministratore?: string
  page?: string
}

const PAGE_SIZE = 50

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? 1))

  const { rows, total, comuni, amministratori } = await listCondomini({
    stato: 'switch_out',
    q: sp.q,
    comune: sp.comune,
    amministratore: sp.amministratore,
    page,
    pageSize: PAGE_SIZE,
  })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function buildHref(patch: Partial<SearchParams>): string {
    const next: Record<string, string | undefined> = { ...sp, ...patch }
    const u = new URLSearchParams()
    if (next.q) u.set('q', next.q)
    if (next.comune) u.set('comune', next.comune)
    if (next.amministratore) u.set('amministratore', next.amministratore)
    if (next.page && Number(next.page) > 1) u.set('page', String(next.page))
    const qs = u.toString()
    return '/designs/apulia-power/switch-out' + (qs ? '?' + qs : '')
  }

  const filtersActive = Boolean(sp.q || sp.comune || sp.amministratore)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 className="ap-page-title">Switch-out</h1>
        <p className="ap-page-subtitle">{total.toLocaleString('it-IT')} POD usciti dal contratto. Filtra per cliente, amministratore, comune.</p>
      </header>

      <form className="ap-card ap-card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cerca</label>
          <input className="ap-input" name="q" defaultValue={sp.q ?? ''} placeholder="POD, cliente, amministratore…" style={{ marginTop: 4 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Amministratore</label>
          <select className="ap-input" name="amministratore" defaultValue={sp.amministratore ?? ''} style={{ marginTop: 4 }}>
            <option value="">Tutti</option>
            {amministratori.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Comune</label>
          <select className="ap-input" name="comune" defaultValue={sp.comune ?? ''} style={{ marginTop: 4 }}>
            <option value="">Tutti</option>
            {comuni.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="submit" className="ap-btn ap-btn-primary" style={{ flex: 1 }}>Filtra</button>
          {filtersActive && <Link href="/designs/apulia-power/switch-out" className="ap-btn ap-btn-ghost">Reset</Link>}
        </div>
      </form>

      <section className="ap-card">
        <table className="ap-table">
          <thead>
            <tr>
              <th>POD/PDR</th>
              <th>Cliente</th>
              <th>Amministratore</th>
              <th>Comune</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 28, color: 'var(--ap-text-faint)' }}>Nessun switch-out.</td></tr>}
            {rows.map((p) => (
              <tr key={p.contactId}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.pod}</td>
                <td>{p.cliente ?? '—'}</td>
                <td>{p.amministratore ?? '—'}</td>
                <td>{p.comune ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
          <Link href={buildHref({ page: page > 1 ? String(page - 1) : undefined })} className="ap-btn ap-btn-ghost" style={{ pointerEvents: page === 1 ? 'none' : 'auto', opacity: page === 1 ? 0.4 : 1 }}>← Precedente</Link>
          <span style={{ fontSize: 13, color: 'var(--ap-text-muted)' }}>Pagina {page} di {totalPages}</span>
          <Link href={buildHref({ page: page < totalPages ? String(page + 1) : undefined })} className="ap-btn ap-btn-ghost" style={{ pointerEvents: page === totalPages ? 'none' : 'auto', opacity: page === totalPages ? 0.4 : 1 }}>Successivo →</Link>
        </div>
      )}
    </div>
  )
}
