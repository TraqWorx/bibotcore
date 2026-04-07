'use client'

import { useDashboardData } from './DashboardDataProvider'
import WidgetShell from './WidgetShell'

interface Props {
  title?: string
  options: Record<string, unknown>
}

export default function LeaderboardWidget({ title }: Props) {
  const { data } = useDashboardData()
  if (!data) return null

  const operators = data.operatorList ?? []

  if (operators.length === 0) {
    return (
      <WidgetShell title={title ?? 'Team'}>
        <div className="p-5 pt-3">
          <div className="rounded-xl border border-dashed border-[var(--shell-line)] bg-[var(--shell-canvas)] px-4 py-8 text-center text-sm text-[var(--shell-muted)]">
            Nessun operatore
          </div>
        </div>
      </WidgetShell>
    )
  }

  return (
    <WidgetShell title={title ?? 'Team'}>
      <div className="p-5 pt-3">
        <div className="space-y-2">
          {operators.map((op) => (
            <div key={op.name} className="flex items-center gap-3 rounded-xl bg-[var(--shell-soft)] px-3.5 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                {op.initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">{op.name}</p>
                {op.isAdmin && <p className="text-[10px] text-[var(--shell-muted)]">Admin</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </WidgetShell>
  )
}
