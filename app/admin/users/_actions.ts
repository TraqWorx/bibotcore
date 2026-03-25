'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'

async function assertSuperAdmin() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') throw new Error('Not authorized')
}

export async function inviteUser(
  email: string
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    if (!email) return { error: 'Email is required' }
    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    })
    if (error) return { error: error.message }
    revalidatePath('/admin/users')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to invite user' }
  }
}

export async function syncGhlUsers(): Promise<{ synced: number; removed: number; debug: string[]; error?: string }> {
  const log: string[] = []
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()
    const agencyToken = process.env.GHL_AGENCY_TOKEN
    const companyId = process.env.GHL_COMPANY_ID

    if (!agencyToken) return { synced: 0, removed: 0, debug: ['No GHL_AGENCY_TOKEN set'], error: 'Missing agency token' }

    let synced = 0
    let removed = 0

    // Fetch ALL locations from GHL (not just connected ones)
    const searchRes = await fetch(
      `https://services.leadconnectorhq.com/locations/search?limit=100${companyId ? `&companyId=${companyId}` : ''}`,
      { headers: { Authorization: `Bearer ${agencyToken}`, Version: '2021-07-28' } }
    )
    if (!searchRes.ok) {
      return { synced: 0, removed: 0, debug: [`GHL locations search: HTTP ${searchRes.status}`], error: 'Failed to fetch locations' }
    }
    const searchData = await searchRes.json()
    const allLocations: { id: string; name: string }[] = searchData?.locations ?? []
    log.push(`GHL locations: ${allLocations.length}`)

    for (const loc of allLocations) {
      try {
        const url = `https://services.leadconnectorhq.com/users/search?companyId=${companyId}&locationId=${loc.id}&limit=100`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${agencyToken}`, Version: '2021-07-28' },
        })
        if (!res.ok) {
          log.push(`  ${loc.name}: HTTP ${res.status}`)
          continue
        }

        const data = await res.json()
        const ghlEmails = new Set(
          ((data?.users ?? []) as { email?: string }[])
            .map((u) => u.email?.toLowerCase())
            .filter(Boolean) as string[]
        )
        log.push(`  ${loc.name}: ${ghlEmails.size} users`)

        // Current profiles linked to this location
        const { data: linkedProfiles } = await supabase
          .from('profiles')
          .select('id, email, role')
          .eq('location_id', loc.id)

        // Remove users no longer in GHL
        for (const profile of linkedProfiles ?? []) {
          if (profile.role === 'super_admin') continue
          const email = profile.email?.toLowerCase()
          if (email && !ghlEmails.has(email)) {
            log.push(`  → removing ${email} (no longer in GHL)`)
            const { error: delErr } = await supabase.auth.admin.deleteUser(profile.id)
            if (delErr) {
              log.push(`  → delete failed: ${delErr.message}`)
            } else {
              removed++
            }
          }
        }

        // Ensure existing linked profiles also have profile_locations rows
        for (const profile of linkedProfiles ?? []) {
          if (profile.role === 'super_admin') continue
          await supabase.from('profile_locations').upsert(
            { user_id: profile.id, location_id: loc.id },
            { onConflict: 'user_id,location_id' }
          )
        }

        // Add users new to GHL
        const linkedEmails = new Set(
          (linkedProfiles ?? []).map((p) => p.email?.toLowerCase()).filter(Boolean) as string[]
        )

        for (const email of ghlEmails) {
          if (linkedEmails.has(email)) continue

          log.push(`  → adding ${email}`)
          let profileId: string | null = null

          // Check if auth user already exists (different location)
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('email', email)
            .maybeSingle()

          if (existingProfile) {
            if (existingProfile.role === 'super_admin') {
              log.push(`  → skipping super_admin`)
              continue
            }
            profileId = existingProfile.id
          } else {
            // Create user without sending email (avoids rate limits)
            const { data: created, error: createErr } = await supabase.auth.admin.createUser({
              email,
              email_confirm: true,
            })
            if (createErr) {
              if (createErr.message.toLowerCase().includes('already')) {
                const { data: page } = await supabase.auth.admin.listUsers({ perPage: 1000 })
                const found = page?.users?.find((u) => u.email?.toLowerCase() === email)
                if (found) profileId = found.id
              } else {
                log.push(`  → create failed: ${createErr.message}`)
              }
            } else if (created?.user) {
              profileId = created.user.id
            }

            if (profileId) {
              const { data: prof } = await supabase.from('profiles').select('id').eq('id', profileId).maybeSingle()
              if (!prof) {
                await supabase.from('profiles').insert({ id: profileId, email, role: 'client' })
              }
            }
          }

          if (profileId) {
            // Link user ↔ location in junction table (many-to-many)
            await supabase.from('profile_locations').upsert(
              { user_id: profileId, location_id: loc.id },
              { onConflict: 'user_id,location_id' }
            )
            // Keep profiles.location_id as a default/primary location
            const { data: currentProfile } = await supabase.from('profiles').select('location_id').eq('id', profileId).single()
            if (!currentProfile?.location_id) {
              await supabase.from('profiles').update({ location_id: loc.id }).eq('id', profileId)
            }
            await supabase.from('installs').update({ user_id: profileId }).eq('location_id', loc.id)
            log.push(`  → linked ${email} to ${loc.id}`)
            synced++
          }
        }
      } catch (e) {
        log.push(`  ${loc.name}: exception ${e}`)
      }
    }

    revalidatePath('/admin/users')
    return { synced, removed, debug: log }
  } catch (err) {
    return { synced: 0, removed: 0, debug: log, error: err instanceof Error ? err.message : 'Failed to sync' }
  }
}

export async function generateLoginLink(
  userId: string
): Promise<{ url: string } | { error: string }> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single()

    if (!profile?.email) return { error: 'User email not found' }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
      options: { redirectTo: '/agency' },
    })

    if (error || !data.properties?.action_link) {
      return { error: error?.message ?? 'Failed to generate link' }
    }

    return { url: data.properties.action_link }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to generate link' }
  }
}

export async function deleteUser(
  userId: string
): Promise<{ error: string } | undefined> {
  try {
    await assertSuperAdmin()
    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) return { error: error.message }
    revalidatePath('/admin/users')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete user' }
  }
}
