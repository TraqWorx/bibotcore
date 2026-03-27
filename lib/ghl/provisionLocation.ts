import { createAdminClient } from '@/lib/supabase-server'

const GHL_BASE = 'https://services.leadconnectorhq.com'

/**
 * Fully provisions a GHL location into the platform:
 * 1. Fetches location name and saves to locations table
 * 2. Creates/updates ghl_connections with agency token
 * 3. Creates/updates installs row
 * 4. Runs syncLocationUsers → creates Supabase accounts for all GHL users
 *
 * This is used by both bulk-connect (admin) and the location.created webhook.
 */
export async function provisionLocation(
  locationId: string,
  designSlug: string
): Promise<void> {
  const agencyToken = process.env.GHL_AGENCY_TOKEN
  const companyId = process.env.GHL_COMPANY_ID
  if (!agencyToken || !companyId) {
    console.error('[provisionLocation] Missing GHL_AGENCY_TOKEN or GHL_COMPANY_ID')
    return
  }

  const supabase = createAdminClient()
  const expiresAt = '2099-12-31T00:00:00.000Z'

  // 1. Fetch location name
  let locationName: string | null = null
  try {
    const res = await fetch(`${GHL_BASE}/locations/${locationId}`, {
      headers: { Authorization: `Bearer ${agencyToken}`, Version: '2021-07-28' },
      cache: 'no-store',
    })
    if (res.ok) {
      const d = await res.json()
      locationName = d?.location?.name ?? d?.name ?? null
    } else {
      console.error(`[provisionLocation] GHL location fetch ${locationId}: HTTP ${res.status}`)
    }
  } catch { /* ignore */ }

  // Only save name if we actually got one from GHL (don't save the ID as name)
  if (locationName) {
    await supabase.from('locations').upsert(
      { location_id: locationId, name: locationName, updated_at: new Date().toISOString() },
      { onConflict: 'location_id' }
    )
  }

  // 2. Create ghl_connections placeholder (pending OAuth — agency token can't access location data)
  // Only insert if no connection exists yet; don't overwrite a real OAuth token
  const { data: existingConn } = await supabase
    .from('ghl_connections')
    .select('refresh_token')
    .eq('location_id', locationId)
    .maybeSingle()

  if (!existingConn?.refresh_token) {
    await supabase.from('ghl_connections').upsert(
      {
        location_id: locationId,
        company_id: companyId,
        access_token: agencyToken,
        refresh_token: null,
        expires_at: expiresAt,
        status: 'pending_oauth',
      },
      { onConflict: 'location_id' }
    )
  }

  // 3. Create/update install row
  const { data: existing } = await supabase
    .from('installs')
    .select('id')
    .eq('location_id', locationId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('installs')
      .update({ design_slug: designSlug, status: 'active', configured: false })
      .eq('id', existing.id)
  } else {
    await supabase.from('installs').insert({
      location_id: locationId,
      company_id: companyId,
      design_slug: designSlug,
      status: 'active',
      installed_at: new Date().toISOString(),
      configured: false,
    })
  }

  // 4. Sync GHL users → create Supabase accounts
  await syncLocationUsers(locationId, companyId, agencyToken, supabase)

  console.log(`[provisionLocation] done for ${locationId} (${locationName}) with design ${designSlug}`)
}

export async function syncLocationUsers(
  locationId: string,
  companyId: string,
  accessToken: string,
  supabase: ReturnType<typeof createAdminClient>
) {
  const res = await fetch(
    `${GHL_BASE}/users/search?companyId=${companyId}&locationId=${locationId}&limit=100`,
    { headers: { Authorization: `Bearer ${accessToken}`, Version: '2021-07-28' }, cache: 'no-store' }
  )
  if (!res.ok) {
    console.error(`[provisionLocation] GHL users fetch ${locationId}: HTTP ${res.status}`)
    return
  }
  const data = await res.json()
  const emails = ((data?.users ?? []) as { email?: string }[])
    .map((u) => u.email?.toLowerCase()).filter(Boolean) as string[]

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  for (const email of emails) {
    const { data: existing } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
    let profileId: string | null = existing?.id ?? null
    if (!profileId) {
      // Use inviteUserByEmail so the user gets a welcome email with login link
      const { data: invited, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/api/auth/callback`,
      })
      if (inviteErr) {
        if (inviteErr.message.toLowerCase().includes('already')) {
          const { data: page } = await supabase.auth.admin.listUsers({ perPage: 1000 })
          const found = page?.users?.find((u) => u.email?.toLowerCase() === email)
          if (found) profileId = found.id
        } else {
          console.error(`[provisionLocation] inviteUser failed for ${email}:`, inviteErr.message)
        }
      } else if (invited?.user) {
        profileId = invited.user.id
      }
    }

    if (!profileId) continue

    const { data: prof } = await supabase.from('profiles').select('id, role').eq('id', profileId).maybeSingle()
    if (prof?.role === 'super_admin') continue
    if (!prof) {
      await supabase.from('profiles').insert({ id: profileId, email, role: 'client' })
    }
    await supabase.from('profiles').update({ location_id: locationId }).eq('id', profileId)
    await supabase.from('installs').update({ user_id: profileId }).eq('location_id', locationId)
    console.log(`[provisionLocation] linked ${email} → ${locationId}`)
  }
}
