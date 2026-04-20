import Link from 'next/link'
export const dynamic = 'force-dynamic'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { DashboardLayout, DashboardColors, WidgetConfig } from '@/lib/widgets/types'
import { isBibotAgency } from '@/lib/isBibotAgency'
import DashboardBuilder from './_components/DashboardBuilder'
import SubscribeBanner from './_components/SubscribeBanner'

async function saveConfig(locationId: string, agencyId: string, layout: DashboardLayout, colors: DashboardColors, templates?: WidgetConfig[]): Promise<{ error: string } | undefined> {
  'use server'
  const sb = createAdminClient()
  const { error } = await sb.from('dashboard_configs').upsert(
    {
      location_id: locationId,
      agency_id: agencyId,
      config: layout.widgets,
      theme: colors,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'location_id' },
  )
  if (error) return { error: error.message }
  // Save custom templates to agency (shared across locations)
  if (templates) {
    await sb.from('agencies').update({ custom_templates: templates }).eq('id', agencyId)
  }
  revalidatePath(`/admin/locations/${locationId}/widgets`)
}

async function clearConfig(locationId: string): Promise<{ error: string } | undefined> {
  'use server'
  const sb = createAdminClient()
  const { error } = await sb.from('dashboard_configs').delete().eq('location_id', locationId)
  if (error) return { error: error.message }
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

  const [{ data: subscription }, { data: config }, { data: location }, { data: agency }] = await Promise.all([
    sb.from('agency_subscriptions').select('plan, status').eq('agency_id', profile.agency_id).eq('location_id', locationId).maybeSingle(),
    sb.from('dashboard_configs').select('config, theme').eq('location_id', locationId).maybeSingle(),
    sb.from('locations').select('name').eq('location_id', locationId).single(),
    sb.from('agencies').select('custom_templates').eq('id', profile.agency_id).single(),
  ])

  const isBibot = isBibotAgency(profile.agency_id)
  const isSubscribed = isBibot || subscription?.status === 'active'

  // Non-Bibot without subscription → redirect to location page with paywall
  if (!isSubscribed) redirect(`/admin/locations/${locationId}`)

  const currentLayout: DashboardLayout | null = config?.config && Array.isArray(config.config) && config.config.length > 0
    ? { columns: 12, widgets: config.config }
    : null
  const currentColors: DashboardColors | null = config?.theme && typeof config.theme === 'object'
    ? config.theme as DashboardColors
    : null
  const savedTemplates: WidgetConfig[] = Array.isArray(agency?.custom_templates) ? agency.custom_templates : []

  const agencyId = profile.agency_id

  return (
    <div className="space-y-8">
      <Link
        href="/admin/locations"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Back to Locations
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Dashboard Builder</p>
        <h1 className="mt-1 text-xl font-bold text-gray-900">{location?.name ?? locationId}</h1>
      </div>

      <DashboardBuilder
        locationId={locationId}
        initialLayout={currentLayout}
        initialColors={currentColors}
        initialTemplates={savedTemplates}
        isPro={true}
        onSave={async (layout, colors, templates) => {
          'use server'
          return saveConfig(locationId, agencyId, layout, colors, templates)
        }}
        onClear={async () => {
          'use server'
          return clearConfig(locationId)
        }}
      />

      {!isSubscribed && currentLayout && (
        <SubscribeBanner locationId={locationId} />
      )}
    </div>
  )
}
