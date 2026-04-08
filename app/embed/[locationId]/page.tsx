import { createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { TEMPLATE_LAYOUTS } from '@/lib/widgets/types'
import WidgetGrid from '@/lib/widgets/WidgetGrid'

export default async function EmbedDashboardPage({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params
  const sb = createAdminClient()

  // Load dashboard config for this location
  const { data: config } = await sb
    .from('dashboard_configs')
    .select('config, agency_id')
    .eq('location_id', locationId)
    .maybeSingle()

  if (!config) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-600">No dashboard configured for this location.</p>
        </div>
      </div>
    )
  }

  // Check subscription (Bibot bypasses)
  if (!isBibotAgency(config.agency_id)) {
    const { data: subscription } = await sb
      .from('agency_subscriptions')
      .select('status')
      .eq('agency_id', config.agency_id)
      .eq('location_id', locationId)
      .eq('status', 'active')
      .maybeSingle()

    if (!subscription) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-amber-700">No active subscription for this location.</p>
            <p className="mt-1 text-xs text-gray-400">Contact your agency admin to activate a plan.</p>
          </div>
        </div>
      )
    }
  }

  const widgetConfig = Array.isArray(config.config) && config.config.length > 0
    ? config.config
    : null

  const layout = widgetConfig
    ? { columns: 12, widgets: widgetConfig }
    : TEMPLATE_LAYOUTS.overview

  return <WidgetGrid layout={layout} locationId={locationId} />
}
