'use client'

import { useState, useCallback, useMemo, Suspense } from 'react'
import { GridLayout, useContainerWidth, verticalCompactor, type Layout, type LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import type { DashboardLayout, DashboardColors, WidgetConfig, WidgetType } from '@/lib/widgets/types'
import { WIDGET_META, BUILDER_WIDGET_TYPES, PRESET_WIDGETS, getWidgetComponent } from '@/lib/widgets/registry'
import { DashboardDataProvider } from '@/lib/widgets/DashboardDataProvider'
import { resolveSimfoniaShell } from '@/lib/simfonia/shellTheme'
import { DEFAULT_THEME } from '@/lib/types/design'

interface Props {
  locationId: string
  initialLayout: DashboardLayout | null
  initialColors: DashboardColors | null
  initialTemplates?: WidgetConfig[]
  onSave: (layout: DashboardLayout, colors: DashboardColors, templates?: WidgetConfig[]) => Promise<{ error: string } | undefined>
  onClear?: () => Promise<{ error: string } | undefined>
  isPro?: boolean
}

const DEFAULT_HEIGHTS: Partial<Record<WidgetType, number>> = {
  contacts_trend: 5,
  agenda_preview: 6,
  pipeline_funnel: 5,
  leaderboard: 5,
  custom: 4,
}

function widgetsToGridLayout(widgets: WidgetConfig[]): LayoutItem[] {
  let x = 0
  let y = 0
  return widgets.map((w) => {
    const span = w.span ?? 12
    const h = DEFAULT_HEIGHTS[w.type] ?? 4
    if (x + span > 12) { x = 0; y += h }
    const item: LayoutItem = { i: w.id, x, y, w: span, h, minW: 2, maxW: 12, minH: 2 }
    x += span
    if (x >= 12) { x = 0; y += h }
    return item
  })
}

export default function DashboardBuilder({ locationId, initialLayout, initialColors, initialTemplates, onSave, onClear, isPro }: Props) {
  const { containerRef, width: containerWidth, mounted } = useContainerWidth()
  const [widgets, setWidgets] = useState<WidgetConfig[]>(initialLayout?.widgets ?? [])
  const [gridLayouts, setGridLayouts] = useState<LayoutItem[]>(() => widgetsToGridLayout(initialLayout?.widgets ?? []))
  const [colors, setColors] = useState<DashboardColors>({
    primaryColor: initialColors?.primaryColor ?? '#1a1a2e',
    secondaryColor: initialColors?.secondaryColor ?? '#6366f1',
  })
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null)
  const [customTemplates, setCustomTemplates] = useState<WidgetConfig[]>(initialTemplates ?? [])

  // AI chat state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string; widgets?: WidgetConfig[] }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const selectedWidget = widgets.find((w) => w.id === selectedWidgetId) ?? null

  // Stable config objects to avoid re-render loops
  const [gridConfig] = useState({ cols: 12, rowHeight: 80, margin: [12, 12] as const })
  const [dragConfig] = useState({ enabled: true, handle: '.drag-handle' })
  const [resizeConfig] = useState({ enabled: true })

  const addWidget = useCallback((type: WidgetType) => {
    const meta = WIDGET_META[type]
    const id = `${type}-${Date.now()}`
    const config: WidgetConfig = { id, type, title: meta.label, span: meta.defaultSpan, options: {} }
    setWidgets((prev) => [...prev, config])
    const maxY = gridLayouts.reduce((max, l) => Math.max(max, l.y + l.h), 0)
    const h = DEFAULT_HEIGHTS[type] ?? 4
    setGridLayouts((prev) => [...prev, { i: id, x: 0, y: maxY, w: meta.defaultSpan, h, minW: 2, maxW: 12, minH: 2 }])
    setSelectedWidgetId(id)
  }, [gridLayouts])

  const addWidgetConfig = useCallback((config: WidgetConfig) => {
    setWidgets((prev) => [...prev, config])
    const maxY = gridLayouts.reduce((max, l) => Math.max(max, l.y + l.h), 0)
    const h = DEFAULT_HEIGHTS[config.type] ?? 4
    setGridLayouts((prev) => [...prev, { i: config.id, x: 0, y: maxY, w: config.span ?? 6, h, minW: 2, maxW: 12, minH: 2 }])
  }, [gridLayouts])

  const addFromAi = useCallback((config: WidgetConfig) => {
    // Add to dashboard
    addWidgetConfig(config)
    // Save as reusable template (use a stable template ID based on title + type)
    const templateId = `tpl-${config.type}-${(config.title ?? '').replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`
    const template: WidgetConfig = { ...config, id: templateId }
    setCustomTemplates((prev) => {
      // Don't add duplicates by title+type
      if (prev.some((t) => t.title === config.title && t.type === config.type)) return prev
      return [...prev, template]
    })
  }, [addWidgetConfig])

  const removeWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id))
    setGridLayouts((prev) => prev.filter((l) => l.i !== id))
    if (selectedWidgetId === id) setSelectedWidgetId(null)
  }, [selectedWidgetId])

  const updateWidget = useCallback((id: string, updates: Partial<WidgetConfig>) => {
    setWidgets((prev) => prev.map((w) => w.id === id ? { ...w, ...updates } : w))
  }, [])

  const handleLayoutChange = useCallback((newLayout: Layout) => {
    setGridLayouts((prev) => {
      // Skip if nothing changed (prevents infinite re-render loop)
      const changed = newLayout.length !== prev.length || newLayout.some((item, i) => {
        const old = prev[i]
        return !old || item.i !== old.i || item.x !== old.x || item.y !== old.y || item.w !== old.w || item.h !== old.h
      })
      if (!changed) return prev
      return [...newLayout]
    })
    setWidgets((prev) => {
      let changed = false
      const next = prev.map((w) => {
        const gl = newLayout.find((l) => l.i === w.id)
        if (gl && gl.w !== w.span) { changed = true; return { ...w, span: gl.w } }
        return w
      })
      return changed ? next : prev
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const finalWidgets = widgets.map((w) => {
      const gl = gridLayouts.find((l) => l.i === w.id)
      return { ...w, span: gl?.w ?? w.span }
    })
    const result = await onSave({ columns: 12, widgets: finalWidgets, colors }, colors, customTemplates)
    if (result?.error) setSaveError(result.error)
    setSaving(false)
  }

  const handleClear = async () => {
    if (!onClear || !confirm('Remove all widgets and reset the dashboard?')) return
    setClearing(true)
    setSaveError(null)
    const result = await onClear()
    if (result?.error) setSaveError(result.error)
    else { setWidgets([]); setGridLayouts([]); setSelectedWidgetId(null) }
    setClearing(false)
  }

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = chatInput.trim()
    setChatInput('')
    const newMessages = [...chatMessages, { role: 'user' as const, content: userMsg }]
    setChatMessages(newMessages)
    setChatLoading(true)

    try {
      const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/ai/widget-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, locationId }),
      })
      if (res.ok) {
        const { reply, widgets: aiWidgets } = await res.json()
        const parsedWidgets = (aiWidgets ?? []).map((w: WidgetConfig) => ({
          ...w,
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        }))
        setChatMessages([...newMessages, { role: 'assistant', content: reply, widgets: parsedWidgets.length > 0 ? parsedWidgets : undefined }])
      } else {
        const data = await res.json().catch(() => ({}))
        setChatMessages([...newMessages, { role: 'assistant', content: data.error ?? 'Something went wrong. Try again.' }])
      }
    } catch {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Network error. Please try again.' }])
    }
    setChatLoading(false)
  }

  // Theme for live rendering
  const theme = useMemo(() => ({
    ...DEFAULT_THEME,
    primaryColor: colors.primaryColor ?? DEFAULT_THEME.primaryColor,
    secondaryColor: colors.secondaryColor ?? DEFAULT_THEME.secondaryColor,
  }), [colors])
  const shell = useMemo(() => resolveSimfoniaShell(theme), [theme])
  const cssVars = useMemo(() => ({
    '--brand': theme.secondaryColor,
    '--accent': theme.secondaryColor,
    '--foreground': shell.foreground,
    '--shell-bg': shell.shellBg,
    '--shell-surface': shell.shellSurface,
    '--shell-canvas': shell.shellCanvas,
    '--shell-muted': shell.shellMuted,
    '--shell-line': shell.shellLine,
    '--shell-soft': shell.shellSoft,
    '--shell-soft-alt': shell.shellSoftAlt,
    '--shell-tint': shell.shellTint,
    '--shell-tint-strong': shell.shellTintStrong,
    '--shell-sidebar': shell.shellSidebar,
  } as React.CSSProperties), [theme, shell])

  return (
    <div className="space-y-6">
      {/* AI Chat (Pro) */}
      {isPro && (
        <div className="rounded-2xl border border-brand/15 bg-brand/5">
          <button
            onClick={() => setChatOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4"
          >
            <div>
              <h3 className="text-sm font-bold text-gray-900">AI Dashboard Designer</h3>
              <p className="mt-0.5 text-xs text-gray-500">Chat with AI to create any widget you need</p>
            </div>
            <svg className={`h-5 w-5 text-gray-400 transition ${chatOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>

          {chatOpen && (
            <div className="border-t border-brand/10 px-5 pb-5">
              {/* Chat messages */}
              {chatMessages.length > 0 && (
                <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
                  {chatMessages.map((msg, i) => (
                    <div key={i}>
                      <div className={`rounded-xl px-4 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'ml-12 bg-brand/10 text-gray-900'
                          : 'mr-4 bg-white border border-gray-100 text-gray-700'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {/* Widget previews from AI */}
                      {msg.widgets && msg.widgets.length > 0 && (
                        <DashboardDataProvider locationId={locationId}>
                          <div className="mt-2 mr-4 grid gap-2" style={{ ...cssVars, gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
                            {msg.widgets.map((w, j) => {
                              const Component = getWidgetComponent(w.type)
                              return (
                                <div key={j} style={{ gridColumn: `span ${Math.min(w.span ?? 6, 12)}` }} className="relative group">
                                  <div className="overflow-hidden rounded-xl border border-[var(--shell-line)]" style={{ backgroundColor: 'var(--shell-surface)' }}>
                                    <div className="h-40 overflow-hidden">
                                      {Component && (
                                        <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="h-4 w-16 animate-pulse rounded" style={{ backgroundColor: 'var(--shell-soft)' }} /></div>}>
                                          <Component title={w.title} options={w.options ?? {}} />
                                        </Suspense>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => addFromAi({ ...w, id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })}
                                    className="absolute bottom-2 right-2 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90 opacity-0 group-hover:opacity-100"
                                  >
                                    + Add
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </DashboardDataProvider>
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="mr-4 rounded-xl bg-white border border-gray-100 px-4 py-3">
                      <div className="flex gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chat input */}
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend() } }}
                  placeholder="e.g. Show me a table of contacts with name and email"
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
                  disabled={chatLoading}
                />
                <button
                  onClick={handleChatSend}
                  disabled={chatLoading || !chatInput.trim()}
                  className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      <div className="flex gap-6">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-64 shrink-0">
            <div className="sticky top-4 space-y-4">
              {/* Widget picker or widget editor */}
              {selectedWidget ? (
                <div className="rounded-2xl border border-brand/20 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-brand">Edit Widget</h3>
                    <button onClick={() => setSelectedWidgetId(null)} className="text-xs font-medium text-gray-400 hover:text-gray-600">Done</button>
                  </div>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">Title</span>
                      <input
                        type="text"
                        value={selectedWidget.title ?? ''}
                        onChange={(e) => updateWidget(selectedWidget.id, { title: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-brand/40"
                      />
                    </label>
                    <div>
                      <span className="text-xs font-medium text-gray-600">Size</span>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="range"
                          min={2}
                          max={12}
                          value={selectedWidget.span ?? 6}
                          onChange={(e) => {
                            const newSpan = Number(e.target.value)
                            updateWidget(selectedWidget.id, { span: newSpan })
                            setGridLayouts((prev) => prev.map((l) => l.i === selectedWidget.id ? { ...l, w: newSpan } : l))
                          }}
                          className="flex-1"
                        />
                        <span className="text-xs font-mono text-gray-500 w-8 text-right">{selectedWidget.span ?? 6}/12</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400">{WIDGET_META[selectedWidget.type]?.description}</p>
                    <button
                      onClick={() => { removeWidget(selectedWidget.id); setSelectedWidgetId(null) }}
                      className="w-full rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Remove Widget
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm max-h-[70vh] overflow-y-auto">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Add Widget</h3>

                  {/* Built-in widgets */}
                  <div className="mt-3 space-y-1.5">
                    {BUILDER_WIDGET_TYPES.map((type) => {
                      const meta = WIDGET_META[type]
                      return (
                        <button key={type} onClick={() => addWidget(type)} className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left transition hover:border-gray-300 hover:bg-white">
                          <p className="text-xs font-semibold text-gray-900">{meta.label}</p>
                          <p className="text-[10px] text-gray-500">{meta.description}</p>
                        </button>
                      )
                    })}
                  </div>

                  {/* Preset custom widgets by category */}
                  {PRESET_WIDGETS.map((cat) => (
                    <div key={cat.category} className="mt-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-1.5">{cat.category}</p>
                      <div className="space-y-1.5">
                        {cat.widgets.map((pw) => (
                          <button
                            key={pw.label}
                            onClick={() => addWidgetConfig({ ...pw.config, id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })}
                            className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left transition hover:border-gray-300 hover:bg-white"
                          >
                            <p className="text-xs font-semibold text-gray-900">{pw.label}</p>
                            <p className="text-[10px] text-gray-500">{pw.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Custom templates from AI */}
                  {customTemplates.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand mb-1.5">Custom</p>
                      <div className="space-y-1.5">
                        {customTemplates.map((tpl, i) => (
                          <div key={tpl.id} className="group/tpl flex items-center gap-1">
                            <button
                              onClick={() => addWidgetConfig({ ...tpl, id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })}
                              className="flex-1 rounded-lg border border-brand/10 bg-brand/5 px-3 py-2 text-left transition hover:border-brand/30 hover:bg-brand/10"
                            >
                              <p className="text-xs font-semibold text-gray-900">{tpl.title ?? 'Custom Widget'}</p>
                            </button>
                            <button
                              onClick={() => setCustomTemplates((prev) => prev.filter((_, j) => j !== i))}
                              className="shrink-0 rounded-lg p-1.5 text-gray-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover/tpl:opacity-100"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Color Pickers */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Colors</h3>
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Primary</span>
                    <div className="mt-1 flex items-center gap-2">
                      <input type="color" value={colors.primaryColor} onChange={(e) => setColors((c) => ({ ...c, primaryColor: e.target.value }))} className="h-8 w-8 cursor-pointer rounded border border-gray-200" />
                      <input type="text" value={colors.primaryColor} onChange={(e) => setColors((c) => ({ ...c, primaryColor: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs font-mono text-gray-700" />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Secondary</span>
                    <div className="mt-1 flex items-center gap-2">
                      <input type="color" value={colors.secondaryColor} onChange={(e) => setColors((c) => ({ ...c, secondaryColor: e.target.value }))} className="h-8 w-8 cursor-pointer rounded border border-gray-200" />
                      <input type="text" value={colors.secondaryColor} onChange={(e) => setColors((c) => ({ ...c, secondaryColor: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs font-mono text-gray-700" />
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Canvas */}
        <div ref={containerRef} className="min-w-0 flex-1">
          {/* Toolbar */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                {sidebarOpen ? 'Hide Panel' : 'Show Panel'}
              </button>
              <span className="text-xs text-gray-400">{widgets.length} widget{widgets.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex gap-2">
              {onClear && widgets.length > 0 && (
                <button onClick={handleClear} disabled={clearing} className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                  {clearing ? 'Clearing...' : 'Clear'}
                </button>
              )}
              <button
                onClick={() => window.open(`/embed/${locationId}`, '_blank')}
                disabled={widgets.length === 0}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Preview
              </button>
              <button onClick={handleSave} disabled={saving || widgets.length === 0} className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {saveError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-600">{saveError}</div>
          )}

          {/* Live Grid */}
          {widgets.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500">No widgets yet</p>
                <p className="mt-1 text-xs text-gray-400">Add widgets from the panel{isPro ? ' or ask the AI designer' : ''}</p>
              </div>
            </div>
          ) : (
            <DashboardDataProvider locationId={locationId}>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3" style={cssVars}>
                {mounted && <GridLayout
                  className="layout"
                  width={containerWidth}
                  gridConfig={gridConfig}
                  dragConfig={dragConfig}
                  resizeConfig={resizeConfig}
                  compactor={verticalCompactor}
                  layout={gridLayouts}
                  onLayoutChange={handleLayoutChange}
                >
                  {widgets.map((w) => {
                    const Component = getWidgetComponent(w.type)
                    const isSelected = selectedWidgetId === w.id
                    return (
                      <div key={w.id} className="group">
                        <div
                          className={`flex h-full flex-col overflow-hidden rounded-[20px] border shadow-sm transition-colors ${
                            isSelected ? 'border-brand/40 ring-2 ring-brand/15' : 'border-[var(--shell-line)]'
                          }`}
                          style={{ backgroundColor: 'var(--shell-surface)' }}
                          onClick={() => setSelectedWidgetId(w.id)}
                        >
                          {/* Drag handle */}
                          <div className="drag-handle flex cursor-grab items-center justify-between px-4 py-1.5 active:cursor-grabbing" style={{ borderBottom: '1px solid var(--shell-line)' }}>
                            <div className="flex items-center gap-2">
                              <svg className="h-3.5 w-3.5" style={{ color: 'var(--shell-muted)' }} fill="currentColor" viewBox="0 0 16 16">
                                <circle cx="4" cy="4" r="1.5" /><circle cx="4" cy="8" r="1.5" /><circle cx="4" cy="12" r="1.5" />
                                <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="8" r="1.5" /><circle cx="10" cy="12" r="1.5" />
                              </svg>
                              <span className="text-[11px] font-semibold" style={{ color: 'var(--shell-muted)' }}>{w.title ?? WIDGET_META[w.type]?.label}</span>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeWidget(w.id) }}
                              className="rounded-lg p-1 opacity-0 transition group-hover:opacity-100"
                              style={{ color: 'var(--shell-muted)' }}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          {/* Live widget */}
                          <div className="flex-1 overflow-hidden">
                            {Component && (
                              <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="h-4 w-16 animate-pulse rounded" style={{ backgroundColor: 'var(--shell-soft)' }} /></div>}>
                                <Component title={w.title} options={w.options ?? {}} />
                              </Suspense>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </GridLayout>}
              </div>
            </DashboardDataProvider>
          )}
        </div>
      </div>
    </div>
  )
}
