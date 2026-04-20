'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { GridLayout, useContainerWidth, verticalCompactor, type LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import type { DashboardColors, WidgetConfig } from '@/lib/widgets/types'
import { WIDGET_META, getWidgetComponent } from '@/lib/widgets/registry'
import { DashboardDataProvider } from '@/lib/widgets/DashboardDataProvider'
import { resolveSimfoniaShell } from '@/lib/simfonia/shellTheme'
import { DEFAULT_THEME } from '@/lib/types/design'

interface Props {
  locationId: string
  initialWidgets: WidgetConfig[]
  initialColors: DashboardColors | null
}

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

export default function DashboardBuilder({ locationId, initialWidgets, initialColors }: Props) {
  const { containerRef, width: containerWidth } = useContainerWidth()
  const [clientReady, setClientReady] = useState(false)
  useEffect(() => { setClientReady(true) }, [])

  const widgets = initialWidgets
  const gridLayouts = useMemo(() => widgetsToGrid(widgets), [widgets])
  const colors = initialColors ?? { primaryColor: '#1a1a2e', secondaryColor: '#6366f1' }

  const [gridConfig] = useState({ cols: 12, rowHeight: 80, margin: [12, 12] as const })

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

  const handleEdit = () => {
    window.open(`/editor/${locationId}`, '_blank')
  }

  const handlePreview = () => {
    window.open(`/embed/${locationId}`, '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {widgets.length > 0 ? `${widgets.length} widgets` : 'No widgets yet'}
        </span>
        <div className="flex gap-2">
          {widgets.length > 0 && (
            <button onClick={handlePreview} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Preview
            </button>
          )}
          <button onClick={handleEdit} className="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90">
            {widgets.length > 0 ? 'Edit Dashboard' : 'Create Dashboard'}
          </button>
        </div>
      </div>

      {widgets.length > 0 && (
        <div ref={containerRef}>
          <DashboardDataProvider locationId={locationId}>
            {!clientReady ? (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand" />
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 p-3" style={{ ...cssVars, backgroundColor: 'var(--shell-bg)' }}>
                <GridLayout
                  className="layout"
                  width={containerWidth}
                  gridConfig={gridConfig}
                  dragConfig={{ enabled: false }}
                  resizeConfig={{ enabled: false }}
                  compactor={verticalCompactor}
                  layout={gridLayouts}
                  onLayoutChange={() => {}}
                >
                  {widgets.map((w) => {
                    const Component = getWidgetComponent(w.type)
                    return (
                      <div key={w.id}>
                        <div className="overflow-hidden rounded-[20px] border border-[var(--shell-line)] h-full" style={{ backgroundColor: 'var(--shell-surface)' }}>
                          {Component && (
                            <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200" style={{ borderTopColor: 'var(--brand)' }} /></div>}>
                              <Component title={w.title} options={w.options ?? {}} />
                            </Suspense>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </GridLayout>
              </div>
            )}
          </DashboardDataProvider>
        </div>
      )}
    </div>
  )
}
