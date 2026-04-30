/**
 * Sync GHL users across all connected locations into Supabase.
 * Creates auth accounts, profiles, and profile_locations entries.
 * Also removes profile_locations entries for users no longer in GHL.
 */

import { createAdminClient } from '@/lib/supabase-server'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'

const GHL_BASE = 'https://services.leadconnectorhq.com'

export async function syncAllLocationUsers(filterLocationId?: string): Promise<{
  locations: number
  usersCreated: number
  usersLinked: number
  errors: string[]
}> {
  const sb = createAdminClient()
  let usersCreated = 0
  let usersLinked = 0
  const errors: string[] = []

  const agencyToken = process.env.GHL_AGENCY_TOKEN
  const companyId = process.env.GHL_COMPANY_ID ?? ''

  // Get locations (all or filtered)
  let query = sb.from('locations').select('location_id')
  if (filterLocationId) query = query.eq('location_id', filterLocationId)
  const { data: allLocations } = await query

  if (!allLocations || allLocations.length === 0) {
    return { locations: 0, usersCreated: 0, usersLinked: 0, errors: [] }
  }

  // Get OAuth connections for token lookup
  const { data: connections } = await sb
    .from('ghl_connections')
    .select('location_id, company_id, access_token, refresh_token')

  const connMap = new Map((connections ?? []).map((c) => [c.location_id, c]))

  // Pre-load all auth users ONCE (paginated). Used to resolve "already
  // exists" without doing a list-all-users call inside the per-user loop.
  const authByEmail = new Map<string, string>()
  {
    let page = 1
    while (true) {
      const { data } = await sb.auth.admin.listUsers({ perPage: 1000, page })
      const users = data?.users ?? []
      for (const u of users) {
        if (u.email) authByEmail.set(u.email.toLowerCase(), u.id)
      }
      if (users.length < 1000) break
      page++
      if (page > 30) break
    }
  }

  for (const loc of allLocations) {
    const conn = connMap.get(loc.location_id)
    try {
      // Get token: OAuth first, fall back to agency token
      let token: string | null = null
      if (conn?.refresh_token) {
        try {
          token = await getGhlTokenForLocation(loc.location_id)
        } catch {
          token = conn.access_token
        }
      } else if (agencyToken) {
        token = agencyToken
      }

      if (!token) {
        errors.push(`${loc.location_id}: no token available`)
        continue
      }

      // Fetch GHL users for this location
      const res = await fetch(
        `${GHL_BASE}/users/search?companyId=${conn?.company_id ?? companyId}&locationId=${loc.location_id}&limit=100`,
        { headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' }, cache: 'no-store' },
      )

      if (!res.ok) {
        errors.push(`${loc.location_id}: GHL users fetch HTTP ${res.status}`)
        continue
      }

      const data = await res.json()
      const ghlUsers = (data?.users ?? []) as { id?: string; email?: string; name?: string; firstName?: string; lastName?: string; roles?: { role?: string } }[]
      const ghlEmails = new Set(ghlUsers.map((u) => u.email?.toLowerCase()).filter(Boolean) as string[])

      // Sync each GHL user into Supabase
      for (const ghlUser of ghlUsers) {
        const email = ghlUser.email?.toLowerCase()
        if (!email) continue

        // Find or create Supabase user
        const { data: profile } = await sb.from('profiles').select('id, role').eq('email', email).maybeSingle()
        let profileId = profile?.id

        if (!profileId) {
          // Try the pre-built auth map first — covers users that exist in
          // auth.users but never got a profiles row (a common drift state).
          const knownAuthId = authByEmail.get(email)
          if (knownAuthId) {
            profileId = knownAuthId
          } else {
            // No auth user yet: create one (no invite email).
            const { data: created, error: createErr } = await sb.auth.admin.createUser({
              email,
              email_confirm: true,
            })

            if (createErr) {
              if (createErr.message.toLowerCase().includes('already')) {
                // Race or stale map — re-resolve.
                const id = authByEmail.get(email)
                if (id) profileId = id
              } else {
                errors.push(`${loc.location_id}: createUser ${email}: ${createErr.message}`)
                continue
              }
            } else if (created?.user) {
              profileId = created.user.id
              authByEmail.set(email, created.user.id)
              usersCreated++
            }
          }
        }

        // Always reconcile the profiles row regardless of which branch
        // resolved profileId. Without this, auth-only users (no profile)
        // got linked in profile_locations but stayed invisible to the UI,
        // which counts profiles. That's why Apulia showed 84/101.
        if (profileId) {
          const { data: existingProf } = await sb.from('profiles').select('id, email').eq('id', profileId).maybeSingle()
          if (!existingProf) {
            await sb.from('profiles').upsert({ id: profileId, email, role: 'agency' }, { onConflict: 'id' })
          } else if (!existingProf.email) {
            await sb.from('profiles').update({ email }).eq('id', profileId)
          }
        }

        if (!profileId || profile?.role === 'super_admin') continue

        // Update profile email if changed in GHL
        if (profile && profile.role !== 'super_admin') {
          await sb.from('profiles').update({ location_id: loc.location_id }).eq('id', profileId)
        }

        // Ensure profile_locations entry
        const ghlRole = ghlUser.roles?.role
        const defaultRole = ghlRole === 'admin' ? 'location_admin' : 'team_member'

        await sb.from('profile_locations').upsert(
          { user_id: profileId, location_id: loc.location_id, role: defaultRole },
          { onConflict: 'user_id,location_id' },
        )
        usersLinked++
      }

      // Remove users from profile_locations that are no longer in GHL for this location
      const { data: currentMembers } = await sb
        .from('profile_locations')
        .select('user_id')
        .eq('location_id', loc.location_id)

      for (const member of currentMembers ?? []) {
        const { data: memberProfile } = await sb.from('profiles').select('email, role').eq('id', member.user_id).maybeSingle()
        if (!memberProfile || memberProfile.role === 'super_admin') continue
        if (memberProfile.email && !ghlEmails.has(memberProfile.email.toLowerCase())) {
          await sb.from('profile_locations').delete()
            .eq('user_id', member.user_id)
            .eq('location_id', loc.location_id)
          console.log(`[syncAllUsers] removed ${memberProfile.email} from ${loc.location_id}`)
        }
      }
    } catch (err) {
      errors.push(`${loc.location_id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { locations: allLocations.length, usersCreated, usersLinked, errors }
}
