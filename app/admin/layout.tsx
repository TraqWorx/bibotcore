import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import AdminNavClient from './_components/AdminNavClient'
import LogoutButton from './_components/LogoutButton'
import { ad } from '@/lib/admin/ui'

const getAdminData = cache(async () => {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role, agency_id').eq('id', user.id).single()

  // Must have an agency to access /admin
  if (!profile?.agency_id) return null

  const agencyId = profile.agency_id
  const { data: agency } = await admin.from('agencies').select('name, owner_user_id').eq('id', agencyId).single()
  if (!agency) return null

  // Only agency owner can access /admin
  if (agency.owner_user_id !== user.id) return null

  const agencyName = agency.name

  // Count data scoped to the agency
  const [{ count: userCount }, { count: locationCount }] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId),
    admin.from('locations').select('location_id', { count: 'exact', head: true }).eq('agency_id', agencyId),
  ])

  const navLinks = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/users', label: 'Users', count: userCount ?? 0 },
    { href: '/admin/locations', label: 'Locations', count: locationCount ?? 0 },
    { href: '/admin/billing', label: 'Billing' },
  ]

  // Agencies with installed designs get Designs + Plan Mapping
  if (agencyId) {
    const { count: designCount } = await admin.from('installs').select('id', { count: 'exact', head: true })
      .in('location_id', (await admin.from('locations').select('location_id').eq('agency_id', agencyId)).data?.map(l => l.location_id) ?? [])
      .not('design_slug', 'is', null)
    if ((designCount ?? 0) > 0) {
      navLinks.push(
        { href: '/admin/designs', label: 'Designs', count: designCount ?? 0 },
        { href: '/admin/plan-mapping', label: 'Plan Mapping', count: 0 },
      )
    }
  }

  return { navLinks, agencyName, agencyId, initials: agencyName.slice(0, 2).toUpperCase() }
})

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const data = await getAdminData()
  if (!data) redirect('/agency')

  return (
    <div className="min-h-screen bg-[#f5f5f8]">
      <div className="mx-auto flex min-h-screen w-full max-w-[96rem] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 lg:block">
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
              <div className="flex items-center justify-between border-t border-gray-200/60 px-5 py-4">
                <p className="text-[10px] text-gray-400">GHL Dash © 2026</p>
                <LogoutButton />
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
