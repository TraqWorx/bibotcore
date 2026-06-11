import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { verifyEmbedToken } from '@/lib/auth/verifyEmbedToken'
import { TEMPLATE_LAYOUTS } from '@/lib/widgets/types'
import WidgetGrid from '@/lib/widgets/WidgetGrid'

export default async function EmbedDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { locationId } = await params
  const { token } = await searchParams
  const sb = createAdminClient()

  // Load dashboard config for this location
  const { data: config } = await sb
    .from('dashboard_configs')
    .select('config, agency_id')
    .eq('location_id', locationId)
    .maybeSingle()

  // Authorize: a valid embed token (public client link), or an authenticated
  // user with access to this location (e.g. the builder preview).
  let authorized = false
  if (token) authorized = !!(await verifyEmbedToken(locationId, token))
  if (!authorized) {
    const auth = await createAuthClient()
    const { data: { user } } = await auth.auth.getUser()
    if (user) {
      const { data: prof } = await sb.from('profiles').select('role, agency_id').eq('id', user.id).single()
      if (prof?.role === 'super_admin' || (prof?.agency_id && config?.agency_id && prof.agency_id === config.agency_id)) {
        authorized = true
      } else {
        const { data: m } = await sb.from('profile_locations').select('user_id').eq('user_id', user.id).eq('location_id', locationId).maybeSingle()
        authorized = !!m
      }
    }
  }
  if (!authorized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-600">Accesso non autorizzato. Link non valido o scaduto.</p>
        </div>
      </div>
    )
  }

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
