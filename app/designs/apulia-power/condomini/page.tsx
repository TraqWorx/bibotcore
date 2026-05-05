import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getApuliaSession } from '@/lib/apulia/auth'
import { listCondomini } from '@/lib/apulia/queries'
import { listAdminPickerOptions } from '@/lib/apulia/queries-cached'
import AddCondominoPanel from './_components/AddCondominoPanel'
import CondominiBulkSelect from './_components/CondominiBulkSelect'
import { ResyncButton } from '../settings/_components/SettingsForms'
import StaleSyncTrigger from '../_components/StaleSyncTrigger'
import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

interface SearchParams {
  q?: string
  stato?: 'active' | 'switch_out'
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

  const sb = createAdminClient()
  const [{ rows, total, comuni, amministratori }, adminOptions, { data: latestCache }] = await Promise.all([
    listCondomini({
      q: sp.q,
      stato: sp.stato,
      comune: sp.comune,
      amministratore: sp.amministratore,
      page,
      pageSize: PAGE_SIZE,
    }),
    listAdminPickerOptions(),
    sb.from('apulia_contacts').select('cached_at').order('cached_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const cacheAgeMinutes = latestCache?.cached_at
    ? (Date.now() - new Date(latestCache.cached_at).getTime()) / 60000
    : Number.POSITIVE_INFINITY

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function buildHref(patch: Partial<SearchParams>): string {
    const next: Record<string, string | undefined> = { ...sp, ...patch }
    const u = new URLSearchParams()
    if (next.q) u.set('q', next.q)
    if (next.stato) u.set('stato', next.stato)
    if (next.comune) u.set('comune', next.comune)
    if (next.amministratore) u.set('amministratore', next.amministratore)
    if (next.page && Number(next.page) > 1) u.set('page', String(next.page))
    const qs = u.toString()
    return '/designs/apulia-power/condomini' + (qs ? '?' + qs : '')
  }

  const filtersActive = Boolean(sp.q || sp.stato || sp.comune || sp.amministratore)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="ap-page-title">Condomini</h1>
          <p className="ap-page-subtitle">{total.toLocaleString('it-IT')} POD trovati. Filtra per cliente, amministratore, comune, stato.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <StaleSyncTrigger ageMinutes={cacheAgeMinutes} />
          <ResyncButton />
          <AddCondominoPanel adminOptions={adminOptions} />
        </div>
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
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ap-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Stato</label>
          <select className="ap-input" name="stato" defaultValue={sp.stato ?? ''} style={{ marginTop: 4 }}>
            <option value="">Tutti</option>
            <option value="active">Attivi</option>
            <option value="switch_out">Switch-out</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="submit" className="ap-btn ap-btn-primary" style={{ flex: 1 }}>Filtra</button>
          {filtersActive && <Link href="/designs/apulia-power/condomini" className="ap-btn ap-btn-ghost">Reset</Link>}
        </div>
      </form>

      <section className="ap-card">
        <CondominiBulkSelect
          rows={rows}
          total={total}
          filters={{ q: sp.q, stato: sp.stato, comune: sp.comune, amministratore: sp.amministratore }}
        />
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
