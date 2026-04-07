'use client'

import { useState } from 'react'
import { useDashboardData } from './DashboardDataProvider'
import WidgetShell from './WidgetShell'

interface Props {
  title?: string
  options: Record<string, unknown>
}

export default function ContactsTrendWidget({ title }: Props) {
  const { data } = useDashboardData()
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)

  if (!data) return null

  const contactsTrend = data.contactsTrend ?? []
  if (contactsTrend.length === 0) return null
  const now = new Date()
  const maxTrend = Math.max(...contactsTrend.map((p) => p.count), 1)
  const trendTotal = contactsTrend.reduce((sum, p) => sum + p.count, 0)
  const trendAverage = Number((trendTotal / Math.max(contactsTrend.length, 1)).toFixed(1))
  const trendToday = contactsTrend.at(-1)?.count ?? 0
  const trendTicks = [...new Set([maxTrend, Math.max(Math.round(maxTrend / 2), 1), 0])].sort((a, b) => b - a)

  const cx0 = 0, cx1 = 100, cy0 = 8, cy1 = 46, cvb = '0 0 100 54'
  const chartPoints = contactsTrend.map((point, index) => {
    const x = cx0 + (index / Math.max(contactsTrend.length - 1, 1)) * (cx1 - cx0)
    const y = cy1 - (point.count / maxTrend) * (cy1 - cy0)
    return { x, y, point }
  })
  const chartLine = chartPoints.map(({ x, y }) => `${x},${y}`).join(' ')
  const chartArea = `${cx0},${cy1} ${chartLine} ${cx1},${cy1}`
  const xLabelPoints = chartPoints.filter((_, i) => i === 0 || i === chartPoints.length - 1 || i % Math.ceil(contactsTrend.length / 6) === 0)

  return (
    <WidgetShell>
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--shell-muted)]">{title ?? 'Trend contatti'}</p>
            <h2 className="mt-1 text-lg font-bold text-[var(--foreground)]">Nuovi contatti</h2>
          </div>
          <span className="rounded-full bg-[var(--shell-canvas)] px-3 py-1 text-[11px] font-semibold capitalize text-[var(--shell-muted)]">
            {now.toLocaleDateString('it-IT', { month: 'long' })}
          </span>
        </div>
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
                  <linearGradient id="wTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.13" />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
                  </linearGradient>
                </defs>
                {trendTicks.map((value) => {
                  const gy = cy1 - (value / maxTrend) * (cy1 - cy0)
                  return <line key={value} x1={cx0} y1={gy} x2={cx1} y2={gy} stroke="color-mix(in srgb, var(--shell-line) 92%, transparent)" strokeWidth="1" />
                })}
                <polygon points={chartArea} fill="url(#wTrendFill)" />
                <polyline fill="none" stroke="var(--brand)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" points={chartLine} />
                {chartPoints.map(({ x, y, point }, index) => {
                  const isHovered = hoveredPoint === index
                  const showDot = point.count > 0 || isHovered
                  return (
                    <g key={point.date} onMouseEnter={() => setHoveredPoint(index)} onMouseLeave={() => setHoveredPoint(null)} className="cursor-pointer">
                      <circle cx={x} cy={y} r="4.5" fill="transparent" />
                      {showDot && <circle cx={x} cy={y} r={isHovered ? 2.5 : 1.8} fill="white" stroke="var(--brand)" strokeWidth={isHovered ? 1.8 : 1.35} />}
                    </g>
                  )
                })}
              </svg>
              <div className="mt-3 grid text-[11px] font-medium text-[var(--shell-muted)]" style={{ gridTemplateColumns: `repeat(${xLabelPoints.length}, minmax(0, 1fr))` }}>
                {xLabelPoints.map(({ point }, i) => (
                  <span key={point.date} className={i === 0 ? 'text-left' : i === xLabelPoints.length - 1 ? 'text-right' : 'text-center'}>
                    {new Date(point.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </WidgetShell>
  )
}
