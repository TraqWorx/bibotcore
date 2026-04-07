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

export default function GareMensiliWidget({ title }: Props) {
  const { data } = useDashboardData()
  if (!data || !data.isAdmin || !data.gareRows?.length) return null

  const now = new Date()
  const closedDays = new Set(data.closedDays ?? [])
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const mwdPassed = countWorkingDays(monthStart, now, closedDays)
  const mwdTotal = countWorkingDays(monthStart, monthEnd, closedDays)
  const mwdPct = mwdTotal > 0 ? Math.round((mwdPassed / mwdTotal) * 100) : 0

  return (
    <WidgetShell title={title ?? `Gare — ${now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}`}>
      <div className="p-5 pt-3">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(data.gareRows.length, 4)}, minmax(0, 1fr))` }}>
          {data.gareRows.map((g) => {
            const attivato = 0
            const pctRaggiunta = g.obiettivo > 0 ? (attivato / g.obiettivo) * 100 : 0
            const isOnTrack = pctRaggiunta >= mwdPct
            return (
              <div
                key={g.categoria}
                className={`rounded-[28px] border p-5 shadow-[0_14px_28px_-24px_rgba(23,21,18,0.2)] ${isOnTrack ? 'border-emerald-200/80' : 'border-red-200/80'}`}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--shell-muted)] capitalize">{g.categoria}</p>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black tabular-nums text-[var(--foreground)]">{attivato}</span>
                  <span className="text-lg font-semibold tabular-nums text-[#c6beb2]">/ {g.obiettivo}</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#efe8de]">
                  <div className={`h-full rounded-full ${isOnTrack ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(pctRaggiunta, 100)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </WidgetShell>
  )
}
