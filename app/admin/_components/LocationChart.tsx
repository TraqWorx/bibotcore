'use client'

import { useState, useMemo } from 'react'

type Mode = 'week' | 'month' | 'range'

interface ChartPoint {
  date: string
  xLabel: string
  cumulative: number
  daily: number
}

export default function LocationChart({ allDates }: { allDates: string[] }) {
  const [mode, setMode] = useState<Mode>('month')
  const [offset, setOffset] = useState(0)
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const { points, periodLabel, delta } = useMemo(() => {
    if (mode === 'range') {
      if (!rangeFrom || !rangeTo) {
        return { points: [] as ChartPoint[], periodLabel: '', delta: 0 }
      }
      const startDate = new Date(rangeFrom + 'T00:00:00')
      const endDate = new Date(rangeTo + 'T00:00:00')
      if (endDate < startDate) {
        return { points: [] as ChartPoint[], periodLabel: 'Invalid range', delta: 0 }
      }
      const dayCount = Math.min(
        Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1,
        366
      )
      const pts: ChartPoint[] = []
      for (let i = 0; i < dayCount; i++) {
        const d = new Date(startDate)
        d.setDate(d.getDate() + i)
        const dayISO = d.toISOString().split('T')[0]
        const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const xLabel =
          dayCount <= 7
            ? d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + d.getDate()
            : dateLabel
        const cumulative = allDates.filter((dt) => (dt.split('T')[0] || dt) <= dayISO).length
        const daily = allDates.filter((dt) => (dt.split('T')[0] || dt) === dayISO).length
        pts.push({ date: dateLabel, xLabel, cumulative, daily })
      }
      const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return {
        points: pts,
        periodLabel: `${fmt(startDate)} – ${fmt(endDate)}`,
        delta: pts.reduce((s, p) => s + p.daily, 0),
      }
    }

    // Week / Month
    const windowDays = mode === 'week' ? 7 : 30
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() - offset * windowDays)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - (windowDays - 1))

    const pts: ChartPoint[] = []
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      const dayISO = d.toISOString().split('T')[0]
      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const xLabel =
        mode === 'week'
          ? d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + d.getDate()
          : dateLabel
      const cumulative = allDates.filter((dt) => (dt.split('T')[0] || dt) <= dayISO).length
      const daily = allDates.filter((dt) => (dt.split('T')[0] || dt) === dayISO).length
      pts.push({ date: dateLabel, xLabel, cumulative, daily })
    }

    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return {
      points: pts,
      periodLabel: `${fmt(startDate)} – ${fmt(endDate)}`,
      delta: pts.reduce((s, p) => s + p.daily, 0),
    }
  }, [allDates, mode, offset, rangeFrom, rangeTo])

  const W = 700
  const H = 220
  const PL = 44, PR = 16, PT = 16, PB = 36
  const chartW = W - PL - PR
  const chartH = H - PT - PB

  const maxVal = Math.max(...(points.length ? points.map((d) => d.cumulative) : [0]), 1)
  const niceMax = (() => {
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)))
    const nice = [1, 2, 5, 10].map((m) => m * magnitude).find((c) => c >= maxVal) ?? maxVal
    return Math.max(nice, 5)
  })()

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * niceMax))

  const toX = (i: number) =>
    points.length <= 1 ? PL + chartW / 2 : PL + (i / (points.length - 1)) * chartW
  const toY = (v: number) => PT + chartH - (v / niceMax) * chartH

  const pts = points.map((d, i) => ({ x: toX(i), y: toY(d.cumulative) }))

  let linePath = pts.length ? `M ${pts[0].x} ${pts[0].y}` : ''
  for (let i = 1; i < pts.length; i++) {
    const dx = (pts[i].x - pts[i - 1].x) * 0.45
    linePath += ` C ${pts[i - 1].x + dx} ${pts[i - 1].y}, ${pts[i].x - dx} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`
  }
  const areaPath = pts.length
    ? linePath + ` L ${pts[pts.length - 1].x} ${PT + chartH} L ${pts[0].x} ${PT + chartH} Z`
    : ''

  const step = Math.max(1, Math.floor(points.length / 7))
  const xTicks = points
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % step === 0 || i === points.length - 1)

  const hov = hoverIdx !== null ? pts[hoverIdx] : null

  return (
    <div className="select-none">
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Left: period label / range inputs */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          {mode === 'range' ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5">
              <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
              </svg>
              <input
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="w-[110px] bg-transparent text-xs text-gray-600 outline-none"
              />
              <span className="text-gray-300">–</span>
              <input
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                className="w-[110px] bg-transparent text-xs text-gray-600 outline-none"
              />
              {(rangeFrom || rangeTo) && (
                <button
                  onClick={() => { setRangeFrom(''); setRangeTo('') }}
                  className="ml-1 text-base leading-none text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs font-medium text-gray-500 truncate">{periodLabel}</span>
          )}
          {delta > 0 && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
              +{delta} this period
            </span>
          )}
        </div>

        {/* Right: nav + toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          {mode !== 'range' && (
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
              onClick={() => setOffset((o) => o + 1)}
            >
              ‹
            </button>
          )}
          <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-medium">
            {(['week', 'month', 'range'] as Mode[]).map((m) => (
              <button
                key={m}
                className={`px-3 py-1.5 capitalize transition-colors ${
                  mode === m ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
                onClick={() => { setMode(m); setOffset(0) }}
              >
                {m === 'range' ? 'Date Range' : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          {mode !== 'range' && (
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
              disabled={offset === 0}
              onClick={() => setOffset((o) => o - 1)}
            >
              ›
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      {allDates.length === 0 || (mode === 'range' && (!rangeFrom || !rangeTo)) ? (
        <div className="flex items-center justify-center text-sm text-gray-300" style={{ height: H }}>
          {allDates.length === 0 ? 'No location data yet' : 'Select a date range above'}
        </div>
      ) : (
        /* Wrapper keeps the aspect ratio so chart fills full card width */
        <div className="w-full" style={{ aspectRatio: `${W} / ${H}` }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
                <stop offset="55%" stopColor="var(--brand)" stopOpacity="0.06" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
              </linearGradient>
              <filter id="tipShadow" x="-25%" y="-25%" width="150%" height="150%">
                <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#00000028" />
              </filter>
            </defs>

            {/* Grid + Y labels */}
            {yTicks.map((v) => (
              <g key={v}>
                <line
                  x1={PL} y1={toY(v)} x2={PL + chartW} y2={toY(v)}
                  stroke={v === 0 ? '#e5e7eb' : '#f3f0ff'}
                  strokeWidth={v === 0 ? 1.5 : 1}
                />
                <text x={PL - 8} y={toY(v) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                  {v}
                </text>
              </g>
            ))}

            {/* X labels */}
            {xTicks.map(({ d, i }) => (
              <text
                key={i}
                x={toX(i)} y={PT + chartH + 22}
                textAnchor="middle" fontSize="10" fill="#9ca3af"
              >
                {d.xLabel}
              </text>
            ))}

            {/* Area + line */}
            <path d={areaPath} fill="url(#chartGrad)" />
            <path
              d={linePath} fill="none"
              stroke="var(--brand)" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            />

            {/* Hover hit zones */}
            {points.map((_, i) => {
              const x0 = i === 0 ? PL : (pts[i - 1].x + pts[i].x) / 2
              const x1 = i === points.length - 1 ? PL + chartW : (pts[i].x + pts[i + 1].x) / 2
              return (
                <rect
                  key={i}
                  x={x0} y={PT} width={x1 - x0} height={chartH}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                />
              )
            })}

            {/* Hover indicator + tooltip */}
            {hov && hoverIdx !== null && (() => {
              const p = points[hoverIdx]
              const tw = 140
              const th = p.daily > 0 ? 62 : 48
              const tx = Math.min(Math.max(hov.x - tw / 2, PL), PL + chartW - tw)
              const ty = Math.max(hov.y - th - 14, PT)
              return (
                <>
                  <line
                    x1={hov.x} y1={PT} x2={hov.x} y2={PT + chartH}
                    stroke="var(--brand)" strokeWidth="1" strokeDasharray="4 3" opacity="0.35"
                  />
                  <circle cx={hov.x} cy={hov.y} r="9" fill="var(--brand)" fillOpacity="0.1" />
                  <circle cx={hov.x} cy={hov.y} r="4.5" fill="white" stroke="var(--brand)" strokeWidth="2.5" />
                  <g filter="url(#tipShadow)">
                    <rect x={tx} y={ty} width={tw} height={th} rx={8} fill="#18183a" />
                  </g>
                  <text x={tx + tw / 2} y={ty + 15} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.45)">
                    {p.date}
                  </text>
                  <text x={tx + tw / 2} y={ty + 33} textAnchor="middle" fontSize="13" fontWeight="700" fill="white">
                    {p.cumulative} total
                  </text>
                  {p.daily > 0 && (
                    <text x={tx + tw / 2} y={ty + 51} textAnchor="middle" fontSize="10.5" fill="#6ee7b7">
                      +{p.daily} added
                    </text>
                  )}
                </>
              )
            })()}
          </svg>
        </div>
      )}
    </div>
  )
}
