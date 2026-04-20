export type WidgetType =
  | 'kpi'
  | 'contacts_trend'
  | 'agenda_preview'
  | 'category_breakdown'
  | 'performance_overview'
  | 'gare_mensili'
  | 'pipeline_funnel'
  | 'leaderboard'
  | 'custom'

export type CustomDisplayType = 'metric' | 'table' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'list' | 'progress' | 'static' | 'dropdown' | 'tabs' | 'cards_grid'

export type CustomDataSource =
  | 'contacts'
  | 'opportunities'
  | 'pipelines'
  | 'users'
  | 'calendars'
  | 'tasks'
  | 'conversations'
  | 'invoices'
  | 'tags'
  | 'none' // for static/computed widgets like "working days"

export interface CustomWidgetConfig {
  displayType: CustomDisplayType
  dataSource: CustomDataSource
  /** GHL API sub-path or query params */
  endpoint?: string
  /** Which fields to show */
  fields?: { key: string; label: string; format?: 'number' | 'currency' | 'date' | 'percent' | 'text' }[]
  /** For metric widgets */
  metric?: { field: string; label: string; format?: string; aggregation?: 'count' | 'sum' | 'avg' }
  /** For chart widgets */
  chart?: { xField: string; yField: string; label?: string }
  /** For progress widgets */
  progress?: { current: number; target: number; label: string }
  /** For static widgets — raw content */
  staticContent?: { html?: string; value?: string | number; subtitle?: string }
  /** Computed logic (e.g., working days) */
  compute?: string
  /** Filters */
  filters?: Record<string, string>
  /** Colors override */
  color?: string
  /** For dropdown widgets — shows a selector that displays detail for selected item */
  dropdown?: {
    labelField: string
    detailFields?: { key: string; label: string; format?: 'number' | 'currency' | 'date' | 'percent' | 'text' }[]
    groupBy?: string
  }
  /** For tabs — multiple views in one widget */
  tabs?: { label: string; dataSource: CustomDataSource; fields?: { key: string; label: string; format?: string }[]; metric?: { field: string; label: string; aggregation?: 'count' | 'sum' | 'avg'; format?: string } }[]
  /** For cards_grid — clickable card grid */
  cardsGrid?: {
    labelField: string
    valueField?: string
    subtitleField?: string
    imageField?: string
    columns?: number
  }
}

export interface WidgetConfig {
  id: string
  type: WidgetType
  title?: string
  /** Grid column span (out of 12) */
  span?: number
  options?: Record<string, unknown>
}

export interface DashboardColors {
  primaryColor?: string
  secondaryColor?: string
}

export interface DashboardLayout {
  columns: number
  widgets: WidgetConfig[]
  colors?: DashboardColors
}

export interface CategoryData {
  slug: string
  label: string
  total: number
  providers: { provider: string; count: number }[]
  switchOutCount: number
}

export interface TrendPoint {
  date: string
  count: number
}

export interface AppointmentPreview {
  id: string
  title: string
  startTime?: string | null
  status: string
  contactName: string | null
}

export interface DashboardData {
  totalContacts: number
  targetAnnuale: number
  categoryData: CategoryData[]
  switchOutTotal: number
  isAdmin: boolean
  gareRows: { categoria: string; obiettivo: number; tag: string }[]
  closedDays: string[]
  contactsTrend: TrendPoint[]
  appointmentPreview: AppointmentPreview[]
  operatorList?: { name: string; initials: string; isAdmin: boolean }[]
}

// Pre-built templates for Basic plan
export const TEMPLATE_LAYOUTS: Record<string, DashboardLayout> = {
  sales: {
    columns: 12,
    widgets: [
      { id: 'kpi-contacts', type: 'kpi', title: 'Contacts', span: 3, options: { metric: 'total_contacts' } },
      { id: 'kpi-switch', type: 'kpi', title: 'Switch Out', span: 3, options: { metric: 'switch_out' } },
      { id: 'kpi-target', type: 'kpi', title: 'Target', span: 3, options: { metric: 'target' } },
      { id: 'kpi-progress', type: 'kpi', title: 'Progress', span: 3, options: { metric: 'progress' } },
      { id: 'trend', type: 'contacts_trend', span: 8 },
      { id: 'agenda', type: 'agenda_preview', span: 4 },
      { id: 'categories', type: 'category_breakdown', span: 12 },
    ],
  },
  overview: {
    columns: 12,
    widgets: [
      { id: 'kpi-contacts', type: 'kpi', title: 'Contacts', span: 6, options: { metric: 'total_contacts' } },
      { id: 'kpi-target', type: 'kpi', title: 'Target', span: 6, options: { metric: 'target' } },
      { id: 'trend', type: 'contacts_trend', span: 12 },
      { id: 'agenda', type: 'agenda_preview', span: 12 },
    ],
  },
  minimal: {
    columns: 12,
    widgets: [
      { id: 'trend', type: 'contacts_trend', span: 12 },
      { id: 'categories', type: 'category_breakdown', span: 12 },
    ],
  },
}
