'use client'

import Link from 'next/link'
import useSWR from 'swr'

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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">Caricamento...</p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-gray-100 bg-gray-50" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl border border-gray-100 bg-gray-50" />
          ))}
        </div>
      </div>
    )
  }

  const {
    totalContacts, operators, targetAnnuale, categoryData, switchOutTotal,
    isAdmin, gareRows, closedDays: closedDaysArr,
  } = data as {
    totalContacts: number
    operators: number
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
    green:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', label: 'In Target' },
    yellow: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', label: 'Attenzione' },
    red:    { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', label: 'Sotto Target' },
  }[perfStatus]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isAdmin ? 'Panoramica operativa' : 'I tuoi risultati'} — {now.getFullYear()}
          </p>
        </div>
        <Link href={`/designs/simfonia/contacts/new${q}`} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition-all hover:opacity-90" style={{ background: '#00F0FF' }}>
          + Nuovo Contatto
        </Link>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Contatti Totali</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{totalContacts.toLocaleString('it-IT')}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Operatori</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{operators}</p>
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${switchOutTotal > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'}`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
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
        <Link href={`/designs/simfonia/calendar${q}`} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Calendario</p>
          <p className="mt-2 text-sm font-medium text-gray-600">Vedi appuntamenti</p>
        </Link>
      </div>

      {/* Target annuale */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Target Annuale</p>
              <p className="mt-2 text-4xl font-black" style={{ color: '#2A00CC' }}>{targetAnnuale.toLocaleString('it-IT')}</p>
              <p className="mt-1 text-xs text-gray-400">contratti obiettivo</p>
            </div>
            <div className="rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Contratti Chiusi</p>
              <p className="mt-2 text-4xl font-black" style={{ color: '#2A00CC' }}>{contratti.toLocaleString('it-IT')}</p>
            </div>
            <div className="rounded-2xl border border-[rgba(42,0,204,0.12)] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">% Raggiunta</p>
              <p className="mt-2 text-4xl font-black" style={{ color: '#2A00CC' }}>{pctContratti.toFixed(1)}%</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pctContratti, 100)}%`, background: perfStatus === 'green' ? '#16a34a' : perfStatus === 'yellow' ? '#d97706' : '#dc2626' }} />
              </div>
              <p className="mt-1 text-xs text-gray-400">obiettivo: {pctTempo.toFixed(1)}% atteso</p>
            </div>
          </div>

          <div className="rounded-2xl border p-5" style={{ background: perfConfig.bg, borderColor: perfConfig.border }}>
            <div className="flex items-center justify-between">
              <div>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider" style={{ background: perfConfig.border, color: perfConfig.text }}>{perfConfig.label}</span>
                <p className="mt-2 text-sm font-medium" style={{ color: perfConfig.text }}>
                  {pctContratti.toFixed(1)}% contratti vs {pctTempo}% tempo — differenza {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                </p>
              </div>
              <div className="flex gap-6 text-right">
                <div><p className="text-2xl font-bold" style={{ color: perfConfig.text }}>{wdPassed}</p><p className="text-xs" style={{ color: perfConfig.text, opacity: 0.7 }}>gg. passati</p></div>
                <div><p className="text-2xl font-bold" style={{ color: perfConfig.text }}>{wdRemaining}</p><p className="text-xs" style={{ color: perfConfig.text, opacity: 0.7 }}>gg. rimanenti</p></div>
                <div><p className="text-2xl font-bold" style={{ color: perfConfig.text }}>{pctTempo}%</p><p className="text-xs" style={{ color: perfConfig.text, opacity: 0.7 }}>anno trascorso</p></div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Categories */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">Per Categoria</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {categoryData.map((cat) => {
            const style = CATEGORY_STYLES[cat.slug] ?? { border: 'border-gray-200', accent: 'text-gray-700', bg: 'bg-gray-50' }
            const pctOfTotal = totalContacts > 0 ? (cat.total / totalContacts) * 100 : 0
            return (
              <Link key={cat.slug} href={`/designs/simfonia/contacts${q}&category=${cat.slug}`} className={`group rounded-2xl border ${style.border} bg-white p-5 shadow-sm hover:shadow-md transition-all`}>
                <p className={`text-xs font-semibold uppercase tracking-widest ${style.accent}`}>{cat.label}</p>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className={`text-3xl font-black tabular-nums ${style.accent}`}>{cat.total.toLocaleString('it-IT')}</span>
                  <span className="text-sm font-semibold tabular-nums text-gray-300">contatti</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full rounded-full transition-all ${style.bg}`} style={{ width: `${Math.min(pctOfTotal, 100)}%` }} />
                </div>
                <p className="mt-2 text-[11px] tabular-nums text-gray-400">{pctOfTotal.toFixed(1)}% del totale</p>
                {cat.providers.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
                    {cat.providers.slice(0, 6).map((p) => (
                      <div key={p.provider} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 truncate mr-2">{p.provider}</span>
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
      {isAdmin && gareRows.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">
              Gare — {now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
            </h2>
            <Link href={`/designs/simfonia/settings${q}`} className="text-xs font-medium underline" style={{ color: '#2A00CC' }}>Modifica obiettivi</Link>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(gareRows.length, 4)}, minmax(0, 1fr))` }}>
            {gareRows.map((g) => {
              const attivato = 0 // Will be computed server-side in future
              const pctRaggiunta = g.obiettivo > 0 ? (attivato / g.obiettivo) * 100 : 0
              const isOnTrack = pctRaggiunta >= mwdPct
              return (
                <div key={g.categoria} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: isOnTrack ? '#bbf7d0' : '#fecaca' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 capitalize">{g.categoria}</p>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-3xl font-black tabular-nums text-gray-900">{attivato}</span>
                    <span className="text-lg font-semibold tabular-nums text-gray-300">/ {g.obiettivo}</span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pctRaggiunta, 100)}%`, background: isOnTrack ? '#16a34a' : '#dc2626' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
