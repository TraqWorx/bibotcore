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
  custom: lazy(() => import('./CustomWidget')),
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
  custom: { label: 'Custom Widget', description: 'AI-generated or custom data widget', defaultSpan: 6 },
}

/** Pre-built widget types for Basic plan — organized by GHL module */
export const BUILDER_WIDGET_TYPES: WidgetType[] = [
  'contacts_trend',
  'agenda_preview',
  'pipeline_funnel',
]

/** Pre-built custom widgets for Basic plan — organized by GHL module */
export const PRESET_WIDGETS: { category: string; widgets: { label: string; description: string; config: import('./types').WidgetConfig }[] }[] = [
  {
    category: 'Contacts',
    widgets: [
      { label: 'Total Contacts', description: 'Count of all contacts', config: { id: '', type: 'custom', title: 'Total Contacts', span: 3, options: { displayType: 'metric', dataSource: 'contacts', metric: { field: 'id', label: 'Total Contacts', aggregation: 'count' } } } },
      { label: 'Recent Contacts', description: 'Latest contacts list', config: { id: '', type: 'custom', title: 'Recent Contacts', span: 6, options: { displayType: 'list', dataSource: 'contacts', fields: [{ key: 'contactName', label: 'Name' }, { key: 'dateAdded', label: 'Added', format: 'date' }] } } },
      { label: 'Contacts Table', description: 'Full contacts table', config: { id: '', type: 'custom', title: 'Contacts', span: 12, options: { displayType: 'table', dataSource: 'contacts', fields: [{ key: 'contactName', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'dateAdded', label: 'Added', format: 'date' }] } } },
    ],
  },
  {
    category: 'Pipeline',
    widgets: [
      { label: 'Total Opportunities', description: 'Count of all deals', config: { id: '', type: 'custom', title: 'Total Opportunities', span: 3, options: { displayType: 'metric', dataSource: 'opportunities', metric: { field: 'id', label: 'Total Deals', aggregation: 'count' } } } },
      { label: 'Pipeline Value', description: 'Total deal value', config: { id: '', type: 'custom', title: 'Pipeline Value', span: 3, options: { displayType: 'metric', dataSource: 'opportunities', metric: { field: 'monetaryValue', label: 'Total Value', format: 'currency', aggregation: 'sum' } } } },
      { label: 'Deals List', description: 'Recent opportunities', config: { id: '', type: 'custom', title: 'Deals', span: 6, options: { displayType: 'list', dataSource: 'opportunities', fields: [{ key: 'name', label: 'Deal' }, { key: 'monetaryValue', label: 'Value', format: 'currency' }] } } },
    ],
  },
  {
    category: 'Team',
    widgets: [
      { label: 'Team Members', description: 'List of users', config: { id: '', type: 'custom', title: 'Team', span: 6, options: { displayType: 'table', dataSource: 'users', fields: [{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' }] } } },
    ],
  },
  {
    category: 'Calendar',
    widgets: [
      { label: 'Calendars', description: 'Available calendars', config: { id: '', type: 'custom', title: 'Calendars', span: 6, options: { displayType: 'list', dataSource: 'calendars', fields: [{ key: 'name', label: 'Calendar' }, { key: 'description', label: 'Description' }] } } },
    ],
  },
  {
    category: 'Utility',
    widgets: [
      { label: 'Working Days (Year)', description: 'Working days in the year', config: { id: '', type: 'custom', title: 'Working Days', span: 3, options: { displayType: 'static', dataSource: 'none', compute: 'working_days_year' } } },
      { label: 'Working Days (Month)', description: 'Working days this month', config: { id: '', type: 'custom', title: 'Working Days', span: 3, options: { displayType: 'static', dataSource: 'none', compute: 'working_days_month' } } },
      { label: 'Today\'s Date', description: 'Current date display', config: { id: '', type: 'custom', title: 'Today', span: 4, options: { displayType: 'static', dataSource: 'none', compute: 'current_date' } } },
      { label: 'Day of Year', description: 'Day number in the year', config: { id: '', type: 'custom', title: 'Day of Year', span: 3, options: { displayType: 'static', dataSource: 'none', compute: 'days_in_year' } } },
    ],
  },
]
