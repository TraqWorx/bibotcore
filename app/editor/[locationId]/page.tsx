import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { DashboardLayout, DashboardColors, WidgetConfig } from '@/lib/widgets/types'
import { isBibotAgency } from '@/lib/isBibotAgency'
import DashboardEditor from './_components/DashboardEditor'

export const dynamic = 'force-dynamic'

async function saveConfig(locationId: string, agencyId: string, layout: DashboardLayout, colors: DashboardColors, templates?: WidgetConfig[]): Promise<{ error: string } | undefined> {
  'use server'
  const sb = createAdminClient()
  const { error } = await sb.from('dashboard_configs').upsert(
    { location_id: locationId, agency_id: agencyId, config: layout.widgets, theme: colors, updated_at: new Date().toISOString() },
    { onConflict: 'location_id' },
  )
  if (error) return { error: error.message }
  if (templates) {
    await sb.from('agencies').update({ custom_templates: templates }).eq('id', agencyId)
  }
  revalidatePath(`/admin/locations/${locationId}/widgets`)
  revalidatePath(`/editor/${locationId}`)
}

async function clearConfig(locationId: string): Promise<{ error: string } | undefined> {
  'use server'
  const sb = createAdminClient()
  const { error } = await sb.from('dashboard_configs').delete().eq('location_id', locationId)
  if (error) return { error: error.message }
  revalidatePath(`/admin/locations/${locationId}/widgets`)
  revalidatePath(`/editor/${locationId}`)
}

export default async function EditorPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id) redirect('/login')

  const isBibot = isBibotAgency(profile.agency_id)
  const [{ data: subscription }, { data: config }, { data: location }, { data: agency }] = await Promise.all([
    sb.from('agency_subscriptions').select('status').eq('agency_id', profile.agency_id).eq('location_id', locationId).eq('status', 'active').maybeSingle(),
    sb.from('dashboard_configs').select('config, theme').eq('location_id', locationId).maybeSingle(),
    sb.from('locations').select('name').eq('location_id', locationId).single(),
    sb.from('agencies').select('custom_templates').eq('id', profile.agency_id).single(),
  ])

  if (!isBibot && !subscription) redirect(`/admin/locations/${locationId}`)

  const currentLayout = config?.config && Array.isArray(config.config) && config.config.length > 0
    ? { columns: 12, widgets: config.config } : null
  const currentColors = config?.theme && typeof config.theme === 'object' ? config.theme as DashboardColors : null
  const savedTemplates: WidgetConfig[] = Array.isArray(agency?.custom_templates) ? agency.custom_templates : []
  const agencyId = profile.agency_id

  return (
    <div className="min-h-screen bg-[#f5f5f8]">
      <DashboardEditor
        locationId={locationId}
        locationName={location?.name ?? locationId}
        initialLayout={currentLayout}
        initialColors={currentColors}
        initialTemplates={savedTemplates}
        onSave={async (layout, colors, templates) => {
          'use server'
          return saveConfig(locationId, agencyId, layout, colors, templates)
        }}
        onClear={async () => {
          'use server'
          return clearConfig(locationId)
        }}
      />
    </div>
  )
}
