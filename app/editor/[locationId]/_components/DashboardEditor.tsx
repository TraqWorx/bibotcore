'use client'

import { useState, useMemo, useRef, useEffect, Suspense, useCallback } from 'react'
import { GridLayout, useContainerWidth, verticalCompactor, type Layout, type LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import type { DashboardLayout, DashboardColors, WidgetConfig } from '@/lib/widgets/types'
import { WIDGET_META, getWidgetComponent } from '@/lib/widgets/registry'
import { DashboardDataProvider } from '@/lib/widgets/DashboardDataProvider'
import { resolveSimfoniaShell } from '@/lib/simfonia/shellTheme'
import { DEFAULT_THEME } from '@/lib/types/design'

interface Props {
  locationId: string
  locationName: string
  initialLayout: DashboardLayout | null
  initialColors: DashboardColors | null
  initialTemplates?: WidgetConfig[]
  onSave: (layout: DashboardLayout, colors: DashboardColors, templates?: WidgetConfig[]) => Promise<{ error: string } | undefined>
  onClear?: () => Promise<{ error: string } | undefined>
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  dashboardApplied?: boolean
}

function genId() { return `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }

function widgetsToGrid(widgets: WidgetConfig[]): LayoutItem[] {
  let x = 0, y = 0
  return widgets.map((w) => {
    const span = w.span ?? 6
    const h = w.type === 'agenda_preview' ? 6 : w.type === 'contacts_trend' || w.type === 'pipeline_funnel' ? 5 : 4
    if (x + span > 12) { x = 0; y += h }
    const item: LayoutItem = { i: w.id, x, y, w: span, h, minW: 2, maxW: 12, minH: 2 }
    x += span
    if (x >= 12) { x = 0; y += h }
    return item
  })
}

export default function DashboardEditor({ locationId, locationName, initialLayout, initialColors, initialTemplates, onSave, onClear }: Props) {
  const { containerRef, width: containerWidth } = useContainerWidth()
  const [clientReady, setClientReady] = useState(false)
  useEffect(() => { setClientReady(true) }, [])

  const [widgets, setWidgets] = useState<WidgetConfig[]>(initialLayout?.widgets ?? [])
  const [gridLayouts, setGridLayouts] = useState<LayoutItem[]>(() => widgetsToGrid(initialLayout?.widgets ?? []))
  const [colors, setColors] = useState<DashboardColors>({
    primaryColor: initialColors?.primaryColor ?? '#1a1a2e',
    secondaryColor: initialColors?.secondaryColor ?? '#6366f1',
  })
  const [customTemplates, setCustomTemplates] = useState<WidgetConfig[]>(initialTemplates ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: widgets.length > 0
      ? `Your dashboard for **${locationName}** has ${widgets.length} widgets. Tell me what you'd like to change, or click any widget to edit it.`
      : `Hi! Let's build a dashboard for **${locationName}**.\n\nDescribe what you want, e.g.:\n"Show me contacts trend, upcoming appointments, and pipeline value with a modern dark theme"\n\nI'll create it and we can refine together.`,
  }])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [gridConfig] = useState({ cols: 12, rowHeight: 80, margin: [12, 12] as const })
  const [dragConfig] = useState({ enabled: true, handle: '.drag-handle' })
  const [resizeConfig] = useState({ enabled: true })

  const selectedWidget = widgets.find((w) => w.id === selectedWidgetId)

  const theme = useMemo(() => ({
    ...DEFAULT_THEME,
    primaryColor: colors.primaryColor ?? DEFAULT_THEME.primaryColor,
    secondaryColor: colors.secondaryColor ?? DEFAULT_THEME.secondaryColor,
  }), [colors])
  const shell = useMemo(() => resolveSimfoniaShell(theme), [theme])
  const cssVars = useMemo(() => ({
    '--brand': theme.secondaryColor, '--accent': theme.secondaryColor,
    '--foreground': shell.foreground, '--shell-bg': shell.shellBg,
    '--shell-surface': shell.shellSurface, '--shell-canvas': shell.shellCanvas,
    '--shell-muted': shell.shellMuted, '--shell-line': shell.shellLine,
    '--shell-soft': shell.shellSoft, '--shell-soft-alt': shell.shellSoftAlt,
    '--shell-tint': shell.shellTint, '--shell-tint-strong': shell.shellTintStrong,
    '--shell-sidebar': shell.shellSidebar,
  } as React.CSSProperties), [theme, shell])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, chatLoading])

  const handleLayoutChange = useCallback((newLayout: Layout) => {
    setGridLayouts((prev) => {
      const changed = newLayout.length !== prev.length || newLayout.some((item, i) => {
        const old = prev[i]; return !old || item.i !== old.i || item.x !== old.x || item.y !== old.y || item.w !== old.w || item.h !== old.h
      })
      return changed ? [...newLayout] : prev
    })
    setWidgets((prev) => {
      let changed = false
      const next = prev.map((w) => { const gl = newLayout.find((l) => l.i === w.id); if (gl && gl.w !== w.span) { changed = true; return { ...w, span: gl.w } } return w })
      return changed ? next : prev
    })
  }, [])

  const handleSend = async () => {
    if (!input.trim() || chatLoading) return
    const userMsg = input.trim()
    setInput('')
    setChatLoading(true)
    setSaved(false)

    const editingCtx = selectedWidget
      ? `[USER IS EDITING WIDGET: "${selectedWidget.title}" (type: ${selectedWidget.type}, id: ${selectedWidget.id}, span: ${selectedWidget.span}). Apply changes to this widget and return the FULL dashboard.]\n\n`
      : ''

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)

    try {
      const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }))
      apiMessages.unshift({ role: 'user', content: `Current dashboard: ${JSON.stringify({ widgets, colors })}\n\nReturn the COMPLETE dashboard in a \`\`\`dashboard block whenever you create or modify widgets.` })
      apiMessages.splice(1, 0, { role: 'assistant', content: 'Got it.' })
      if (editingCtx) apiMessages[apiMessages.length - 1] = { role: 'user', content: editingCtx + userMsg }

      const res = await fetch('/api/ai/widget-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, locationId }),
      })

      if (res.ok) {
        const { reply } = await res.json()
        const dashRegex = /```dashboard\s*([\s\S]*?)```/g
        let dashConfig: { widgets?: WidgetConfig[]; colors?: DashboardColors } | null = null
        let match
        while ((match = dashRegex.exec(reply)) !== null) {
          try { dashConfig = JSON.parse(match[1]) } catch { /* skip */ }
        }
        const cleanReply = reply.replace(/```dashboard\s*[\s\S]*?```/g, '').replace(/```widget\s*[\s\S]*?```/g, '').trim()
        const assistantMsg: ChatMessage = { role: 'assistant', content: cleanReply, dashboardApplied: !!dashConfig?.widgets }

        if (dashConfig?.widgets) {
          const newWidgets = dashConfig.widgets.map((w) => ({ ...w, id: w.id || genId() }))
          setWidgets(newWidgets)
          setGridLayouts(widgetsToGrid(newWidgets))
        }
        if (dashConfig?.colors) setColors(dashConfig.colors)
        setMessages([...newMessages, assistantMsg])
      } else {
        const data = await res.json().catch(() => ({}))
        setMessages([...newMessages, { role: 'assistant', content: data.error ?? 'Something went wrong.' }])
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Network error. Try again.' }])
    }
    setChatLoading(false)
    setSelectedWidgetId(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const finalWidgets = widgets.map((w) => {
      const gl = gridLayouts.find((l) => l.i === w.id)
      return { ...w, span: gl?.w ?? w.span }
    })
    const newTemplates = [...customTemplates]
    for (const w of finalWidgets) {
      if (!newTemplates.some((t) => t.title === w.title && t.type === w.type)) {
        newTemplates.push({ ...w, id: `tpl-${w.type}-${Date.now()}` })
      }
    }
    setCustomTemplates(newTemplates)
    const result = await onSave({ columns: 12, widgets: finalWidgets, colors }, colors, newTemplates)
    if (result?.error) setSaveError(result.error)
    else setSaved(true)
    setSaving(false)
  }

  const handleClear = async () => {
    if (!onClear || !confirm('Remove all widgets and reset?')) return
    const result = await onClear()
    if (!result?.error) {
      setWidgets([]); setGridLayouts([]); setSelectedWidgetId(null); setSaved(false)
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Dashboard cleared. What would you like to build?' }])
    }
  }

  const handlePreview = () => {
    const previewData = { widgets, colors, locationId }
    const encoded = encodeURIComponent(JSON.stringify(previewData))
    window.open(`/admin/locations/${locationId}/widgets/preview?data=${encoded}`, '_blank')
  }

  const handleWidgetClick = (id: string) => {
    const w = widgets.find((w) => w.id === id)
    if (!w) return
    setSelectedWidgetId(id)
    inputRef.current?.focus()
    setMessages((prev) => [...prev, {
      role: 'assistant',
      content: `Editing **${w.title ?? WIDGET_META[w.type]?.label}**. What would you like to change?`,
    }])
  }

  const handleRemoveWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id))
    setGridLayouts((prev) => prev.filter((l) => l.i !== id))
    if (selectedWidgetId === id) setSelectedWidgetId(null)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Chat */}
      <div className="w-[380px] shrink-0 flex flex-col border-r border-gray-200 bg-white">
        {/* Header */}
        <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">{locationName}</h3>
            {selectedWidget ? (
              <p className="text-[11px] text-brand font-semibold mt-0.5 truncate">
                Editing: {selectedWidget.title ?? WIDGET_META[selectedWidget.type]?.label}
                <button onClick={() => setSelectedWidgetId(null)} className="ml-2 text-gray-400 hover:text-gray-600">x</button>
              </p>
            ) : (
              <p className="text-[11px] text-gray-400 mt-0.5">AI Dashboard Designer</p>
            )}
          </div>
          <div className="flex gap-1.5 shrink-0">
            {widgets.length > 0 && onClear && (
              <button onClick={handleClear} className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Clear</button>
            )}
            <button onClick={handlePreview} disabled={widgets.length === 0} className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">Preview</button>
            <button onClick={handleSave} disabled={saving || widgets.length === 0} className={`rounded-lg px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40 ${saved ? 'bg-emerald-600' : 'bg-gray-900 hover:bg-gray-800'}`}>
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
            </button>
            <button onClick={() => window.close()} className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-50">Close</button>
          </div>
        </div>

        {saveError && <div className="mx-3 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] text-red-600">{saveError}</div>}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? 'ml-8' : 'mr-2'}>
              <div className={`rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                msg.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700 border border-gray-100'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.dashboardApplied && <p className="mt-1 text-[10px] text-emerald-600 font-medium px-1">Dashboard updated</p>}
            </div>
          ))}
          {chatLoading && (
            <div className="mr-2">
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" />
                <div className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-3 py-3">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={selectedWidget ? `Edit ${selectedWidget.title ?? 'widget'}...` : 'Describe your dashboard...'}
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              disabled={chatLoading}
            />
            <button onClick={handleSend} disabled={chatLoading || !input.trim()} className="shrink-0 rounded-xl bg-brand px-4 py-2.5 disabled:opacity-40">
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-6 bg-[#f5f5f8]">
        <DashboardDataProvider locationId={locationId}>
          {!clientReady ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand" />
            </div>
          ) : widgets.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50">
              <div className="text-center px-8">
                <p className="text-sm font-medium text-gray-500">Your dashboard will appear here</p>
                <p className="mt-1 text-xs text-gray-400">Describe what you want in the chat</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 p-3" style={{ ...cssVars, backgroundColor: 'var(--shell-bg)' }}>
              <GridLayout
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
                        className={`flex h-full flex-col overflow-hidden rounded-[20px] border transition-all ${
                          isSelected ? 'border-brand ring-2 ring-brand/20 shadow-lg' : 'border-[var(--shell-line)] hover:border-brand/30'
                        }`}
                        style={{ backgroundColor: 'var(--shell-surface)' }}
                      >
                        <div className="drag-handle flex cursor-grab items-center justify-between px-3 py-1.5 active:cursor-grabbing" style={{ borderBottom: '1px solid var(--shell-line)' }}>
                          <div className="flex items-center gap-2">
                            <svg className="h-3.5 w-3.5" style={{ color: 'var(--shell-muted)' }} fill="currentColor" viewBox="0 0 16 16">
                              <circle cx="4" cy="4" r="1.5" /><circle cx="4" cy="8" r="1.5" /><circle cx="4" cy="12" r="1.5" />
                              <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="8" r="1.5" /><circle cx="10" cy="12" r="1.5" />
                            </svg>
                            <span className="text-[11px] font-semibold" style={{ color: 'var(--shell-muted)' }}>{w.title ?? WIDGET_META[w.type]?.label}</span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => handleWidgetClick(w.id)} className="rounded px-1.5 py-0.5 text-[10px] font-semibold hover:bg-white/50" style={{ color: 'var(--brand)' }}>Edit</button>
                            <button onClick={() => handleRemoveWidget(w.id)} className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-red-500 hover:bg-white/50">Remove</button>
                          </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          {Component && (
                            <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200" style={{ borderTopColor: 'var(--brand)' }} /></div>}>
                              <Component title={w.title} options={w.options ?? {}} />
                            </Suspense>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </GridLayout>
            </div>
          )}
        </DashboardDataProvider>
      </div>
    </div>
  )
}
