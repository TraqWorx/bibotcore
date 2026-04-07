export type WidgetType =
  | 'kpi'
  | 'contacts_trend'
  | 'agenda_preview'
  | 'category_breakdown'
  | 'performance_overview'
  | 'gare_mensili'
  | 'pipeline_funnel'
  | 'leaderboard'

export interface WidgetConfig {
  id: string
  type: WidgetType
  title?: string
  /** Grid column span (out of 12) */
  span?: number
  options?: Record<string, unknown>
}

export interface DashboardLayout {
  columns: number
  widgets: WidgetConfig[]
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
