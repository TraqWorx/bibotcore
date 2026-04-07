'use client'

import { useDashboardData } from './DashboardDataProvider'
import WidgetShell from './WidgetShell'

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

interface Props {
  title?: string
  options: Record<string, unknown>
}

export default function PerformanceOverviewWidget({ title }: Props) {
  const { data } = useDashboardData()
  if (!data || !data.isAdmin) return null

  const now = new Date()
  const year = now.getFullYear()
  const closedDays = new Set(data.closedDays ?? [])
  const jan1 = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)
  const wdPassed = countWorkingDays(jan1, now, closedDays)
  const wdTotal = countWorkingDays(jan1, dec31, closedDays)
  const wdRemaining = wdTotal - wdPassed
  const pctTempo = Math.round((wdPassed / wdTotal) * 100)
  const pctContratti = data.targetAnnuale > 0 ? (data.totalContacts / data.targetAnnuale) * 100 : 0
  const diff = pctContratti - pctTempo

  const perfStatus: 'green' | 'yellow' | 'red' = diff > 2 ? 'green' : diff >= -2 ? 'yellow' : 'red'
  const perfConfig = {
    green:  { panel: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-900', pill: 'bg-emerald-200/80 text-emerald-900', label: 'In target' },
    yellow: { panel: 'border-amber-200/80 bg-amber-50/80 text-amber-950', pill: 'bg-amber-200/80 text-amber-950', label: 'Attenzione' },
    red:    { panel: 'border-red-200/80 bg-red-50/80 text-red-950', pill: 'bg-red-200/80 text-red-950', label: 'Sotto target' },
  }[perfStatus]

  return (
    <div className={`rounded-[28px] border p-6 shadow-[0_18px_34px_-28px_rgba(23,21,18,0.22)] ${perfConfig.panel}`}>
      {title && <p className="mb-3 text-xs font-semibold uppercase tracking-widest opacity-60">{title}</p>}
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
  )
}
