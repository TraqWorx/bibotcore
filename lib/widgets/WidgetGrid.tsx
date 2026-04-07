'use client'

import { Suspense } from 'react'
import type { DashboardLayout, DashboardData } from './types'
import { getWidgetComponent } from './registry'
import { DashboardDataProvider } from './DashboardDataProvider'

interface Props {
  layout: DashboardLayout
  locationId: string
  demoData?: DashboardData
}

function WidgetPlaceholder() {
  return (
    <div className="animate-pulse rounded-[28px] border border-[var(--shell-line)] bg-[var(--shell-surface)] p-6 shadow-sm">
      <div className="h-4 w-24 rounded bg-[var(--shell-soft)]" />
      <div className="mt-4 h-20 rounded-xl bg-[var(--shell-soft)]" />
    </div>
  )
}

export default function WidgetGrid({ layout, locationId, demoData }: Props) {
  return (
    <DashboardDataProvider locationId={locationId} demoData={demoData}>
      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}
      >
        {layout.widgets.map((widget) => {
          const Component = getWidgetComponent(widget.type)
          if (!Component) return null
          return (
            <div
              key={widget.id}
              style={{ gridColumn: `span ${widget.span ?? 12} / span ${widget.span ?? 12}` }}
            >
              <Suspense fallback={<WidgetPlaceholder />}>
                <Component title={widget.title} options={widget.options ?? {}} />
              </Suspense>
            </div>
          )
        })}
      </div>
    </DashboardDataProvider>
  )
}
