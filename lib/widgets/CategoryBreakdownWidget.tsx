'use client'

import { useDashboardData } from './DashboardDataProvider'
import WidgetShell from './WidgetShell'

const CATEGORY_STYLES: Record<string, { border: string; accent: string; bg: string }> = {
  telefonia:       { border: 'border-[var(--shell-line)]', accent: 'text-brand', bg: 'bg-[var(--shell-soft)]' },
  energia:         { border: 'border-[#f0debb]', accent: 'text-[#9a6f1f]', bg: 'bg-[#fbf4e2]' },
  connettivita:    { border: 'border-[#cfe5d3]', accent: 'text-[#4f8662]', bg: 'bg-[#eaf5ec]' },
  intrattenimento: { border: 'border-[#e6ddf1]', accent: 'text-[#7d66ad]', bg: 'bg-[#f3eef9]' },
}

interface Props {
  title?: string
  options: Record<string, unknown>
}

export default function CategoryBreakdownWidget({ title }: Props) {
  const { data } = useDashboardData()
  if (!data) return null

  const categoryData = data.categoryData ?? []
  const totalContacts = data.totalContacts ?? 0
  if (categoryData.length === 0) return null

  return (
    <WidgetShell title={title ?? 'Per categoria'}>
      <div className="p-5 pt-3">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {categoryData.map((cat) => {
            const style = CATEGORY_STYLES[cat.slug] ?? { border: 'border-[var(--shell-line)]', accent: 'text-[var(--shell-muted)]', bg: 'bg-[var(--shell-soft)]' }
            const pctOfTotal = totalContacts > 0 ? (cat.total / totalContacts) * 100 : 0
            return (
              <div
                key={cat.slug}
                className={`rounded-[28px] border-2 ${style.border} bg-[var(--shell-surface)] p-5 shadow-[0_14px_28px_-24px_rgba(23,21,18,0.2)]`}
              >
                <p className={`text-[11px] font-bold uppercase tracking-wider ${style.accent}`}>{cat.label}</p>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className={`text-3xl font-black tabular-nums ${style.accent}`}>{cat.total.toLocaleString('it-IT')}</span>
                  <span className="text-sm font-semibold tabular-nums text-[#c6beb2]">contatti</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#efe8de]">
                  <div className={`h-full rounded-full ${style.bg}`} style={{ width: `${Math.min(pctOfTotal, 100)}%` }} />
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
              </div>
            )
          })}
        </div>
      </div>
    </WidgetShell>
  )
}
