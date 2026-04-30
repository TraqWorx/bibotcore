import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { loadSnapshot } from '@/lib/apulia/queries'
import { APULIA_FIELD, APULIA_TAG, getField } from '@/lib/apulia/fields'

export const dynamic = 'force-dynamic'

interface SearchParams { q?: string; tag?: string; admin?: string; page?: string }

const PAGE_SIZE = 50

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getApuliaSession()
  if (session.role !== 'owner') redirect('/designs/apulia-power/dashboard')
  const sp = await searchParams
  const q = (sp.q ?? '').toLowerCase().trim()
  const tagFilter = sp.tag ?? ''
  const page = Math.max(1, Number(sp.page ?? 1))

  const snap = await loadSnapshot()
  let pods = snap.pods

  if (tagFilter === 'active') pods = pods.filter((p) => !p.tags?.includes(APULIA_TAG.SWITCH_OUT))
  else if (tagFilter === 'switch_out') pods = pods.filter((p) => p.tags?.includes(APULIA_TAG.SWITCH_OUT))

  if (q) {
    pods = pods.filter((p) => {
      const pod = (getField(p.customFields, APULIA_FIELD.POD_PDR) ?? '').toLowerCase()
      const name = ((p.firstName ?? '') + ' ' + (p.lastName ?? '')).toLowerCase()
      const adminName = (getField(p.customFields, APULIA_FIELD.AMMINISTRATORE_CONDOMINIO) ?? '').toLowerCase()
      return pod.includes(q) || name.includes(q) || adminName.includes(q)
    })
  }

  const totalCount = pods.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const slice = pods.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function buildHref(o: Partial<SearchParams>): string {
    const next = { ...sp, ...o }
    const u = new URLSearchParams()
    if (next.q) u.set('q', next.q)
    if (next.tag) u.set('tag', next.tag)
    if (next.page && Number(next.page) > 1) u.set('page', String(next.page))
    return '/designs/apulia-power/condomini' + (u.toString() ? '?' + u.toString() : '')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 className="ap-page-title">Condomini</h1>
        <p className="ap-page-subtitle">{totalCount.toLocaleString('it-IT')} POD trovati. Cerca per nome cliente, POD/PDR, amministratore.</p>
      </header>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <form style={{ flex: '1 1 280px' }}>
          <input className="ap-input" name="q" defaultValue={q} placeholder="Cerca…" />
          {tagFilter && <input type="hidden" name="tag" value={tagFilter} />}
        </form>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link href={buildHref({ tag: undefined, page: undefined })} className="ap-pill" data-tone={!tagFilter ? 'blue' : 'gray'} style={{ textDecoration: 'none' }}>Tutti</Link>
          <Link href={buildHref({ tag: 'active', page: undefined })} className="ap-pill" data-tone={tagFilter === 'active' ? 'green' : 'gray'} style={{ textDecoration: 'none' }}>Attivi</Link>
          <Link href={buildHref({ tag: 'switch_out', page: undefined })} className="ap-pill" data-tone={tagFilter === 'switch_out' ? 'amber' : 'gray'} style={{ textDecoration: 'none' }}>Switch-out</Link>
        </div>
      </div>

      <section className="ap-card">
        <table className="ap-table">
          <thead>
            <tr>
              <th>POD/PDR</th>
              <th>Cliente</th>
              <th>Amministratore</th>
              <th>Comune</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--ap-text-faint)' }}>Nessun condominio.</td></tr>}
            {slice.map((p) => {
              const pod = getField(p.customFields, APULIA_FIELD.POD_PDR) ?? '—'
              const adminName = getField(p.customFields, APULIA_FIELD.AMMINISTRATORE_CONDOMINIO) ?? '—'
              const comune = getField(p.customFields, 'EXO9WD4aLV2aPiMYxXUU') ?? '—' // Indirizzo (Città)
              const cliente = ((p.firstName ?? '') + ' ' + (p.lastName ?? '')).trim() || (getField(p.customFields, APULIA_FIELD.CLIENTE) ?? '—')
              const switchedOut = p.tags?.includes(APULIA_TAG.SWITCH_OUT)
              return (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{pod}</td>
                  <td>{cliente}</td>
                  <td>{adminName}</td>
                  <td>{comune}</td>
                  <td>{switchedOut ? <span className="ap-pill" data-tone="amber">Switch-out</span> : <span className="ap-pill" data-tone="green">Attivo</span>}</td>
                </tr>
              )
            })}
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
