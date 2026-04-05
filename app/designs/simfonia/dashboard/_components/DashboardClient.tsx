'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import SimfoniaPageHeader from '../../_components/SimfoniaPageHeader'
import { sf } from '@/lib/simfonia/ui'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const CATEGORY_STYLES: Record<string, { border: string; accent: string; bg: string }> = {
  telefonia:       { border: 'border-[var(--shell-line)]', accent: 'text-brand', bg: 'bg-[var(--shell-soft)]' },
  energia:         { border: 'border-[#f0debb]', accent: 'text-[#9a6f1f]', bg: 'bg-[#fbf4e2]' },
  connettivita:    { border: 'border-[#cfe5d3]', accent: 'text-[#4f8662]', bg: 'bg-[#eaf5ec]' },
  intrattenimento: { border: 'border-[#e6ddf1]', accent: 'text-[#7d66ad]', bg: 'bg-[#f3eef9]' },
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

interface TrendPoint {
  date: string
  count: number
}

interface AppointmentPreview {
  id: string
  title: string
  startTime?: string | null
  status: string
  contactName: string | null
}

interface DashboardData {
  totalContacts: number
  targetAnnuale: number
  categoryData: CategoryData[]
  switchOutTotal: number
  isAdmin: boolean
  gareRows: { categoria: string; obiettivo: number; tag: string }[]
  closedDays: string[]
  contactsTrend: TrendPoint[]
  appointmentPreview: AppointmentPreview[]
}

function formatInt(value: number) {
  const sign = value < 0 ? '-' : ''
  const digits = Math.abs(Math.trunc(value)).toString()
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

function sameDay(date: Date, iso: string) {
  const target = new Date(iso)
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  )
}

export default function DashboardClient({
  locationId,
  demoData,
  demoMode = false,
}: {
  locationId: string
  demoData?: DashboardData
  demoMode?: boolean
}) {
  const { data: swrData, isLoading } = useSWR<DashboardData>(
    demoData ? null : `/api/dashboard?locationId=${locationId}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )
  const data = demoData ?? swrData

  const now = new Date()
  const q = demoMode ? '' : `?locationId=${locationId}`
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate())
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)

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
    isAdmin, gareRows, closedDays: closedDaysArr, contactsTrend, appointmentPreview,
  } = data as DashboardData

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

  const monthDays = (() => {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const startOffset = first.getDay()
    const cells: Array<number | null> = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let i = 1; i <= daysInMonth; i++) cells.push(i)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  })()

  const selectedAppointments = appointmentPreview.filter((item) => {
    if (!item.startTime) return false
    const date = new Date(item.startTime)
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === selectedDay
    )
  })

  const maxTrend = Math.max(...contactsTrend.map((item) => item.count), 1)
  const trendTotal = contactsTrend.reduce((sum, point) => sum + point.count, 0)
  const trendAverage = Number((trendTotal / Math.max(contactsTrend.length, 1)).toFixed(1))
  const trendToday = contactsTrend.at(-1)?.count ?? 0
  const trendTicks = [...new Set([maxTrend, Math.max(Math.round(maxTrend / 2), 1), 0])].sort((a, b) => b - a)
  const chartWidth = Math.max((contactsTrend.length - 1) * 12 + 4, 100)
  const cx0 = 2
  const cx1 = chartWidth - 2
  const cy0 = 8
  const cy1 = 46
  const cvb = `0 0 ${chartWidth} 54`
  const chartPoints = contactsTrend.map((point, index) => {
    const x = cx0 + (index / Math.max(contactsTrend.length - 1, 1)) * (cx1 - cx0)
    const y = cy1 - (point.count / maxTrend) * (cy1 - cy0)
    return { x, y, point }
  })
  const chartLine = chartPoints.map(({ x, y }) => `${x},${y}`).join(' ')
  const chartArea = `${cx0},${cy1} ${chartLine} ${cx1},${cy1}`
  const xLabelPoints = chartPoints.filter((_, i) => i === 0 || i === chartPoints.length - 1 || i % 5 === 0)
  const hoveredTrendPoint = hoveredPoint !== null ? chartPoints[hoveredPoint] : null
  const miniCalendarDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const calendarWidget = (
    <aside className="flex h-full flex-col overflow-hidden rounded-[28px] border border-[var(--shell-line)] bg-[var(--shell-surface)] shadow-[0_18px_40px_-32px_rgba(23,21,18,0.22)]">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--shell-muted)]">Agenda</p>
          {demoMode ? (
            <span className="text-xs font-medium text-brand">Apri calendario</span>
          ) : (
            <Link href={`/designs/simfonia/calendar${q}`} className="text-xs font-medium text-brand hover:underline underline-offset-2">
              Apri calendario
            </Link>
          )}
        </div>
        <h2 className="mt-1.5 text-lg font-bold text-[var(--foreground)] capitalize">
          {now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>
      </div>

      {/* Mini calendar */}
      <div className="px-5 pb-4">
        <div className="rounded-[24px] border border-[var(--shell-line)] bg-[var(--shell-soft)] px-3 py-3">
        <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--shell-muted)]">
          {miniCalendarDays.map((day) => (
            <span key={day} className="py-1">{day.slice(0, 2)}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-y-0.5">
          {monthDays.map((day, index) => {
            const hasAppointments = day
              ? appointmentPreview.some((item) => item.startTime && sameDay(new Date(now.getFullYear(), now.getMonth(), day), item.startTime))
              : false
            const isSelected = day === selectedDay
            const isToday = day === now.getDate()
            return (
              <button
                key={`${day ?? 'empty'}-${index}`}
                type="button"
                onClick={() => { if (day) setSelectedDay(day) }}
                disabled={!day}
                className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium transition-all ${
                  isSelected
                    ? 'bg-brand text-white shadow-sm'
                    : isToday
                      ? 'font-bold text-brand ring-1 ring-brand/30'
                      : hasAppointments
                        ? 'bg-brand/10 text-[var(--foreground)]'
                        : day
                          ? 'text-[var(--shell-muted)] hover:bg-white/80'
                          : 'text-transparent'
                }`}
              >
                {day ?? ''}
              </button>
            )
          })}
        </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-[var(--shell-line)]" />

      {/* Schedule */}
      <div className="flex-1 px-5 pt-4 pb-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {selectedDay === now.getDate() ? 'Oggi' : `${selectedDay} ${now.toLocaleDateString('it-IT', { month: 'short' })}`}
          </p>
          <span className="rounded-full bg-[var(--shell-canvas)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--shell-muted)]">
            {selectedAppointments.length}
          </span>
        </div>
        {selectedAppointments.length > 0 ? (
          <div className="space-y-2">
            {selectedAppointments.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--shell-line)] bg-[var(--shell-canvas)] px-3.5 py-3 transition-colors hover:bg-[var(--shell-soft)]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-[11px] font-bold text-brand">
                  {item.startTime
                    ? new Date(item.startTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.title}</p>
                  <p className="truncate text-xs text-[var(--shell-muted)]">{item.contactName ?? 'Nessun contatto'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--shell-line)] bg-[var(--shell-canvas)] px-4 py-5 text-center text-sm text-[var(--shell-muted)]">
            Nessun appuntamento
          </div>
        )}
      </div>
    </aside>
  )

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
          demoMode ? (
            <span
              className={sf.primaryBtn}
              style={{ backgroundColor: 'var(--brand)', borderColor: 'var(--brand)', opacity: 0.92, cursor: 'default' }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nuovo contatto
            </span>
          ) : (
            <Link
              href={`/designs/simfonia/contacts/new${q}`}
              className={sf.primaryBtn}
              style={{ backgroundColor: 'var(--brand)', borderColor: 'var(--brand)' }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nuovo contatto
            </Link>
          )
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(340px,0.85fr)] xl:items-start">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-[30px] border border-[var(--shell-line)] bg-[var(--shell-surface)] shadow-[0_18px_42px_-32px_rgba(23,21,18,0.2)]">
          <div className="border-b border-[var(--shell-line)] px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className={sf.sectionLabel}>Quadro generale</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)]">
                  {isAdmin ? 'Panoramica performance' : 'I numeri di oggi'}
                </h2>
                <p className="mt-1 text-sm text-[var(--shell-muted)]">
                  Una lettura rapida dei risultati, del ritmo attuale e dei punti che richiedono attenzione.
                </p>
              </div>
              {isAdmin ? (
                <div className={`rounded-2xl border px-4 py-3 shadow-sm ${perfConfig.panel}`}>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${perfConfig.pill}`}>
                    {perfConfig.label}
                  </span>
                  <p className="mt-2 text-sm font-medium">
                    {pctContratti.toFixed(1)}% fatto vs {pctTempo}% atteso
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className={`${sf.statTile} min-h-[124px]`}>
                <p className={sf.sectionLabel}>Contatti totali</p>
                <p className="mt-3 text-4xl font-black tabular-nums text-[var(--foreground)]">{formatInt(totalContacts)}</p>
                <p className="mt-2 text-xs text-[var(--shell-muted)]">Base clienti attiva nella location</p>
              </div>

              <div className={`${sf.statTile} min-h-[124px]`}>
                <p className={sf.sectionLabel}>Switch out</p>
                <p className={`mt-3 text-4xl font-black tabular-nums ${switchOutTotal > 0 ? 'text-red-600' : 'text-[var(--foreground)]'}`}>{switchOutTotal}</p>
                <p className="mt-2 text-xs text-[var(--shell-muted)]">
                  {switchOutTotal > 0 ? 'Richiedono attenzione immediata' : 'Nessun caso critico al momento'}
                </p>
              </div>

              <div className={`${sf.statTile} min-h-[124px] ${isAdmin ? 'border-brand/20' : ''}`}>
                <p className={sf.sectionLabel}>{isAdmin ? 'Target annuale' : 'Media mese'}</p>
                <p className="mt-3 text-4xl font-black tabular-nums text-brand">
                  {isAdmin ? formatInt(targetAnnuale) : trendAverage}
                </p>
                <p className="mt-2 text-xs text-[var(--shell-muted)]">
                  {isAdmin ? 'Contratti obiettivo' : 'Nuovi contatti medi al giorno'}
                </p>
              </div>

              <div className={`${sf.statTile} min-h-[124px] ${isAdmin ? 'border-brand/20' : ''}`}>
                <p className={sf.sectionLabel}>{isAdmin ? 'Avanzamento' : 'Appuntamenti mese'}</p>
                <p className="mt-3 text-4xl font-black tabular-nums text-[var(--foreground)]">
                  {isAdmin ? `${pctContratti.toFixed(1)}%` : appointmentPreview.length}
                </p>
                <p className="mt-2 text-xs text-[var(--shell-muted)]">
                  {isAdmin ? `Ritmo atteso: ${pctTempo}%` : 'Appuntamenti previsti nel mese corrente'}
                </p>
              </div>
            </div>

            <div>
              <div className={`${sf.card} h-fit p-5`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className={sf.sectionLabel}>Andamento</p>
                    <p className="mt-1 text-sm text-[var(--shell-muted)]">
                      {isAdmin
                        ? `Differenza ritmo: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`
                        : `${trendTotal} nuovi contatti nel mese`}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-2xl font-bold tabular-nums text-[var(--foreground)]">{wdPassed}</p>
                      <p className="text-[11px] text-[var(--shell-muted)]">gg. passati</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold tabular-nums text-[var(--foreground)]">{wdRemaining}</p>
                      <p className="text-[11px] text-[var(--shell-muted)]">gg. restanti</p>
                    </div>
                  </div>
                </div>

                {isAdmin ? (
                  <div className="mt-4 rounded-[22px] border border-[var(--shell-line)] bg-[var(--shell-canvas)] p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-[var(--shell-muted)]">Contratti chiusi</span>
                      <span className="font-semibold tabular-nums text-[var(--foreground)]">{formatInt(contratti)}</span>
                    </div>
                    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--shell-soft)_65%,white_35%)]">
                      <div
                        className="h-full rounded-full transition-colors"
                        style={{
                          width: `${Math.min(pctContratti, 100)}%`,
                          background: perfStatus === 'green' ? '#16a34a' : perfStatus === 'yellow' ? '#d97706' : '#dc2626',
                        }}
                      />
                    </div>
                    <p className="mt-3 text-xs text-[var(--shell-muted)]">
                      {pctContratti.toFixed(1)}% del target raggiunto su {formatInt(targetAnnuale)} contratti.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-[22px] border border-[var(--shell-line)] bg-[var(--shell-canvas)] p-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Oggi</p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-brand">{trendToday}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Mese</p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--foreground)]">{trendTotal}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Media/g</p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--foreground)]">{trendAverage}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-[var(--shell-line)] bg-[var(--shell-surface)] shadow-[0_18px_40px_-32px_rgba(23,21,18,0.22)]">
          {/* Header */}
          <div className="px-6 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--shell-muted)]">Trend contatti</p>
                <h2 className="mt-1 text-lg font-bold text-[var(--foreground)]">Nuovi contatti</h2>
              </div>
              <span className="rounded-full bg-[var(--shell-canvas)] px-3 py-1 text-[11px] font-semibold capitalize text-[var(--shell-muted)]">
                {now.toLocaleDateString('it-IT', { month: 'long' })}
              </span>
            </div>

            {/* Stats row */}
            <div className="mt-5 flex gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--shell-muted)]">Totale</p>
                <p className="mt-0.5 text-3xl font-bold tabular-nums text-[var(--foreground)]">{trendTotal}</p>
              </div>
              <div className="border-l border-[var(--shell-line)] pl-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--shell-muted)]">Oggi</p>
                <p className="mt-0.5 text-3xl font-bold tabular-nums text-brand">{trendToday}</p>
              </div>
              <div className="border-l border-[var(--shell-line)] pl-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--shell-muted)]">Media/g</p>
                <p className="mt-0.5 text-3xl font-bold tabular-nums text-[var(--foreground)]">{trendAverage}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="rounded-[26px] border border-[color:color-mix(in_srgb,var(--brand)_20%,var(--shell-line))] bg-[var(--shell-soft)] px-5 py-5">
              <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-4">
                <div className="flex flex-col justify-between py-2 text-[11px] font-semibold tabular-nums text-[var(--shell-muted)]">
                {trendTicks.map((value) => (
                  <span key={value}>{value}</span>
                ))}
              </div>
              <div>
                  <svg viewBox={cvb} className="w-full overflow-visible" style={{ height: 154 }}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity={demoMode ? '0.08' : '0.13'} />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>
                  {trendTicks.map((value) => {
                    const gy = cy1 - (value / maxTrend) * (cy1 - cy0)
                    return (
                      <line
                        key={value}
                        x1={cx0}
                        y1={gy}
                        x2={cx1}
                        y2={gy}
                        stroke="color-mix(in srgb, var(--shell-line) 92%, transparent)"
                        strokeWidth="1"
                      />
                    )
                  })}
                  <polygon points={chartArea} fill="url(#trendFill)" />
                    <polyline
                      fill="none"
                      stroke="var(--brand)"
                      strokeWidth={demoMode ? '1.2' : '1.6'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={chartLine}
                    />
                  {chartPoints.map(({ x, y, point }, index) => {
                    const isHovered = hoveredPoint === index
                    const showDot = true
                    return (
                      <g key={point.date} onMouseEnter={() => setHoveredPoint(index)} onMouseLeave={() => setHoveredPoint(null)} className="cursor-pointer">
                        <circle cx={x} cy={y} r={demoMode ? '2.6' : '4.5'} fill="transparent" />
                        {showDot && (
                          <circle
                            cx={x}
                            cy={y}
                            r={demoMode ? (isHovered ? 1.55 : 1.05) : (isHovered ? 2.1 : 1.4)}
                            fill="white"
                            stroke="var(--brand)"
                            strokeWidth={demoMode ? (isHovered ? 1.05 : 0.8) : (isHovered ? 1.5 : 1.05)}
                          />
                        )}
                      </g>
                    )
                  })}
                  {hoveredTrendPoint && (
                    <g
                      transform={`translate(${Math.max(cx0 + 10, Math.min(cx1 - 10, hoveredTrendPoint.x))},${Math.max(cy0 + 8, hoveredTrendPoint.y - 7)})`}
                      pointerEvents="none"
                    >
                      <rect x={-23} y={-16} width={46} height={19} rx={7} fill="var(--foreground)" opacity="0.94" />
                      <text x="0" y="-8.2" textAnchor="middle" fontSize="4.2" fontWeight="600" fill="white" opacity="0.78">
                        {new Date(hoveredTrendPoint.point.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                      </text>
                      <text x="0" y="-1" textAnchor="middle" fontSize="5.4" fontWeight="700" fill="white">
                        {hoveredTrendPoint.point.count} contatti
                      </text>
                    </g>
                  )}
                </svg>
                <div className="mt-3 grid text-[11px] font-medium text-[var(--shell-muted)]" style={{ gridTemplateColumns: `repeat(${xLabelPoints.length}, minmax(0, 1fr))` }}>
                  {xLabelPoints.map(({ point }, i) => (
                    <span
                      key={point.date}
                      className={`${i === 0 ? 'text-left' : i === xLabelPoints.length - 1 ? 'text-right' : 'text-center'}`}
                    >
                      {new Date(point.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                    </span>
                  ))}
                </div>
              </div>
              </div>
            </div>
          </div>
        </section>
        </div>

        <div className="xl:sticky xl:top-24">
          {calendarWidget}
        </div>
      </div>

      {/* Categories */}
      <section className={`${sf.panel}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className={sf.sectionLabel}>Per categoria</h2>
          {demoMode ? (
            <span className="text-xs font-bold text-brand">Vai ai contatti</span>
          ) : (
            <Link href={`/designs/simfonia/contacts${q}`} className="text-xs font-bold text-brand underline-offset-4 hover:underline">
              Vai ai contatti
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {categoryData.map((cat) => {
            const style = CATEGORY_STYLES[cat.slug] ?? { border: 'border-gray-200', accent: 'text-gray-700', bg: 'bg-gray-50' }
            const pctOfTotal = totalContacts > 0 ? (cat.total / totalContacts) * 100 : 0
            return (
              <Link
                key={cat.slug}
                href={`/designs/simfonia/contacts${q}&category=${cat.slug}`}
                className={`group rounded-[28px] border-2 ${style.border} bg-[var(--shell-surface)] p-5 shadow-[0_14px_28px_-24px_rgba(23,21,18,0.2)] transition hover:border-brand/25 hover:shadow-md`}
              >
                <p className={`text-[11px] font-bold uppercase tracking-wider ${style.accent}`}>{cat.label}</p>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className={`text-3xl font-black tabular-nums ${style.accent}`}>{formatInt(cat.total)}</span>
                  <span className="text-sm font-semibold tabular-nums text-[#c6beb2]">contatti</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#efe8de]">
                  <div className={`h-full rounded-full transition-colors ${style.bg}`} style={{ width: `${Math.min(pctOfTotal, 100)}%` }} />
                </div>
                <p className="mt-2 text-[11px] tabular-nums text-[var(--shell-muted)]">{pctOfTotal.toFixed(1)}% del totale</p>
                {cat.providers.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-[#efe8de] pt-3">
                    {cat.providers.slice(0, 6).map((p) => (
                      <div key={p.provider} className="flex items-center justify-between text-xs">
                        <span className="mr-2 truncate text-[var(--shell-muted)]">{p.provider}</span>
                        <span className="font-semibold tabular-nums text-[var(--foreground)]">{p.count}</span>
                      </div>
                    ))}
                    {cat.providers.length > 6 && <p className="text-[10px] text-[var(--shell-muted)]">+{cat.providers.length - 6} altri</p>}
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
            <div className="rounded-[22px] border border-dashed border-[var(--shell-line)] bg-[var(--shell-surface)] px-8 py-10 text-center">
              <p className="text-sm font-medium text-[var(--shell-muted)]">Nessuna gara configurata.</p>
              <p className="mt-1 text-xs text-[var(--shell-muted)]">Imposta obiettivi in Impostazioni → Gare mensili.</p>
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
                      <span className="text-3xl font-black tabular-nums text-[var(--foreground)]">{attivato}</span>
                      <span className="text-lg font-semibold tabular-nums text-[#c6beb2]">/ {g.obiettivo}</span>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#efe8de]">
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
