import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { getAgencyCapabilities } from '@/lib/agency/capabilities'
import { getAdminContext } from '@/lib/admin/viewAsAgency'
import AdminNavClient from './_components/AdminNavClient'
import LogoutButton from './_components/LogoutButton'
import { ad } from '@/lib/admin/ui'

const getAdminData = cache(async () => {
  const ctx = await getAdminContext()
  if (!ctx) return null

  const admin = createAdminClient()
  // Admins see their own agency; a super admin may open someone else's
  if (!ctx.agencyId || (ctx.role !== 'admin' && ctx.role !== 'super_admin')) return null

  const agencyId = ctx.agencyId
  const { data: agency } = await admin.from('agencies').select('name').eq('id', agencyId).single()
  if (!agency) return null

  const agencyName = agency.name
  const caps = await getAgencyCapabilities(agencyId)

  // Count data scoped to the agency
  const [{ count: userCount }, { count: locationCount }] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId),
    admin.from('locations').select('location_id', { count: 'exact', head: true }).eq('agency_id', agencyId),
  ])

  const navLinks = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/locations', label: 'Locations', count: locationCount ?? 0 },
  ]

  // Affiliates — every agency sees its own connected-location affiliate data.
  navLinks.push({ href: '/admin/affiliates', label: 'Affiliates' })

  // Finances needs the agency's own GHL-connected Stripe account
  if (caps.financesEnabled) {
    navLinks.push({ href: '/admin/finances', label: 'Finances' })
  }

  // Agencies that manage their own sub-accounts get Designs + Plan Mapping,
  // whether or not anything is installed yet — that's where the first one is made.
  if (caps.agencyMode) {
    const { count: designCount } = await admin.from('installs').select('id', { count: 'exact', head: true })
      .in('location_id', (await admin.from('locations').select('location_id').eq('agency_id', agencyId)).data?.map(l => l.location_id) ?? [])
      .not('design_slug', 'is', null)
    navLinks.push(
      { href: '/admin/designs', label: 'Designs', count: designCount ?? 0 },
      { href: '/admin/plan-mapping', label: 'Plan Mapping', count: 0 },
    )
  }

  const bottomLinks: { href: string; label: string; count?: number }[] = [
    { href: '/admin/users', label: 'Users', count: userCount ?? 0 },
    { href: '/admin/account', label: 'Account & Billing' },
  ]
  if (caps.agencyMode) {
    bottomLinks.push({ href: '/admin/diagnostics', label: 'Diagnostics' })
  }

  return { navLinks, bottomLinks, agencyName, agencyId, initials: agencyName.slice(0, 2).toUpperCase(), email: ctx.role === 'super_admin' ? `${agencyName} (viewing as)` : '', viewingAsName: ctx.viewingAsName }
})

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const data = await getAdminData()
  if (!data) redirect('/agency')

  return (
    <div id="admin-layout" className="min-h-screen bg-[#f5f5f8]">
      {data.viewingAsName && (
        <div className="flex items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-900">
          Viewing {data.viewingAsName} as their admin
          <a href="/api/platform/view-as" className="rounded-lg bg-amber-900 px-2.5 py-1 text-[11px] font-bold text-amber-50">Stop</a>
        </div>
      )}
      <div className="mx-auto flex min-h-screen w-full max-w-[96rem] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside id="admin-sidebar" className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-6 space-y-4">
            <div
              className="overflow-hidden rounded-3xl border border-gray-200/70 bg-gradient-to-br from-white via-[color-mix(in_srgb,var(--brand)_4%,white)] to-[color-mix(in_srgb,var(--accent)_6%,white)] shadow-sm"
            >
              <div className="flex items-center gap-3 px-5 py-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/10 text-sm font-black text-brand ring-1 ring-brand/15">
                  {data.initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900 leading-none">{data.agencyName}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Agency admin</p>
                </div>
              </div>
              <div className="border-t border-gray-200/60 px-3 py-4">
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">Gestione</p>
                <AdminNavClient navLinks={data.navLinks} />
              </div>
              <div className="border-t border-gray-200/60 px-3 py-2">
                <AdminNavClient navLinks={data.bottomLinks} />
              </div>
              <div className="border-t border-gray-200/60 px-5 py-4">
                <p className="truncate text-[11px] font-medium text-gray-500 mb-2">{data.email}</p>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-gray-400">GHL Custom Dash</p>
                  <LogoutButton />
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className={`${ad.card} ${ad.cardPadding}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
