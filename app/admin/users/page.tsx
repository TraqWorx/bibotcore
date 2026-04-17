import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import InviteUserForm from './_components/InviteUserForm'
import SyncUsersButton from './_components/SyncUsersButton'
import UsersTable from './_components/UsersTable'
import { ad } from '@/lib/admin/ui'

export default async function AdminUsersPage() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id) redirect('/login')

  const agencyId = profile.agency_id
  const isBibot = isBibotAgency(agencyId)

  // Scope profiles to this agency
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, role, created_at, location_id')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })

  const allProfiles = profiles ?? []

  // Fetch user↔location mappings for these users only
  const userIds = allProfiles.map((p) => p.id)
  const { data: allProfileLocations } = userIds.length > 0
    ? await supabase.from('profile_locations').select('user_id, location_id').in('user_id', userIds)
    : { data: [] }

  const locsByUser: Record<string, string[]> = {}
  for (const pl of allProfileLocations ?? []) {
    if (!locsByUser[pl.user_id]) locsByUser[pl.user_id] = []
    locsByUser[pl.user_id].push(pl.location_id)
  }
  for (const p of allProfiles) {
    if (p.location_id) {
      if (!locsByUser[p.id]) locsByUser[p.id] = []
      if (!locsByUser[p.id].includes(p.location_id)) locsByUser[p.id].push(p.location_id)
    }
  }

  const allLocationIds = [...new Set(Object.values(locsByUser).flat())]
  const nameByLocationId: Record<string, string> = {}
  if (allLocationIds.length > 0) {
    const { data: locationRows } = await supabase.from('locations').select('location_id, name').in('location_id', allLocationIds)
    for (const loc of locationRows ?? []) nameByLocationId[loc.location_id] = loc.name
  }

  const rows = allProfiles.map((p) => {
    const userLocs = locsByUser[p.id] ?? []
    return {
      id: p.id,
      email: p.email ?? null,
      role: p.role ?? null,
      locations: userLocs.map((id) => ({ id, name: nameByLocationId[id] ?? id })),
      createdAt: p.created_at ?? null,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={ad.pageTitle}>Users</h1>
          <p className={ad.pageSubtitle}>{allProfiles.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          {isBibot && <SyncUsersButton />}
          <InviteUserForm />
        </div>
      </div>
      {rows.length === 0 ? (
        <div className={ad.panel}>
          <p className="text-sm font-medium text-gray-500">No users yet.</p>
        </div>
      ) : (
        <UsersTable rows={rows} />
      )}
    </div>
  )
}
