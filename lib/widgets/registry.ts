import { lazy } from 'react'
import type { WidgetType } from './types'

const widgetComponents: Record<WidgetType, React.LazyExoticComponent<React.ComponentType<any>>> = {
  kpi: lazy(() => import('./KpiWidget')),
  contacts_trend: lazy(() => import('./ContactsTrendWidget')),
  agenda_preview: lazy(() => import('./AgendaPreviewWidget')),
  category_breakdown: lazy(() => import('./CategoryBreakdownWidget')),
  performance_overview: lazy(() => import('./PerformanceOverviewWidget')),
  gare_mensili: lazy(() => import('./GareMensiliWidget')),
  pipeline_funnel: lazy(() => import('./PipelineFunnelWidget')),
  leaderboard: lazy(() => import('./LeaderboardWidget')),
}

export function getWidgetComponent(type: WidgetType) {
  return widgetComponents[type] ?? null
}

export const WIDGET_META: Record<WidgetType, { label: string; description: string; defaultSpan: number }> = {
  kpi: { label: 'KPI Card', description: 'Single metric with label and value', defaultSpan: 3 },
  contacts_trend: { label: 'Contacts Trend', description: 'Line chart showing new contacts over time', defaultSpan: 8 },
  agenda_preview: { label: 'Agenda Preview', description: 'Mini calendar with upcoming appointments', defaultSpan: 4 },
  category_breakdown: { label: 'Category Breakdown', description: 'Category cards with provider breakdown', defaultSpan: 12 },
  performance_overview: { label: 'Performance Overview', description: 'Target progress and working day stats', defaultSpan: 12 },
  gare_mensili: { label: 'Monthly Goals', description: 'Monthly competition targets and progress', defaultSpan: 12 },
  pipeline_funnel: { label: 'Pipeline Funnel', description: 'Pipeline stage summary with deal counts', defaultSpan: 6 },
  leaderboard: { label: 'Leaderboard', description: 'Per-operator performance ranking', defaultSpan: 6 },
}
