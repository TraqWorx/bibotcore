import { notFound } from 'next/navigation'
export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import SubscribeBanner from './widgets/_components/SubscribeBanner'
import ConnectLocationButton from '../_components/ConnectLocationButton'
import SyncStatus from './_components/SyncStatus'
import UsersAndRoles from './_components/UsersAndRoles'
import BulkJobsDashboard from './_components/BulkJobsDashboard'
import BillingHistory from './_components/BillingHistory'
import ModuleToggles from './_components/ModuleToggles'
import { DEFAULT_MODULES } from '@/lib/types/design'
import type { DesignModules } from '@/lib/types/design'
import { ad } from '@/lib/admin/ui'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  const supabase = createAdminClient()

  // Get agency info
  let agencyId: string | null = null
  let isBibot = false
  if (user) {
    const { data: prof } = await supabase.from('profiles').select('agency_id').eq('id', user.id).single()
    agencyId = prof?.agency_id ?? null
    isBibot = isBibotAgency(agencyId)
  }

  // Check subscription
  let isSubscribed = isBibot
  if (!isBibot && agencyId) {
    const { data: sub } = await supabase
      .from('agency_subscriptions')
      .select('status, price_cents, created_at')
      .eq('agency_id', agencyId)
      .eq('location_id', locationId)
      .eq('status', 'active')
      .maybeSingle()
    isSubscribed = !!sub
  }

  // Check GHL connection
  const { data: connection } = await supabase
    .from('ghl_connections')
    .select('location_id, refresh_token')
    .eq('location_id', locationId)
    .maybeSingle()
  const isConnected = !!connection?.refresh_token

  const { data: location } = await supabase
    .from('locations')
    .select('location_id, name, ghl_plan_id, ghl_date_added')
    .eq('location_id', locationId)
    .single()

  if (!location) notFound()

  // Dashboard config
  const { data: dashboardConfig } = await supabase
    .from('dashboard_configs')
    .select('config')
    .eq('location_id', locationId)
    .maybeSingle()
  const widgetCount = Array.isArray(dashboardConfig?.config) ? dashboardConfig.config.length : 0

  // Paywall for non-Bibot
  if (!isSubscribed) {
    return (
      <div className="space-y-6">
        <Link href="/admin/locations" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
          Back to Locations
        </Link>
        <div>
          <h1 className={ad.pageTitle}>{location.name || locationId}</h1>
          <p className="mt-1 font-mono text-xs text-gray-400">{locationId}</p>
        </div>
        <SubscribeBanner locationId={locationId} />
      </div>
    )
  }

  // ── Bibot-only data ──
  let profiles: { id: string; email: string | null; role: string | null; created_at: string | null }[] = []
  let install: { design_slug: string | null; installed_at: string | null; configured: boolean } | null = null
  let designModules: Record<string, { enabled: boolean }> = {}
  let locationModuleOverrides: Record<string, { enabled: boolean }> = {}

  if (isBibot) {
    const [{ data: profileLocationRows }, { data: legacyProfiles }, { data: installRow }] = await Promise.all([
      supabase.from('profile_locations').select('user_id').eq('location_id', locationId),
      supabase.from('profiles').select('id, email, role, created_at').eq('location_id', locationId),
      supabase.from('installs').select('design_slug, installed_at, configured').eq('location_id', locationId).maybeSingle(),
    ])
    install = installRow

    const userIds = [...new Set([...(profileLocationRows ?? []).map((r) => r.user_id), ...(legacyProfiles ?? []).map((p) => p.id)])]
    if (userIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, email, role, created_at').in('id', userIds).order('created_at')
      profiles = data ?? []
    }

    if (install?.design_slug) {
      const [{ data: design }, { data: locSettings }] = await Promise.all([
        supabase.from('designs').select('modules').eq('slug', install.design_slug).single(),
        supabase.from('location_design_settings').select('module_overrides').eq('location_id', locationId).single(),
      ])
      designModules = (design?.modules as Partial<DesignModules> ?? DEFAULT_MODULES) as Record<string, { enabled: boolean }>
      locationModuleOverrides = (locSettings?.module_overrides as Record<string, { enabled: boolean }>) ?? {}
    }
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/admin/locations" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
        Back to Locations
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className={ad.pageTitle}>{location.name || locationId}</h1>
          <p className="mt-1 font-mono text-xs text-gray-400">{locationId}</p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
            </span>
          )}
          {!isConnected && isSubscribed && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Not Connected
            </span>
          )}
        </div>
      </div>

      {/* Status cards */}
      <div className={`grid gap-4 ${isBibot ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Dashboard</p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {widgetCount > 0 ? `${widgetCount} widgets` : <span className="text-gray-300">Not configured</span>}
          </p>
          {isConnected && (
            <Link href={`/admin/locations/${locationId}/widgets`} className="mt-3 inline-flex text-xs font-semibold text-brand hover:underline">
              {widgetCount > 0 ? 'Edit Dashboard' : 'Configure Dashboard'}
            </Link>
          )}
        </div>

        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">GHL Connection</p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {isConnected ? 'Active' : <span className="text-gray-300">Pending</span>}
          </p>
          {isConnected ? (
            <p className="mt-0.5 text-xs text-gray-400">OAuth connected</p>
          ) : (
            <div className="mt-3">
              <ConnectLocationButton locationId={locationId} size="small" />
            </div>
          )}
        </div>

        {isBibot && (
          <div className={ad.panel}>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Users</p>
            <p className="mt-2 text-xl font-bold text-gray-900">{profiles.length}</p>
            <p className="mt-0.5 text-xs text-gray-400">linked to this location</p>
          </div>
        )}
      </div>

      {/* Bibot-only sections */}
      {isBibot && (
        <>
          <BillingHistory locationId={locationId} />
          <UsersAndRoles locationId={locationId} profiles={profiles} />

          {install?.design_slug && (
            <>
              <div className={ad.panel}>
                <h2 className="mb-3 text-sm font-bold text-gray-900">Install</h2>
                <dl className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Design</dt>
                    <dd className="mt-1 font-medium text-gray-800">{install.design_slug}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Installed</dt>
                    <dd className="mt-1 text-gray-600">{install.installed_at ? formatDate(install.installed_at) : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</dt>
                    <dd className="mt-1">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${install.configured ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800' : 'border-amber-200 bg-amber-50/80 text-amber-800'}`}>
                        {install.configured ? 'Configured' : 'Pending'}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>

              <div className={ad.panel}>
                <div className="mb-1">
                  <h2 className="text-sm font-bold text-gray-900">Modules</h2>
                  <p className="text-xs text-gray-500">Enable or disable features for this location.</p>
                </div>
                <ModuleToggles locationId={locationId} designModules={designModules} locationOverrides={locationModuleOverrides} />
              </div>
            </>
          )}

          <SyncStatus locationId={locationId} />
          <BulkJobsDashboard locationId={locationId} />
        </>
      )}
    </div>
  )
}
