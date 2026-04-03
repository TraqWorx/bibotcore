'use client'

import Link from 'next/link'
import useSWR from 'swr'
import SimfoniaPageHeader from '../../_components/SimfoniaPageHeader'
import { sf } from '@/lib/simfonia/ui'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const CATEGORY_STYLES: Record<string, { border: string; accent: string; bg: string }> = {
  telefonia:       { border: 'border-blue-200', accent: 'text-blue-700', bg: 'bg-blue-50' },
  energia:         { border: 'border-amber-200', accent: 'text-amber-700', bg: 'bg-amber-50' },
  connettivita:    { border: 'border-green-200', accent: 'text-green-700', bg: 'bg-green-50' },
  intrattenimento: { border: 'border-purple-200', accent: 'text-purple-700', bg: 'bg-purple-50' },
}

function countWorkingDays(start: Date, end: Date, closedDays: Set<string> = new Set()): number {
  let count = 0
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)
  while (cur <= endDay) {
    const d = cur.getDay()
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    if (d !== 0 && d !== 6 && !closedDays.has(iso)) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

interface CategoryData {
  slug: string
  label: string
  total: number
  providers: { provider: string; count: number }[]
  switchOutCount: number
}

export default function DashboardClient({ locationId }: { locationId: string }) {
  const { data, isLoading } = useSWR(`/api/dashboard?locationId=${locationId}`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  })

  const now = new Date()
  const q = `?locationId=${locationId}`

  if (isLoading || !data) {
    return (
      <div className="space-y-8">
        <SimfoniaPageHeader eyebrow="Home" title="Dashboard" description="Caricamento dati…" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${sf.statTile} h-32 animate-pulse bg-gray-100/80`} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${sf.statTile} h-44 animate-pulse bg-gray-100/80`} />
          ))}
        </div>
      </div>
    )
  }

  const {
    totalContacts, targetAnnuale, categoryData, switchOutTotal,
    isAdmin, gareRows, closedDays: closedDaysArr,
  } = data as {
    totalContacts: number
    targetAnnuale: number
    categoryData: CategoryData[]
    switchOutTotal: number
    isAdmin: boolean
    gareRows: { categoria: string; obiettivo: number; tag: string }[]
    closedDays: string[]
  }

  const closedDays = new Set(closedDaysArr ?? [])

  // Working day stats
  const year = now.getFullYear()
  const jan1 = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)
  const wdPassed = countWorkingDays(jan1, now, closedDays)
  const wdTotal = countWorkingDays(jan1, dec31, closedDays)
  const wdRemaining = wdTotal - wdPassed
  const pctTempo = Math.round((wdPassed / wdTotal) * 100)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const mwdPassed = countWorkingDays(monthStart, now, closedDays)
  const mwdTotal = countWorkingDays(monthStart, monthEnd, closedDays)
  const mwdPct = mwdTotal > 0 ? Math.round((mwdPassed / mwdTotal) * 100) : 0

  const contratti = totalContacts
  const pctContratti = targetAnnuale > 0 ? (contratti / targetAnnuale) * 100 : 0
  const diff = pctContratti - pctTempo
  const perfStatus: 'green' | 'yellow' | 'red' = diff > 2 ? 'green' : diff >= -2 ? 'yellow' : 'red'
  const perfConfig = {
    green:  { panel: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-900', pill: 'bg-emerald-200/80 text-emerald-900', label: 'In target' },
    yellow: { panel: 'border-amber-200/80 bg-amber-50/80 text-amber-950', pill: 'bg-amber-200/80 text-amber-950', label: 'Attenzione' },
    red:    { panel: 'border-red-200/80 bg-red-50/80 text-red-950', pill: 'bg-red-200/80 text-red-950', label: 'Sotto target' },
  }[perfStatus]

  return (
    <div className="space-y-8">
      <SimfoniaPageHeader
        eyebrow="Home"
        title="Dashboard"
        description={
          <>
            {isAdmin ? 'Panoramica operativa' : 'I tuoi risultati'} — {now.getFullYear()}
          </>
        }
        actions={
          <Link
            href={`/designs/simfonia/contacts/new${q}`}
            className={sf.primaryBtn}
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 88%, white) 100%)',
            }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuovo contatto
          </Link>
        }
      />

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href={`/designs/simfonia/contacts${q}`}
          className={`${sf.card} ${sf.cardPadding} group flex items-center justify-between gap-4 transition hover:border-brand/25 hover:bg-white`}
        >
          <div className="min-w-0">
            <p className={sf.sectionLabel}>Anagrafica</p>
            <p className="mt-2 text-base font-bold text-gray-900">Contatti</p>
            <p className="mt-1 text-xs text-gray-500">Cerca e filtra contatti</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand transition group-hover:bg-brand/15">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </span>
        </Link>

        <Link
          href={`/designs/simfonia/pipeline${q}`}
          className={`${sf.card} ${sf.cardPadding} group flex items-center justify-between gap-4 transition hover:border-brand/25 hover:bg-white`}
        >
          <div className="min-w-0">
            <p className={sf.sectionLabel}>Vendite</p>
            <p className="mt-2 text-base font-bold text-gray-900">Pipeline</p>
            <p className="mt-1 text-xs text-gray-500">Trascina e gestisci opportunità</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand transition group-hover:bg-brand/15">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l3-3 4 4 6-6" />
            </svg>
          </span>
        </Link>

        <Link
          href={`/designs/simfonia/calendar${q}`}
          className={`${sf.card} ${sf.cardPadding} group flex items-center justify-between gap-4 transition hover:border-brand/25 hover:bg-white`}
        >
          <div className="min-w-0">
            <p className={sf.sectionLabel}>Agenda</p>
            <p className="mt-2 text-base font-bold text-gray-900">Calendario</p>
            <p className="mt-1 text-xs text-gray-500">Controlla appuntamenti</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand transition group-hover:bg-brand/15">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75" />
            </svg>
          </span>
        </Link>

        <Link
          href={`/designs/simfonia/settings${q}`}
          className={`${sf.card} ${sf.cardPadding} group flex items-center justify-between gap-4 transition hover:border-brand/25 hover:bg-white`}
        >
          <div className="min-w-0">
            <p className={sf.sectionLabel}>Impostazioni</p>
            <p className="mt-2 text-base font-bold text-gray-900">Configurazione</p>
            <p className="mt-1 text-xs text-gray-500">Tema, tag e regole</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand transition group-hover:bg-brand/15">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0 1 14.658-2.186l1.06-.424a1.125 1.125 0 0 1 1.47.61l.75 1.81a1.125 1.125 0 0 1-.61 1.47l-1.06.424a7.53 7.53 0 0 1 0 2.592l1.06.424a1.125 1.125 0 0 1 .61 1.47l-.75 1.81a1.125 1.125 0 0 1-1.47.61l-1.06-.424A7.5 7.5 0 0 1 4.5 12Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.375A3.375 3.375 0 1 0 12 8.625a3.375 3.375 0 0 0 0 6.75Z" />
            </svg>
          </span>
        </Link>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
        <div className={sf.statTile}>
          <p className={sf.sectionLabel}>Contatti totali</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-gray-900">{totalContacts.toLocaleString('it-IT')}</p>
        </div>
        <div className={`${sf.statTile} ${switchOutTotal > 0 ? 'border-red-200/80 bg-red-50/90' : ''}`}>
          <p className={sf.sectionLabel}>
            <span className="mr-1">&#x1F6A9;</span> Switch Out
          </p>
          <p className={`mt-2 text-3xl font-black ${switchOutTotal > 0 ? 'text-red-600' : 'text-gray-900'}`}>{switchOutTotal}</p>
          {switchOutTotal > 0 && (
            <div className="mt-2 space-y-0.5">
              {categoryData.filter((c) => c.switchOutCount > 0).map((c) => (
                <div key={c.slug} className="flex items-center justify-between text-xs">
                  <span className="text-red-500">{c.label}</span>
                  <span className="font-bold text-red-600">{c.switchOutCount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Target annuale */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className={`${sf.statTile} border-brand/20`}>
              <p className={sf.sectionLabel}>Target annuale</p>
              <p className="mt-2 text-4xl font-black tabular-nums text-brand">{targetAnnuale.toLocaleString('it-IT')}</p>
              <p className="mt-1 text-xs text-gray-500">Contratti obiettivo</p>
            </div>
            <div className={`${sf.statTile} border-brand/20`}>
              <p className={sf.sectionLabel}>Contratti chiusi</p>
              <p className="mt-2 text-4xl font-black tabular-nums text-brand">{contratti.toLocaleString('it-IT')}</p>
            </div>
            <div className={`${sf.statTile} border-brand/20`}>
              <p className={sf.sectionLabel}>% Raggiunta</p>
              <p className="mt-2 text-4xl font-black tabular-nums text-brand">{pctContratti.toFixed(1)}%</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full transition-colors" style={{ width: `${Math.min(pctContratti, 100)}%`, background: perfStatus === 'green' ? '#16a34a' : perfStatus === 'yellow' ? '#d97706' : '#dc2626' }} />
              </div>
              <p className="mt-1 text-xs text-gray-400">obiettivo: {pctTempo.toFixed(1)}% atteso</p>
            </div>
          </div>

          <div className={`rounded-3xl border p-6 shadow-sm backdrop-blur-sm ${perfConfig.panel}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${perfConfig.pill}`}>{perfConfig.label}</span>
                <p className="mt-2 text-sm font-medium">
                  {pctContratti.toFixed(1)}% contratti vs {pctTempo}% tempo — differenza {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                </p>
              </div>
              <div className="flex gap-6 text-right">
                <div><p className="text-2xl font-bold">{wdPassed}</p><p className="text-xs opacity-70">gg. passati</p></div>
                <div><p className="text-2xl font-bold">{wdRemaining}</p><p className="text-xs opacity-70">gg. rimanenti</p></div>
                <div><p className="text-2xl font-bold">{pctTempo}%</p><p className="text-xs opacity-70">anno trascorso</p></div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Categories */}
      <section className={`${sf.panel}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className={sf.sectionLabel}>Per categoria</h2>
          <Link href={`/designs/simfonia/contacts${q}`} className="text-xs font-bold text-brand underline-offset-4 hover:underline">
            Vai ai contatti
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {categoryData.map((cat) => {
            const style = CATEGORY_STYLES[cat.slug] ?? { border: 'border-gray-200', accent: 'text-gray-700', bg: 'bg-gray-50' }
            const pctOfTotal = totalContacts > 0 ? (cat.total / totalContacts) * 100 : 0
            return (
              <Link
                key={cat.slug}
                href={`/designs/simfonia/contacts${q}&category=${cat.slug}`}
                className={`group rounded-3xl border-2 ${style.border} bg-white/95 p-5 shadow-sm backdrop-blur-sm transition hover:border-brand/25 hover:shadow-md`}
              >
                <p className={`text-[11px] font-bold uppercase tracking-wider ${style.accent}`}>{cat.label}</p>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className={`text-3xl font-black tabular-nums ${style.accent}`}>{cat.total.toLocaleString('it-IT')}</span>
                  <span className="text-sm font-semibold tabular-nums text-gray-300">contatti</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full rounded-full transition-colors ${style.bg}`} style={{ width: `${Math.min(pctOfTotal, 100)}%` }} />
                </div>
                <p className="mt-2 text-[11px] tabular-nums text-gray-400">{pctOfTotal.toFixed(1)}% del totale</p>
                {cat.providers.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
                    {cat.providers.slice(0, 6).map((p) => (
                      <div key={p.provider} className="flex items-center justify-between text-xs">
                        <span className="mr-2 truncate text-gray-500">{p.provider}</span>
                        <span className="font-semibold tabular-nums text-gray-700">{p.count}</span>
                      </div>
                    ))}
                    {cat.providers.length > 6 && <p className="text-[10px] text-gray-400">+{cat.providers.length - 6} altri</p>}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </section>

      {/* Gare Mensili */}
      {isAdmin && (
        <section className={sf.panel}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className={sf.sectionLabel}>
              Gare — {now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
            </h2>
            <Link href={`/designs/simfonia/settings${q}`} className="text-xs font-bold text-brand underline-offset-4 hover:underline">
              Modifica obiettivi
            </Link>
          </div>

          {gareRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 px-8 py-10 text-center backdrop-blur-sm">
              <p className="text-sm font-medium text-gray-500">Nessuna gara configurata.</p>
              <p className="mt-1 text-xs text-gray-400">Imposta obiettivi in Impostazioni → Gare mensili.</p>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(gareRows.length, 4)}, minmax(0, 1fr))` }}>
              {gareRows.map((g) => {
                const attivato = 0 // Will be computed server-side in future
                const pctRaggiunta = g.obiettivo > 0 ? (attivato / g.obiettivo) * 100 : 0
                const isOnTrack = pctRaggiunta >= mwdPct
                return (
                  <div
                    key={g.categoria}
                    className={`${sf.statTile} ${isOnTrack ? 'border-emerald-200/80' : 'border-red-200/80'}`}
                  >
                    <p className={`${sf.sectionLabel} capitalize`}>{g.categoria}</p>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-3xl font-black tabular-nums text-gray-900">{attivato}</span>
                      <span className="text-lg font-semibold tabular-nums text-gray-300">/ {g.obiettivo}</span>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-colors ${isOnTrack ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(pctRaggiunta, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

    </div>
  )
}
