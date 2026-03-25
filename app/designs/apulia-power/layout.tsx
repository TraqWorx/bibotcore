import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { DEFAULT_THEME, DEFAULT_MODULES, type DesignTheme, type DesignModules } from '@/lib/types/design'
import GymSidebar from './_components/GymSidebar'
import NotificationBell from './_components/NotificationBell'
import LocationSwitcher from './_components/LocationSwitcher'

const GHL_BASE = 'https://services.leadconnectorhq.com'

async function ghlAgencyGet(path: string) {
  const token = process.env.GHL_AGENCY_TOKEN
  if (!token) return null
  const res = await fetch(`${GHL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  let locations: { location_id: string; design_slug: string | null; name: string }[] = []
  let currentLocationId = ''
  let finalTheme: DesignTheme = DEFAULT_THEME
  let finalModules: DesignModules = DEFAULT_MODULES

  if (user) {
    const supabase = createAdminClient()

    // Check if super_admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const isSuperAdmin = profile?.role === 'super_admin'

    // Get all OAuth-connected locations
    const { data: connections } = await supabase
      .from('ghl_connections')
      .select('location_id')
      .order('location_id')

    const connectedIds = new Set((connections ?? []).map((c) => c.location_id).filter(Boolean))

    let locationIds: string[]

    if (isSuperAdmin) {
      // Super admin sees all connected locations
      locationIds = [...connectedIds]
    } else {
      // Regular user: locations from profile_locations, filtered to connected
      const { data: profileLocs } = await supabase
        .from('profile_locations')
        .select('location_id')
        .eq('user_id', user.id)

      const fromDb = (profileLocs ?? []).map((r) => r.location_id)
      locationIds = fromDb.filter((id) => connectedIds.has(id))

      // Fallback: profile.location_id
      if (locationIds.length === 0 && profile) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('location_id')
          .eq('id', user.id)
          .single()
        if (prof?.location_id && connectedIds.has(prof.location_id)) {
          locationIds = [prof.location_id]
        }
      }
    }

    // Get installs with a design for these locations
    const { data: installs } = locationIds.length
      ? await supabase
          .from('installs')
          .select('location_id, design_slug')
          .in('location_id', locationIds)
          .not('design_slug', 'is', null)
      : { data: [] }

    const designByLocation: Record<string, string | null> = {}
    for (const i of installs ?? []) {
      designByLocation[i.location_id] = i.design_slug
    }

    // Only show locations that have a design installed
    const locationIdsWithDesign = locationIds.filter((id) => designByLocation[id])

    // Fetch location names
    const { data: locationNameRows } = locationIdsWithDesign.length
      ? await supabase.from('locations').select('location_id, name').in('location_id', locationIdsWithDesign)
      : { data: [] }
    const nameById: Record<string, string> = {}
    for (const r of locationNameRows ?? []) nameById[r.location_id] = r.name

    locations = locationIdsWithDesign.map((id) => ({
      location_id: id,
      design_slug: designByLocation[id] ?? null,
      name: nameById[id] ?? id,
    }))

    // Determine active location: prefer cookie, fall back to first
    const cookieStore = await cookies()
    const cookieLocation = cookieStore.get('active_location_id')?.value
    currentLocationId =
      (cookieLocation && locationIds.includes(cookieLocation) ? cookieLocation : null) ??
      locations[0]?.location_id ??
      ''

    // Load design theme for active location
    const designSlug = designByLocation[currentLocationId]
    if (designSlug) {
      const [{ data: design }, { data: locationSettings }] = await Promise.all([
        supabase
          .from('designs')
          .select('theme, modules')
          .eq('slug', designSlug)
          .single(),
        supabase
          .from('location_design_settings')
          .select('theme_overrides')
          .eq('location_id', currentLocationId)
          .single(),
      ])

      finalTheme = {
        ...DEFAULT_THEME,
        ...(design?.theme as Partial<DesignTheme> ?? {}),
        ...(locationSettings?.theme_overrides as Partial<DesignTheme> ?? {}),
      }
      finalModules = {
        ...DEFAULT_MODULES,
        ...(design?.modules as Partial<DesignModules> ?? {}),
      }
    }
  }

  const cssVars = `:root { --brand: ${finalTheme.primaryColor}; --accent: ${finalTheme.secondaryColor}; }`

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <div className="flex min-h-screen bg-gray-50">
        <GymSidebar theme={finalTheme} modules={finalModules} locationId={currentLocationId} />
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-3">
            <Suspense fallback={null}>
              <LocationSwitcher
                locations={locations}
                currentLocationId={currentLocationId}
              />
            </Suspense>
            <div className="flex items-center gap-4">
              {user && <NotificationBell userId={user.id} />}
            </div>
          </header>
          <main className="flex-1 p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </>
  )
}
