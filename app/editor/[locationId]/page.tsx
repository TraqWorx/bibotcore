import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { DashboardLayout, DashboardColors, WidgetConfig } from '@/lib/widgets/types'
import { isBillingExempt } from '@/lib/agency/capabilities'
import DashboardEditor from './_components/DashboardEditor'

export const dynamic = 'force-dynamic'

// Server actions are callable directly, so each one re-checks the caller the
// same way the page does. Returns the location's agency id, or null if denied.
async function editorAgencyFor(locationId: string): Promise<string | null> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null
  const sb = createAdminClient()
  const [{ data: profile }, { data: location }] = await Promise.all([
    sb.from('profiles').select('agency_id, role').eq('id', user.id).single(),
    sb.from('locations').select('agency_id').eq('location_id', locationId).maybeSingle(),
  ])
  if (!location?.agency_id) return null
  if (profile?.role === 'super_admin') return location.agency_id
  if (profile?.role !== 'admin' || location.agency_id !== profile.agency_id) return null
  if (await isBillingExempt(profile.agency_id)) return location.agency_id
  const { data: subscription } = await sb.from('agency_subscriptions').select('status')
    .eq('agency_id', profile.agency_id).eq('location_id', locationId).eq('status', 'active').maybeSingle()
  return subscription ? location.agency_id : null
}

async function saveConfig(locationId: string, layout: DashboardLayout, colors: DashboardColors, templates?: WidgetConfig[]): Promise<{ error: string } | undefined> {
  'use server'
  const agencyId = await editorAgencyFor(locationId)
  if (!agencyId) return { error: 'Not authorized' }
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
  if (!(await editorAgencyFor(locationId))) return { error: 'Not authorized' }
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
  const { data: profile } = await sb.from('profiles').select('agency_id, role').eq('id', user.id).single()
  if (!profile?.agency_id) redirect('/login')

  const isBibot = await isBillingExempt(profile.agency_id)
  const isSuperAdmin = profile.role === 'super_admin'
  const [{ data: subscription }, { data: config }, { data: location }, { data: agency }] = await Promise.all([
    sb.from('agency_subscriptions').select('status').eq('agency_id', profile.agency_id).eq('location_id', locationId).eq('status', 'active').maybeSingle(),
    sb.from('dashboard_configs').select('config, theme').eq('location_id', locationId).maybeSingle(),
    sb.from('locations').select('name, agency_id').eq('location_id', locationId).single(),
    sb.from('agencies').select('custom_templates').eq('id', profile.agency_id).single(),
  ])

  // Editing is for admins of the agency that owns the location (super_admin bypasses)
  if (!isSuperAdmin && (profile.role !== 'admin' || location?.agency_id !== profile.agency_id)) redirect('/admin')
  // Paywall: own location but no active subscription (Bibot is free).
  if (!isBibot && !isSuperAdmin && !subscription) redirect(`/admin/locations/${locationId}`)

  const currentLayout = config?.config && Array.isArray(config.config) && config.config.length > 0
    ? { columns: 12, widgets: config.config } : null
  const currentColors = config?.theme && typeof config.theme === 'object' ? config.theme as DashboardColors : null
  const savedTemplates: WidgetConfig[] = Array.isArray(agency?.custom_templates) ? agency.custom_templates : []
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
          return saveConfig(locationId, layout, colors, templates)
        }}
        onClear={async () => {
          'use server'
          return clearConfig(locationId)
        }}
      />
    </div>
  )
}
