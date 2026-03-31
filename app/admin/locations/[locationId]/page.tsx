import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-server'
import LoginAsButton from './_components/LoginAsButton'
import ModuleToggles from './_components/ModuleToggles'
import SyncStatus from './_components/SyncStatus'
import RolesManager from './_components/RolesManager'
import { DEFAULT_MODULES } from '@/lib/types/design'
import type { DesignModules } from '@/lib/types/design'

function paymentsMade(iso: string): number {
  const start = new Date(iso)
  const end = new Date()
  const billingDay = start.getDate()
  let payments = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    payments++
    cursor.setMonth(cursor.getMonth() + 1)
    cursor.setDate(billingDay)
  }
  return Math.max(1, payments)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params
  const supabase = createAdminClient()

  const [
    { data: location },
    { data: profileLocationRows },
    { data: legacyProfiles },
    { data: install },
  ] = await Promise.all([
    supabase
      .from('locations')
      .select('location_id, name, ghl_plan_id, ghl_date_added')
      .eq('location_id', locationId)
      .single(),
    supabase
      .from('profile_locations')
      .select('user_id')
      .eq('location_id', locationId),
    // Fallback: old profiles.location_id
    supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .eq('location_id', locationId),
    supabase
      .from('installs')
      .select('design_slug, installed_at, configured')
      .eq('location_id', locationId)
      .maybeSingle(),
  ])

  // Combine user IDs from junction table + legacy profiles.location_id
  const userIds = [...new Set([
    ...(profileLocationRows ?? []).map((r) => r.user_id),
    ...(legacyProfiles ?? []).map((p) => p.id),
  ])]

  let profiles: { id: string; email: string | null; role: string | null; created_at: string | null }[] = []
  if (userIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .in('id', userIds)
      .order('created_at')
    profiles = data ?? []
  }

  if (!location) notFound()

  // Design modules + location overrides
  let designModules: Record<string, { enabled: boolean }> = {}
  let locationModuleOverrides: Record<string, { enabled: boolean }> = {}

  if (install?.design_slug) {
    const [{ data: design }, { data: locSettings }] = await Promise.all([
      supabase.from('designs').select('modules').eq('slug', install.design_slug).single(),
      supabase.from('location_design_settings').select('module_overrides').eq('location_id', locationId).single(),
    ])
    designModules = (design?.modules as Partial<DesignModules> ?? DEFAULT_MODULES) as Record<string, { enabled: boolean }>
    locationModuleOverrides = (locSettings?.module_overrides as Record<string, { enabled: boolean }>) ?? {}
  }

  // Plan data
  let planName: string | null = null
  let priceMonthly: number | null = null
  if (location.ghl_plan_id) {
    const { data: plan } = await supabase
      .from('ghl_plans')
      .select('name, price_monthly')
      .eq('ghl_plan_id', location.ghl_plan_id)
      .single()
    planName = plan?.name ?? `Unknown (…${location.ghl_plan_id!.slice(-6)})`
    priceMonthly = plan?.price_monthly != null ? Number(plan.price_monthly) : null
  }

  const subscriptionStart = (location as { ghl_date_added?: string | null }).ghl_date_added ?? null
  const months = subscriptionStart ? paymentsMade(subscriptionStart) : 0
  const totalPaid = priceMonthly != null ? priceMonthly * months : null

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/admin/locations"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Back to Locations
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{location.name || location.location_id}</h1>
          <p className="mt-0.5 font-mono text-xs text-gray-400">{location.location_id}</p>
        </div>
        {install?.design_slug && (
          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
            {install.design_slug}
          </span>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Plan */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Plan</p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {planName ?? <span className="text-gray-300">—</span>}
          </p>
          {location.ghl_plan_id && (
            <p className="mt-0.5 font-mono text-[10px] text-gray-300 truncate">{location.ghl_plan_id}</p>
          )}
        </div>

        {/* Monthly price */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Monthly</p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {priceMonthly != null
              ? `€${priceMonthly.toLocaleString('it-IT')}`
              : <span className="text-gray-300">—</span>}
          </p>
          {priceMonthly != null && (
            <p className="mt-0.5 text-xs text-gray-400">per month</p>
          )}
        </div>

        {/* Subscription duration */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Subscribed</p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {subscriptionStart ? `${months} mo` : <span className="text-gray-300">—</span>}
          </p>
          {subscriptionStart && (
            <p className="mt-0.5 text-xs text-gray-400">since {formatDate(subscriptionStart)}</p>
          )}
        </div>

        {/* Total paid */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Total Paid</p>
          <p className="mt-2 text-xl font-bold" style={{ color: '#0e9f6e' }}>
            {totalPaid != null
              ? `€${totalPaid.toLocaleString('it-IT')}`
              : <span className="text-gray-300">—</span>}
          </p>
          {totalPaid != null && (
            <p className="mt-0.5 text-xs text-gray-400">{months} × €{priceMonthly?.toLocaleString('it-IT')}</p>
          )}
        </div>
      </div>

      {/* Users */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-800">
            Users
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              {profiles.length}
            </span>
          </h2>
        </div>
        {profiles.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">No users for this location.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-800">{p.email ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.role === 'super_admin'
                        ? 'bg-red-50 text-red-600'
                        : p.role === 'agency'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}>
                      {p.role ?? 'client'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {p.created_at ? formatDate(p.created_at) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <LoginAsButton userId={p.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Install info */}
      {install && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">Install</h2>
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Design</dt>
              <dd className="mt-1 font-medium text-gray-800">{install.design_slug ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Installed</dt>
              <dd className="mt-1 text-gray-600">
                {install.installed_at ? formatDate(install.installed_at) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</dt>
              <dd className="mt-1">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  install.configured ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {install.configured ? 'Configured' : 'Pending'}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Module overrides */}
      {install?.design_slug && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-1">
            <h2 className="text-sm font-semibold text-gray-800">Modules</h2>
            <p className="text-xs text-gray-400">Enable or disable features for this location. Overrides the design defaults.</p>
          </div>
          <ModuleToggles
            locationId={locationId}
            designModules={designModules}
            locationOverrides={locationModuleOverrides}
          />
        </div>
      )}

      {/* Sync Status */}
      <SyncStatus locationId={locationId} />

      {/* Roles Manager */}
      <RolesManager locationId={locationId} locationName={location.name ?? locationId} />
    </div>
  )
}
