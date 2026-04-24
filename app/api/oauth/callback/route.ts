import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { runDesignInstaller } from '@/lib/designInstaller/runDesignInstaller'
import { verifyOAuthState } from '@/lib/ghl/oauthState'
import { createAdminClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const rawState = req.nextUrl.searchParams.get('state') ?? ''
  const state = verifyOAuthState(rawState)
  const supabase = createAdminClient()

  if (!code) {
    return NextResponse.json(
      { error: 'Missing authorization code' },
      { status: 400 }
    )
  }
  if (!state) {
    return NextResponse.json(
      { error: 'Invalid or expired OAuth state' },
      { status: 400 }
    )
  }

  try {
    // Exchange code for tokens
    const res = await fetch(
      'https://services.leadconnectorhq.com/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.GHL_CLIENT_ID!,
          client_secret: process.env.GHL_CLIENT_SECRET!,
          redirect_uri: process.env.GHL_REDIRECT_URI!,
          code,
        }),
      }
    )

    const data = await res.json()
    if (!res.ok) return NextResponse.json(data, { status: res.status })

    console.log('[oauth/callback] Token response keys:', Object.keys(data))
    console.log('[oauth/callback] locationId:', data.locationId, 'location_id:', data.location_id)
    console.log('[oauth/callback] Token scopes granted:', data.scope)

    // Normalize locationId — v2 may not return it (company-level install)
    if (!data.locationId && data.location_id) data.locationId = data.location_id
    // Fall back to locationId from OAuth state
    if (!data.locationId && state.flow === 'connect_location' && state.locationId) {
      data.locationId = state.locationId
      console.log('[oauth/callback] Using locationId from state:', state.locationId)
    }
    if (!data.locationId) {
      const errorUrl = new URL('/admin/locations', req.url)
      errorUrl.searchParams.set('error', 'GHL did not return a location ID. Please try again.')
      return NextResponse.redirect(errorUrl)
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

    const isAdminFlow = state.flow === 'admin_design_install'
    const isConnectFlow = state.flow === 'connect_location'
    let packageSlug: string = state.flow === 'package_install' ? state.packageSlug : 'unknown'
    let designSlug: string | null = state.flow === 'admin_design_install' ? state.designSlug : null
    let autoInstall: boolean | null = state.flow === 'admin_design_install' ? true : null

    if (isAdminFlow && designSlug) {
      const { data: designRow } = await supabase
        .from('designs')
        .select('package_slug')
        .eq('slug', designSlug)
        .single()
      if (designRow?.package_slug) packageSlug = designRow.package_slug
    }

    // Check plan→design mapping first; fall back to package defaults
    const planId: string | undefined = data.planId ?? data.plan_id

    if (!isAdminFlow && planId) {
      const { data: planMap } = await supabase
        .from('plan_design_map')
        .select('design_slug, auto_install')
        .eq('ghl_plan_id', planId)
        .single()

      if (planMap) {
        designSlug = planMap.design_slug
        autoInstall = planMap.auto_install
      }
    }

    // Fall back to package-level defaults if no plan mapping found
    if (autoInstall === null) {
      const { data: pkg } = await supabase
        .from('packages')
        .select('auto_install')
        .eq('slug', packageSlug)
        .single()
      autoInstall = pkg?.auto_install ?? false
    }

    if (designSlug === null && autoInstall) {
      const { data: defaultDesign } = await supabase
        .from('designs')
        .select('slug')
        .eq('package_slug', packageSlug)
        .eq('is_default', true)
        .single()
      designSlug = defaultDesign?.slug ?? null
    }

    // Fetch location name from GHL and persist to locations table
    let locationName: string = data.locationId
    try {
      const locRes = await fetch(
        `https://services.leadconnectorhq.com/locations/${data.locationId}`,
        {
          headers: {
            Authorization: `Bearer ${data.access_token}`,
            Version: '2021-07-28',
          },
        }
      )
      if (locRes.ok) {
        const locData = await locRes.json()
        locationName = locData?.location?.name ?? locData?.name ?? data.locationId
      }
    } catch { /* fallback to locationId */ }

    await supabase
      .from('locations')
      .upsert(
        { location_id: data.locationId, name: locationName, updated_at: new Date().toISOString() },
        { onConflict: 'location_id' }
      )

    // ── connect_location flow: simple connect, no design/install ──
    if (isConnectFlow) {
      const expectedLocationId = state.locationId
      const ghlLocationId = data.locationId

      // If we expected a specific location, verify it matches
      if (expectedLocationId && expectedLocationId !== ghlLocationId) {
        const errorUrl = new URL('/admin/locations', req.url)
        errorUrl.searchParams.set('error', `You selected a different GHL location. Expected: ${expectedLocationId}, got: ${ghlLocationId}. Please try again and select the correct location.`)
        return NextResponse.redirect(errorUrl)
      }

      // Save GHL connection
      await supabase.from('ghl_connections').upsert(
        {
          location_id: ghlLocationId,
          company_id: data.companyId,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: expiresAt,
          status: 'active',
        },
        { onConflict: 'location_id' },
      )

      // Link location to the current user's agency
      const cookieStore = await cookies()
      const authClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } },
      )
      const { data: { user } } = await authClient.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('agency_id').eq('id', user.id).single()
        if (profile?.agency_id) {
          // Update the existing location record with GHL data
          await supabase.from('locations').update(
            { name: locationName, updated_at: new Date().toISOString() },
          ).eq('location_id', ghlLocationId).eq('agency_id', profile.agency_id)
        }
      }

      return NextResponse.redirect(new URL('/admin/locations?connected=true', req.url))
    }

    const connectionStatus = autoInstall ? 'active' : 'pending'

    // Upsert GHL connection
    await supabase
      .from('ghl_connections')
      .upsert(
        {
          location_id: data.locationId,
          company_id: data.companyId,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: expiresAt,
          package_slug: packageSlug,
          status: connectionStatus,
        },
        { onConflict: 'location_id' }
      )

    // Record install — admin flow uses manual check-then-upsert because there's
    // no unique constraint on location_id alone (only location_id,package_slug)
    if (isAdminFlow) {
      const { data: existingRow } = await supabase
        .from('installs')
        .select('id')
        .eq('location_id', data.locationId)
        .maybeSingle()

      if (existingRow) {
        await supabase
          .from('installs')
          .update({ design_slug: designSlug, status: connectionStatus, configured: false })
          .eq('id', existingRow.id)
      } else {
        await supabase.from('installs').insert({
          location_id: data.locationId,
          company_id: data.companyId,
          design_slug: designSlug,
          status: connectionStatus,
          installed_at: new Date().toISOString(),
          configured: false,
        })
      }
    } else {
      await supabase
        .from('installs')
        .upsert(
          {
            location_id: data.locationId,
            company_id: data.companyId,
            package_slug: packageSlug,
            design_slug: designSlug,
            status: connectionStatus,
            installed_at: new Date().toISOString(),
          },
          { onConflict: 'location_id,package_slug' }
        )
    }

    if (isAdminFlow) {
      // Admin connected this location — fetch GHL users, create Supabase accounts if needed, link all
      try {
        const effectiveCompanyId = data.companyId ?? process.env.GHL_COMPANY_ID
        const usersRes = await fetch(
          `https://services.leadconnectorhq.com/users/search?companyId=${effectiveCompanyId}&locationId=${data.locationId}&limit=100`,
          {
            headers: { Authorization: `Bearer ${data.access_token}`, Version: '2021-07-28' },
            cache: 'no-store',
          }
        )
        if (!usersRes.ok) {
          const body = await usersRes.text()
          console.error('[oauth/callback] GHL users fetch failed:', usersRes.status, body)
        } else {
          const usersData = await usersRes.json()
          const locationEmails = ((usersData?.users ?? []) as { email?: string }[])
            .map((u) => u.email?.toLowerCase())
            .filter(Boolean) as string[]

          console.log('[oauth/callback] GHL users for location:', data.locationId, locationEmails)

          for (const email of locationEmails) {
            // Find existing profile by email
            const { data: existing } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', email)
              .maybeSingle()

            let profileId: string | null = existing?.id ?? null

            if (!profileId) {
              // Check if a client profile is already linked to this location (email may have changed in GHL)
              const { data: existingByLocation } = await supabase
                .from('profiles')
                .select('id, email')
                .eq('location_id', data.locationId)
                .eq('role', 'agency')
                .maybeSingle()

              if (existingByLocation) {
                // Email changed — update auth + profile to new email
                profileId = existingByLocation.id
                const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(profileId!, { email })
                if (updateAuthErr) {
                  console.error('[oauth/callback] auth email update failed for', email, updateAuthErr.message)
                } else {
                  await supabase.from('profiles').update({ email }).eq('id', profileId)
                  console.log('[oauth/callback] updated email', existingByLocation.email, '→', email)
                }
              } else {
                // New user — create Supabase account so they can log in via magic link
                const { data: created, error: createErr } = await supabase.auth.admin.createUser({
                  email,
                  email_confirm: true,
                })
                if (createErr) {
                  console.error('[oauth/callback] createUser failed for', email, createErr.message)
                  // Auth user already exists but has no profile row — look up their ID
                  if (createErr.message.toLowerCase().includes('already')) {
                    const { data: usersPage } = await supabase.auth.admin.listUsers({ perPage: 1000 })
                    const found = usersPage?.users?.find((u) => u.email?.toLowerCase() === email)
                    console.log('[oauth/callback] listUsers found:', found?.id, found?.email, 'deleted_at:', (found as any)?.deleted_at)
                    if (found) profileId = found.id
                  }
                } else if (created?.user) {
                  profileId = created.user.id
                }

                if (profileId) {
                  // Ensure profile row exists (DB trigger may or may not create it)
                  const { data: prof } = await supabase
                    .from('profiles')
                    .select('id, role')
                    .eq('id', profileId)
                    .maybeSingle()
                  if (prof?.role === 'super_admin') {
                    console.error('[oauth/callback] listUsers returned super_admin for', email, '— fix auth email in Supabase dashboard')
                    profileId = null
                  } else if (!prof) {
                    const { error: insertErr } = await supabase
                      .from('profiles')
                      .insert({ id: profileId, email, role: 'agency' })
                    if (insertErr) {
                      console.error('[oauth/callback] profile insert failed:', insertErr.message, insertErr.code)
                      profileId = null
                    } else {
                      console.log('[oauth/callback] profile inserted for', email)
                    }
                  }
                }
              }
            }

            if (profileId) {
              const { error: profUpdateErr } = await supabase
                .from('profiles')
                .update({ location_id: data.locationId })
                .eq('id', profileId)
              const { error: installUpdateErr } = await supabase
                .from('installs')
                .update({ user_id: profileId })
                .eq('location_id', data.locationId)
              console.log('[oauth/callback] linked', email, '→', data.locationId, '| profErr:', profUpdateErr?.message, 'installErr:', installUpdateErr?.message)
            }
          }
        }
      } catch (err) {
        console.error('[oauth/callback] admin user linking error:', err)
      }
    } else {
      // Regular install flow — attach location to the installing user's profile
      const cookieStore = await cookies()
      const authClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll() },
            setAll() {},
          },
        }
      )

      const { data: { user } } = await authClient.auth.getUser()
      if (user) {
        await Promise.all([
          supabase
            .from('profiles')
            .update({ location_id: data.locationId })
            .eq('id', user.id),
          supabase
            .from('installs')
            .update({ user_id: user.id })
            .eq('location_id', data.locationId)
            .eq('package_slug', packageSlug),
        ])
      }
    }

    // Run design installer only if not already configured
    if (designSlug) {
      const { data: existingInstall } = await supabase
        .from('installs')
        .select('configured')
        .eq('location_id', data.locationId)
        .eq('design_slug', designSlug)
        .single()

      if (!existingInstall?.configured) {
        runDesignInstaller(data.locationId, designSlug).catch((err) =>
          console.error('[oauth/callback] runDesignInstaller failed:', err)
        )
      }
    }

    // Auto-sync: populate the cache immediately so the new location has data
    import('@/lib/sync/bulkSync').then(({ bulkSyncLocation }) => {
      bulkSyncLocation(data.locationId).catch((err) =>
        console.error('[oauth/callback] bulkSync failed:', err)
      )
    })

    if (isAdminFlow) {
      return NextResponse.redirect(new URL('/admin/locations', req.url))
    }

    if (autoInstall) {
      const dashPath = designSlug ? `/designs/${designSlug}/dashboard` : '/designs/simfonia/dashboard'
      return NextResponse.redirect(new URL(dashPath, req.url))
    }

    return NextResponse.redirect(new URL('/install/design', req.url))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[oauth/callback] error:', message)
    const errorUrl = new URL('/admin/locations', req.url)
    errorUrl.searchParams.set('error', `Connection failed: ${message}`)
    return NextResponse.redirect(errorUrl)
  }
}
