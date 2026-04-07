'use client'

import { useDashboardData } from './DashboardDataProvider'
import WidgetShell from './WidgetShell'

function formatInt(value: number) {
  const sign = value < 0 ? '-' : ''
  const digits = Math.abs(Math.trunc(value)).toString()
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
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

interface Props {
  title?: string
  options: Record<string, unknown>
}

export default function KpiWidget({ title, options }: Props) {
  const { data } = useDashboardData()
  if (!data) return null

  const metric = (options.metric as string) ?? 'total_contacts'
  const now = new Date()
  const closedDays = new Set(data.closedDays ?? [])

  let value = ''
  let label = title ?? ''
  let accent = 'text-[var(--foreground)]'
  let sublabel = ''

  switch (metric) {
    case 'total_contacts':
      value = formatInt(data.totalContacts)
      label = label || 'Contatti totali'
      break
    case 'switch_out':
      value = String(data.switchOutTotal)
      label = label || 'Switch Out'
      accent = data.switchOutTotal > 0 ? 'text-red-600' : 'text-[var(--foreground)]'
      break
    case 'target':
      if (data.isAdmin) {
        value = formatInt(data.targetAnnuale)
        label = label || 'Target annuale'
        accent = 'text-brand'
      } else {
        const trend = data.contactsTrend ?? []
        const avg = trend.length > 0
          ? (trend.reduce((s, p) => s + p.count, 0) / trend.length).toFixed(1)
          : '0'
        value = avg
        label = label || 'Media/giorno'
      }
      break
    case 'progress': {
      const year = now.getFullYear()
      const jan1 = new Date(year, 0, 1)
      const dec31 = new Date(year, 11, 31)
      const wdPassed = countWorkingDays(jan1, now, closedDays)
      const wdTotal = countWorkingDays(jan1, dec31, closedDays)
      const pctTempo = Math.round((wdPassed / wdTotal) * 100)
      const pctContratti = data.targetAnnuale > 0 ? (data.totalContacts / data.targetAnnuale) * 100 : 0
      if (data.isAdmin) {
        value = `${pctContratti.toFixed(1)}%`
        label = label || '% Raggiunta'
        accent = 'text-brand'
        sublabel = `obiettivo: ${pctTempo}% atteso`
      } else {
        value = String((data.appointmentPreview ?? []).length)
        label = label || 'Appuntamenti'
      }
      break
    }
    default:
      value = '—'
      label = label || metric
  }

  return (
    <WidgetShell>
      <div className="p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--shell-muted)]">{label}</p>
        <p className={`mt-2 text-3xl font-black tabular-nums ${accent}`}>{value}</p>
        {sublabel && <p className="mt-1 text-xs text-[var(--shell-muted)]">{sublabel}</p>}
      </div>
    </WidgetShell>
  )
}
