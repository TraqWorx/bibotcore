'use client'

import { useEffect, useRef, useState } from 'react'
import type { CustomWidgetConfig, CustomDataSource } from './types'
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
    const load = () => {
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
    }
    load()
    // Live refresh — keep the dashboard current without a manual reload. The
    // sandboxed iframe only reloads when the data actually changes (identical
    // data → identical srcDoc string → React skips the DOM update).
    const iv = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(iv) }
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
  if (Array.isArray(obj.forms)) return obj.forms
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

// ── Sandboxed HTML/CSS/JS widget ──
// Renders user/AI-authored HTML + CSS + JS inside a sandboxed iframe (scripts
// allowed, NO same-origin) so it can pull in any CDN library and run freely
// WITHOUT access to the parent page's cookies/session or other clients' data.
// The widget's GHL data is injected as window.WIDGET_DATA; the iframe auto-sizes
// to its content via postMessage.
function buildSrcDoc(html: string, data: unknown): string {
  const dataJson = JSON.stringify(data ?? null).replace(/</g, '\\u003c')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script>window.WIDGET_DATA=${dataJson};</script>
<style>html,body{margin:0;padding:0;background:transparent;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a}</style>
</head><body>
${html}
<script>(function(){function h(){var b=document.body,e=document.documentElement;parent.postMessage({__gcd_h:Math.max(b.scrollHeight,e.scrollHeight,b.offsetHeight)},'*')}window.addEventListener('load',h);setTimeout(h,150);setTimeout(h,700);setTimeout(h,1800);try{new ResizeObserver(h).observe(document.body)}catch(e){}})();</script>
</body></html>`
}

function HtmlSandbox({ html, data }: { html: string; data?: unknown }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(160)
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (ref.current && e.source === ref.current.contentWindow && e.data && typeof e.data.__gcd_h === 'number') {
        setHeight(Math.min(3000, Math.max(40, e.data.__gcd_h)))
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])
  return (
    <iframe
      ref={ref}
      sandbox="allow-scripts allow-popups"
      srcDoc={buildSrcDoc(html, data)}
      style={{ width: '100%', height, border: 0, display: 'block' }}
      title="widget"
    />
  )
}

// ── Static Widget ──
function StaticDisplay({ config, items }: { config: CustomWidgetConfig; items: unknown[] }) {
  const sc = config.staticContent
  if (!sc) return null

  if (sc.html) {
    const hasData = config.dataSource && config.dataSource !== 'none'
    return <HtmlSandbox html={sc.html} data={hasData ? items : undefined} />
  }

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

// ── Dropdown Widget ──
function DropdownDisplay({ items, config }: { items: unknown[]; config: CustomWidgetConfig }) {
  const [selected, setSelected] = useState<number>(0)
  const dd = config.dropdown
  if (!dd) return null

  const options = items.map((item, i) => ({
    label: String(getNestedValue(item, dd.labelField) ?? `Item ${i + 1}`),
    item,
  }))
  const current = options[selected]?.item

  return (
    <div className="p-4">
      <select
        value={selected}
        onChange={(e) => setSelected(Number(e.target.value))}
        className="w-full rounded-lg border px-3 py-2 text-sm font-medium outline-none"
        style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-soft)', color: 'var(--foreground)' }}
      >
        {options.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
      </select>
      {current != null && dd.detailFields && (
        <div className="mt-3 space-y-2">
          {dd.detailFields.map((f) => (
            <div key={f.key} className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--shell-line)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--shell-muted)' }}>{f.label}</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{String(formatValue(getNestedValue(current, f.key), f.format))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tabs Widget ──
function TabsDisplay({ config, locationId, globalFilters }: { config: CustomWidgetConfig; locationId: string; globalFilters?: { userId?: string } }) {
  const [activeTab, setActiveTab] = useState(0)
  const tabs = config.tabs
  if (!tabs?.length) return null

  const activeConfig = tabs[activeTab]

  return (
    <div>
      <div className="flex border-b" style={{ borderColor: 'var(--shell-line)' }}>
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className="px-4 py-2 text-xs font-semibold transition-colors"
            style={{
              color: i === activeTab ? 'var(--brand)' : 'var(--shell-muted)',
              borderBottom: i === activeTab ? '2px solid var(--brand)' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <TabContent key={activeTab} tab={activeConfig} locationId={locationId} globalFilters={globalFilters} />
    </div>
  )
}

function TabContent({ tab, locationId, globalFilters }: { tab: { dataSource: CustomDataSource; fields?: { key: string; label: string; format?: string }[]; metric?: { field: string; label: string; aggregation?: 'count' | 'sum' | 'avg'; format?: string } }; locationId: string; globalFilters?: { userId?: string } }) {
  const tabConfig = { displayType: tab.metric ? 'metric' : 'table', dataSource: tab.dataSource, fields: tab.fields, metric: tab.metric } as CustomWidgetConfig
  const { data: rawData, loading } = useWidgetData(locationId, tabConfig, globalFilters)
  const items = extractItems(rawData, tab.dataSource)

  if (loading) return <div className="flex items-center justify-center p-6"><div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200" style={{ borderTopColor: 'var(--brand)' }} /></div>
  if (tab.metric) return <MetricDisplay items={items} config={tabConfig} />
  return <TableDisplay items={items} config={tabConfig} />
}

// ── Cards Grid Widget ──
function CardsGridDisplay({ items, config }: { items: unknown[]; config: CustomWidgetConfig }) {
  const cg = config.cardsGrid
  if (!cg) return null
  const cols = cg.columns ?? 3

  return (
    <div className="p-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.slice(0, 20).map((item, i) => (
        <div key={i} className="rounded-xl border p-3 transition hover:shadow-md" style={{ borderColor: 'var(--shell-line)', backgroundColor: 'var(--shell-soft)' }}>
          {cg.imageField && getNestedValue(item, cg.imageField) != null && (
            <div className="h-8 w-8 rounded-full mb-2 bg-cover bg-center" style={{ backgroundImage: `url(${String(getNestedValue(item, cg.imageField))})` }} />
          )}
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {String(getNestedValue(item, cg.labelField) ?? `Item ${i + 1}`)}
          </p>
          {cg.valueField && (
            <p className="mt-0.5 text-lg font-black" style={{ color: 'var(--brand)' }}>
              {String(getNestedValue(item, cg.valueField) ?? '—')}
            </p>
          )}
          {cg.subtitleField && (
            <p className="text-[11px]" style={{ color: 'var(--shell-muted)' }}>
              {String(getNestedValue(item, cg.subtitleField) ?? '')}
            </p>
          )}
        </div>
      ))}
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

  // Static (sandboxed HTML/CSS/JS) widget. If it binds a data source, wait for
  // the data so it can be injected into the sandbox as window.WIDGET_DATA.
  if (config.displayType === 'static') {
    const isHtml = !!config.staticContent?.html
    const spinner = <div className="flex items-center justify-center p-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200" style={{ borderTopColor: 'var(--brand)' }} /></div>
    if (config.dataSource && config.dataSource !== 'none' && loading) {
      return isHtml ? spinner : <WidgetShell title={title}>{spinner}</WidgetShell>
    }
    // Full-bleed HTML widgets carry their own complete card design — render them
    // WITHOUT the outer shell/title so we don't stack a redundant heading on top
    // of the AI-authored header.
    if (isHtml) return <StaticDisplay config={config} items={items} />
    return <WidgetShell title={title}><StaticDisplay config={config} items={items} /></WidgetShell>
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

  // Tabs need special handling — they fetch their own data per tab
  if (config.displayType === 'tabs') {
    return <WidgetShell title={title}><TabsDisplay config={config} locationId={locationId} globalFilters={globalFilters} /></WidgetShell>
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
      {config.displayType === 'dropdown' && <DropdownDisplay items={items} config={config} />}
      {config.displayType === 'cards_grid' && <CardsGridDisplay items={items} config={config} />}
    </WidgetShell>
  )
}
