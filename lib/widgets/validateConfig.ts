import type { DashboardLayout, WidgetType } from './types'
import { WIDGET_META } from './registry'

const VALID_TYPES = new Set(Object.keys(WIDGET_META))

/**
 * Validates and sanitizes an AI-generated dashboard config.
 * Returns the cleaned layout or null if invalid.
 */
export function validateConfig(raw: unknown): DashboardLayout | null {
  if (!raw || typeof raw !== 'object') return null

  const obj = raw as Record<string, unknown>
  const columns = typeof obj.columns === 'number' ? obj.columns : 12
  const widgets = Array.isArray(obj.widgets) ? obj.widgets : []

  if (widgets.length === 0) return null

  const seen = new Set<string>()
  const valid = widgets
    .filter((w): w is Record<string, unknown> => w != null && typeof w === 'object')
    .filter((w) => {
      const type = String(w.type ?? '')
      const id = String(w.id ?? `w-${Math.random().toString(36).slice(2, 8)}`)
      if (!VALID_TYPES.has(type)) return false
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    .map((w) => ({
      id: String(w.id),
      type: String(w.type) as WidgetType,
      span: typeof w.span === 'number' ? Math.min(Math.max(w.span, 1), 12) : undefined,
      title: typeof w.title === 'string' ? w.title : undefined,
      options: w.options && typeof w.options === 'object' ? (w.options as Record<string, unknown>) : undefined,
    }))

  if (valid.length === 0) return null

  return { columns, widgets: valid }
}
