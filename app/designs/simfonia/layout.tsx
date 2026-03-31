import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { DEFAULT_THEME, DEFAULT_MODULES, type DesignTheme, type DesignModules } from '@/lib/types/design'
import GymSidebar from './_components/GymSidebar'
import LocationSwitcher from './_components/LocationSwitcher'

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  let locations: { location_id: string; design_slug: string | null; name: string }[] = []
  let currentLocationId = ''
  let finalTheme: DesignTheme = DEFAULT_THEME
  let finalModules: DesignModules = DEFAULT_MODULES

  if (user) {
    const supabase = createAdminClient()

    // ALL initial queries in parallel
    const [{ data: profile }, { data: connections }, { data: profileLocs }, { data: allInstalls }, { data: allLocationNames }, cookieStore] = await Promise.all([
      supabase.from('profiles').select('role, location_id').eq('id', user.id).single(),
      supabase.from('ghl_connections').select('location_id').order('location_id'),
      supabase.from('profile_locations').select('location_id').eq('user_id', user.id),
      supabase.from('installs').select('location_id, design_slug').not('design_slug', 'is', null),
      supabase.from('locations').select('location_id, name'),
      cookies(),
    ])

    const isSuperAdmin = profile?.role === 'super_admin'
    const connectedIds = new Set((connections ?? []).map((c) => c.location_id).filter(Boolean))

    // Determine which locations user can see
    let locationIds: string[]
    if (isSuperAdmin) {
      locationIds = [...connectedIds]
    } else {
      const fromDb = (profileLocs ?? []).map((r) => r.location_id)
      locationIds = fromDb.filter((id) => connectedIds.has(id))
      if (locationIds.length === 0 && profile?.location_id && connectedIds.has(profile.location_id)) {
        locationIds = [profile.location_id]
      }
    }

    // Build design map from pre-fetched installs
    const designByLocation: Record<string, string | null> = {}
    for (const i of allInstalls ?? []) {
      if (locationIds.includes(i.location_id)) {
        designByLocation[i.location_id] = i.design_slug
      }
    }

    const locationIdsWithDesign = locationIds.filter((id) => designByLocation[id])

    // Build name map from pre-fetched names
    const nameById: Record<string, string> = {}
    for (const r of allLocationNames ?? []) nameById[r.location_id] = r.name

    locations = locationIdsWithDesign.map((id) => ({
      location_id: id,
      design_slug: designByLocation[id] ?? null,
      name: nameById[id] ?? id,
    }))

    // Active location from cookie
    const cookieLocation = cookieStore.get('active_location_id')?.value
    currentLocationId =
      (cookieLocation && locationIds.includes(cookieLocation) ? cookieLocation : null) ??
      locations[0]?.location_id ??
      ''

    // Load design theme (1 parallel query)
    const designSlug = designByLocation[currentLocationId]
    if (designSlug) {
      const [{ data: design }, { data: locationSettings }] = await Promise.all([
        supabase.from('designs').select('theme, modules').eq('slug', designSlug).single(),
        supabase.from('location_design_settings').select('theme_overrides, module_overrides').eq('location_id', currentLocationId).single(),
      ])

      finalTheme = {
        ...DEFAULT_THEME,
        ...(design?.theme as Partial<DesignTheme> ?? {}),
        ...(locationSettings?.theme_overrides as Partial<DesignTheme> ?? {}),
      }
      finalModules = {
        ...DEFAULT_MODULES,
        ...(design?.modules as Partial<DesignModules> ?? {}),
        ...(locationSettings?.module_overrides as Partial<DesignModules> ?? {}),
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
