import { createAdminClient } from '@/lib/supabase-server'
import InviteUserForm from './_components/InviteUserForm'
import SyncUsersButton from './_components/SyncUsersButton'
import UsersTable from './_components/UsersTable'

export default async function AdminUsersPage() {
  const supabase = createAdminClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, role, created_at, location_id')
    .order('created_at', { ascending: false })

  const allProfiles = profiles ?? []

  // Fetch all user↔location mappings
  const { data: allProfileLocations } = await supabase
    .from('profile_locations')
    .select('user_id, location_id')

  // Build map: userId → locationId[]
  const locsByUser: Record<string, string[]> = {}
  for (const pl of allProfileLocations ?? []) {
    if (!locsByUser[pl.user_id]) locsByUser[pl.user_id] = []
    locsByUser[pl.user_id].push(pl.location_id)
  }
  // Fallback: include profiles.location_id if not in junction table
  for (const p of allProfiles) {
    if (p.location_id) {
      if (!locsByUser[p.id]) locsByUser[p.id] = []
      if (!locsByUser[p.id].includes(p.location_id)) locsByUser[p.id].push(p.location_id)
    }
  }

  // Fetch location names
  const allLocationIds = [...new Set(Object.values(locsByUser).flat())]
  const nameByLocationId: Record<string, string> = {}

  if (allLocationIds.length > 0) {
    const { data: locationRows } = await supabase
      .from('locations')
      .select('location_id, name')
      .in('location_id', allLocationIds)
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
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500">{allProfiles.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncUsersButton />
          <InviteUserForm />
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-400">No users yet.</p>
        </div>
      ) : (
        <UsersTable rows={rows} />
      )}
    </div>
  )
}
