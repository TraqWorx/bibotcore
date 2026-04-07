import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { TEMPLATE_LAYOUTS, type DashboardLayout } from '@/lib/widgets/types'
import WidgetGrid from '@/lib/widgets/WidgetGrid'
import AiDesigner from './_components/AiDesigner'

async function saveConfig(locationId: string, agencyId: string, config: DashboardLayout) {
  'use server'
  const sb = createAdminClient()
  await sb.from('dashboard_configs').upsert(
    { location_id: locationId, agency_id: agencyId, config: config.widgets, updated_at: new Date().toISOString() },
    { onConflict: 'location_id' },
  )
  revalidatePath(`/admin/locations/${locationId}/widgets`)
}

export default async function WidgetEditorPage({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id) redirect('/login')

  const [{ data: subscription }, { data: config }, { data: location }] = await Promise.all([
    sb.from('agency_subscriptions').select('plan, status').eq('agency_id', profile.agency_id).eq('location_id', locationId).maybeSingle(),
    sb.from('dashboard_configs').select('config').eq('location_id', locationId).maybeSingle(),
    sb.from('locations').select('name').eq('location_id', locationId).single(),
  ])

  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active'
  const currentLayout: DashboardLayout | null = config?.config && Array.isArray(config.config) && config.config.length > 0
    ? { columns: 12, widgets: config.config }
    : null

  const agencyId = profile.agency_id

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Dashboard Editor</p>
        <h1 className="mt-1 text-xl font-bold text-gray-900">{location?.name ?? locationId}</h1>
      </div>

      {isPro ? (
        <AiDesigner
          locationId={locationId}
          currentConfig={currentLayout}
          onSave={async (layout) => {
            'use server'
            await saveConfig(locationId, agencyId, layout)
          }}
        />
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm font-medium text-gray-600">AI Designer is available on the Pro plan.</p>
          <p className="mt-1 text-xs text-gray-400">Upgrade to Pro ($19/mo) to design custom dashboards with AI.</p>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-400">Templates</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {Object.entries(TEMPLATE_LAYOUTS).map(([key, layout]) => (
            <form key={key} action={async () => {
              'use server'
              await saveConfig(locationId, agencyId, layout)
            }}>
              <button
                type="submit"
                className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-brand/25 hover:shadow-md"
              >
                <p className="font-bold capitalize text-gray-900">{key}</p>
                <p className="mt-1 text-xs text-gray-500">{layout.widgets.length} widgets</p>
              </button>
            </form>
          ))}
        </div>
      </div>

      {currentLayout && (
        <div>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-400">Current Dashboard</h2>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <WidgetGrid layout={currentLayout} locationId={locationId} />
          </div>
        </div>
      )}
    </div>
  )
}
