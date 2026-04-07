import { verifyEmbedToken } from '@/lib/auth/verifyEmbedToken'
import { createAdminClient } from '@/lib/supabase-server'
import { TEMPLATE_LAYOUTS } from '@/lib/widgets/types'
import WidgetGrid from '@/lib/widgets/WidgetGrid'

export default async function EmbedDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locationId } = await params
  const sp = await searchParams
  const token = typeof sp.token === 'string' ? sp.token : null

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-red-600">Missing embed token.</p>
          <p className="mt-1 text-xs text-gray-400">Add ?token=your_embed_token to the URL.</p>
        </div>
      </div>
    )
  }

  // Verify the token
  const config = await verifyEmbedToken(locationId, token)

  if (!config) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-red-600">Invalid or expired embed token.</p>
        </div>
      </div>
    )
  }

  // Check if agency has active subscription for this location
  const sb = createAdminClient()
  const { data: subscription } = await sb
    .from('agency_subscriptions')
    .select('plan, status')
    .eq('agency_id', config.agency_id)
    .eq('location_id', locationId)
    .eq('status', 'active')
    .single()

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

  // Parse layout: use saved config or fall back to a template
  const widgetConfig = Array.isArray(config.config) && config.config.length > 0
    ? config.config
    : null

  const layout = widgetConfig
    ? { columns: 12, widgets: widgetConfig }
    : TEMPLATE_LAYOUTS.overview

  return <WidgetGrid layout={layout} locationId={locationId} />
}
