'use client'

import { useDashboardData } from './DashboardDataProvider'
import WidgetShell from './WidgetShell'

interface Props {
  title?: string
  options: Record<string, unknown>
}

export default function PipelineFunnelWidget({ title }: Props) {
  const { data } = useDashboardData()
  if (!data) return null

  return (
    <WidgetShell title={title ?? 'Pipeline'}>
      <div className="p-5 pt-3">
        <div className="rounded-xl border border-dashed border-[var(--shell-line)] bg-[var(--shell-canvas)] px-4 py-8 text-center text-sm text-[var(--shell-muted)]">
          Pipeline funnel — coming soon
        </div>
      </div>
    </WidgetShell>
  )
}
