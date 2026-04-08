'use client'

import { useEffect, useState } from 'react'
import type { CustomWidgetConfig } from './types'
import { useDashboardFilters } from './DashboardFilterContext'
import WidgetShell from './WidgetShell'

interface Props {
  title?: string
  options: CustomWidgetConfig
}

function useWidgetData(locationId: string, config: CustomWidgetConfig, globalFilters?: { userId?: string }) {
  const [data, setData] = useState<unknown>(null)
  const [loading, setLoading] = useState(config.dataSource !== 'none')

  const filterUserId = globalFilters?.userId

  useEffect(() => {
    if (config.dataSource === 'none') { setLoading(false); return }
    let cancelled = false
    const filters = { ...config.filters }
    // Apply global user filter to relevant data sources
    if (filterUserId && (config.dataSource === 'contacts' || config.dataSource === 'opportunities')) {
      filters.assignedTo = filterUserId
    }
    fetch('/api/widgets/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId,
        dataSource: config.dataSource,
        endpoint: config.endpoint,
        filters,
      }),
    })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setData(d.data); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [locationId, config.dataSource, config.endpoint, config.filters, filterUserId])

  return { data, loading }
}

function extractItems(raw: unknown, dataSource: string): unknown[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>
  if (Array.isArray(obj.contacts)) return obj.contacts
  if (Array.isArray(obj.opportunities)) return obj.opportunities
  if (Array.isArray(obj.users)) return obj.users
  if (Array.isArray(obj.pipelines)) return obj.pipelines
  if (Array.isArray(obj.calendars)) return obj.calendars
  if (Array.isArray(obj.conversations)) return obj.conversations
  if (Array.isArray(obj.invoices)) return obj.invoices
  if (Array.isArray(obj.tags)) return obj.tags
  if (Array.isArray(obj.data)) return obj.data
  if (Array.isArray(raw)) return raw
  return []
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
}

function formatValue(val: unknown, format?: string): string {
  if (val == null) return '—'
  if (format === 'currency') return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
  if (format === 'number') return Number(val).toLocaleString()
  if (format === 'percent') return `${Number(val).toFixed(1)}%`
  if (format === 'date' && typeof val === 'string') return new Date(val).toLocaleDateString()
  return String(val)
}

// ── Static Widget ──
function StaticDisplay({ config }: { config: CustomWidgetConfig }) {
  const sc = config.staticContent
  if (!sc) return null

  if (sc.html) return <div className="p-5" dangerouslySetInnerHTML={{ __html: sc.html }} />

  return (
    <div className="p-5">
      {sc.value != null && <p className="text-3xl font-black" style={{ color: 'var(--foreground)' }}>{sc.value}</p>}
      {sc.subtitle && <p className="mt-1 text-xs" style={{ color: 'var(--shell-muted)' }}>{sc.subtitle}</p>}
    </div>
  )
}

// ── Computed Widget (working days, etc.) ──
function ComputedDisplay({ config }: { config: CustomWidgetConfig }) {
  const compute = config.compute
  if (!compute) return null

  let value: string | number = '—'
  let subtitle = ''

  if (compute === 'working_days_year') {
    const now = new Date()
    const year = now.getFullYear()
    let total = 0, elapsed = 0
    for (let d = new Date(year, 0, 1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
      const day = d.getDay()
      if (day !== 0 && day !== 6) {
        total++
        if (d <= now) elapsed++
      }
    }
    value = total
    subtitle = `${elapsed} elapsed — ${total - elapsed} remaining`
  } else if (compute === 'working_days_month') {
    const now = new Date()
    const year = now.getFullYear(), month = now.getMonth()
    let total = 0, elapsed = 0
    for (let d = new Date(year, month, 1); d.getMonth() === month; d.setDate(d.getDate() + 1)) {
      const day = d.getDay()
      if (day !== 0 && day !== 6) {
        total++
        if (d <= now) elapsed++
      }
    }
    value = total
    subtitle = `${elapsed} elapsed — ${total - elapsed} remaining`
  } else if (compute === 'current_date') {
    value = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } else if (compute === 'days_in_year') {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 0)
    const diff = now.getTime() - start.getTime()
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
    const isLeap = now.getFullYear() % 4 === 0
    value = `Day ${dayOfYear}`
    subtitle = `of ${isLeap ? 366 : 365}`
  }

  return (
    <div className="p-5">
      <p className="text-3xl font-black" style={{ color: 'var(--foreground)' }}>{value}</p>
      {subtitle && <p className="mt-1 text-xs" style={{ color: 'var(--shell-muted)' }}>{subtitle}</p>}
    </div>
  )
}

// ── Metric Widget ──
function MetricDisplay({ items, config }: { items: unknown[]; config: CustomWidgetConfig }) {
  const m = config.metric
  if (!m) return <div className="p-5 text-xs" style={{ color: 'var(--shell-muted)' }}>No metric configured</div>

  let value: number
  if (m.aggregation === 'count') {
    value = items.length
  } else if (m.aggregation === 'sum') {
    value = items.reduce<number>((s, item) => s + (Number(getNestedValue(item, m.field)) || 0), 0)
  } else if (m.aggregation === 'avg') {
    const sum = items.reduce<number>((s, item) => s + (Number(getNestedValue(item, m.field)) || 0), 0)
    value = items.length > 0 ? sum / items.length : 0
  } else {
    value = items.length
  }

  return (
    <div className="p-5">
      <p className="text-3xl font-black" style={{ color: 'var(--foreground)' }}>{formatValue(value, m.format)}</p>
      <p className="mt-1 text-xs font-medium" style={{ color: 'var(--shell-muted)' }}>{m.label}</p>
    </div>
  )
}

// ── Table Widget ──
function TableDisplay({ items, config }: { items: unknown[]; config: CustomWidgetConfig }) {
  const fields = config.fields ?? []
  if (fields.length === 0) return <div className="p-5 text-xs" style={{ color: 'var(--shell-muted)' }}>No fields configured</div>

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--shell-line)' }}>
            {fields.map((f) => (
              <th key={f.key} className="px-4 py-2 text-left font-semibold" style={{ color: 'var(--shell-muted)' }}>{f.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 20).map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--shell-line)' }}>
              {fields.map((f) => (
                <td key={f.key} className="px-4 py-2" style={{ color: 'var(--foreground)' }}>
                  {formatValue(getNestedValue(item, f.key), f.format)}
                </td>
              ))}
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={fields.length} className="px-4 py-6 text-center" style={{ color: 'var(--shell-muted)' }}>No data</td></tr>
          )}
        </tbody>
      </table>
      {items.length > 20 && <p className="px-4 py-2 text-[10px]" style={{ color: 'var(--shell-muted)' }}>Showing 20 of {items.length}</p>}
    </div>
  )
}

// ── List Widget ──
function ListDisplay({ items, config }: { items: unknown[]; config: CustomWidgetConfig }) {
  const fields = config.fields ?? []
  const primaryField = fields[0]
  const secondaryField = fields[1]

  return (
    <div className="divide-y" style={{ borderColor: 'var(--shell-line)' }}>
      {items.slice(0, 15).map((item, i) => (
        <div key={i} className="px-4 py-2.5">
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {primaryField ? String(getNestedValue(item, primaryField.key) ?? '—') : `Item ${i + 1}`}
          </p>
          {secondaryField && (
            <p className="text-xs" style={{ color: 'var(--shell-muted)' }}>
              {formatValue(getNestedValue(item, secondaryField.key), secondaryField.format)}
            </p>
          )}
        </div>
      ))}
      {items.length === 0 && <p className="px-4 py-6 text-center text-xs" style={{ color: 'var(--shell-muted)' }}>No data</p>}
    </div>
  )
}

// ── Bar Chart Widget ──
function BarChartDisplay({ items, config }: { items: unknown[]; config: CustomWidgetConfig }) {
  const chart = config.chart
  if (!chart) return null
  const data = items.slice(0, 10).map((item) => ({
    label: String(getNestedValue(item, chart.xField) ?? ''),
    value: Number(getNestedValue(item, chart.yField)) || 0,
  }))
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="flex items-end gap-1.5 px-4 py-4" style={{ height: '100%', minHeight: 120 }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md"
            style={{ height: `${(d.value / max) * 100}%`, minHeight: 4, backgroundColor: config.color ?? 'var(--brand)' }}
          />
          <span className="text-[9px] truncate w-full text-center" style={{ color: 'var(--shell-muted)' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Progress Widget ──
function ProgressDisplay({ config }: { config: CustomWidgetConfig }) {
  const p = config.progress
  if (!p) return null
  const pct = p.target > 0 ? Math.min((p.current / p.target) * 100, 100) : 0

  return (
    <div className="p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-black" style={{ color: 'var(--foreground)' }}>{p.current}</p>
        <p className="text-xs font-medium" style={{ color: 'var(--shell-muted)' }}>/ {p.target}</p>
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--shell-muted)' }}>{p.label}</p>
      <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--shell-soft)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: config.color ?? 'var(--brand)' }} />
      </div>
      <p className="mt-1 text-right text-[10px] font-semibold" style={{ color: 'var(--shell-muted)' }}>{pct.toFixed(0)}%</p>
    </div>
  )
}

// ── Main Custom Widget ──
export default function CustomWidget({ title, options }: Props) {
  const config = options as CustomWidgetConfig
  const { filters: globalFilters } = useDashboardFilters()
  // Get locationId from URL params or context
  const locationId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('locationId') ?? window.location.pathname.split('/').find((_, i, arr) => arr[i - 1] === 'locations' || arr[i - 1] === 'embed') ?? ''
    : ''

  const { data: rawData, loading } = useWidgetData(locationId, config, globalFilters)
  const items = extractItems(rawData, config.dataSource)

  // Static and computed widgets don't need GHL data
  if (config.displayType === 'static') {
    return <WidgetShell title={title}><StaticDisplay config={config} /></WidgetShell>
  }
  if (config.compute) {
    return <WidgetShell title={title}><ComputedDisplay config={config} /></WidgetShell>
  }

  if (loading) {
    return (
      <WidgetShell title={title}>
        <div className="flex items-center justify-center p-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200" style={{ borderTopColor: 'var(--brand)' }} />
        </div>
      </WidgetShell>
    )
  }

  return (
    <WidgetShell title={title}>
      {config.displayType === 'metric' && <MetricDisplay items={items} config={config} />}
      {config.displayType === 'table' && <TableDisplay items={items} config={config} />}
      {config.displayType === 'list' && <ListDisplay items={items} config={config} />}
      {config.displayType === 'bar_chart' && <BarChartDisplay items={items} config={config} />}
      {config.displayType === 'progress' && <ProgressDisplay config={config} />}
      {config.displayType === 'pie_chart' && <BarChartDisplay items={items} config={config} />}
      {config.displayType === 'line_chart' && <BarChartDisplay items={items} config={config} />}
    </WidgetShell>
  )
}
