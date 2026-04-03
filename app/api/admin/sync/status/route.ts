import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Auth: super_admin only
  const cookieStore = await cookies()
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get all connected locations
  const { data: connections } = await sb
    .from('ghl_connections')
    .select('location_id')
    .not('access_token', 'is', null)

  if (!connections || connections.length === 0) {
    return NextResponse.json({ locations: [] })
  }

  const locationIds = connections.map((c) => c.location_id)

  // Fetch location names, sync statuses, and counts in parallel
  const [{ data: names }, { data: statuses }, ...countResults] = await Promise.all([
    sb.from('locations').select('location_id, name').in('location_id', locationIds),
    sb.from('sync_status').select('location_id, entity_type, status, last_synced_at, started_at, completed_at, error').in('location_id', locationIds),
    // Count cached entities per location
    ...['cached_contacts', 'cached_opportunities', 'cached_pipelines', 'cached_conversations', 'cached_custom_fields', 'cached_tags', 'cached_ghl_users', 'cached_calendar_events', 'cached_notes', 'cached_tasks'].map((table) =>
      sb.from(table).select('location_id', { count: 'exact', head: true }).in('location_id', locationIds)
        .then((r) => ({ table, count: r.count ?? 0 }))
    ),
  ])

  const nameMap = new Map((names ?? []).map((n) => [n.location_id, n.name]))
  const statusMap = new Map<string, typeof statuses>()
  for (const s of statuses ?? []) {
    if (!statusMap.has(s.location_id)) statusMap.set(s.location_id, [])
    statusMap.get(s.location_id)!.push(s)
  }

  // Build count map (simplified — counts are global, not per-location for now)
  const entityTypeMap: Record<string, string> = {
    cached_contacts: 'contacts', cached_opportunities: 'opportunities',
    cached_pipelines: 'pipelines', cached_conversations: 'conversations',
    cached_custom_fields: 'custom_fields', cached_tags: 'tags',
    cached_ghl_users: 'users', cached_calendar_events: 'calendar_events',
    cached_notes: 'notes', cached_tasks: 'tasks',
  }

  const locations = locationIds.map((id) => ({
    location_id: id,
    name: nameMap.get(id) ?? id,
    statuses: statusMap.get(id) ?? [],
    counts: Object.fromEntries(
      countResults.map((r) => {
        const res = r as { table: string; count: number }
        return [entityTypeMap[res.table] ?? res.table, res.count]
      })
    ),
  }))

  return NextResponse.json({ locations })
}
