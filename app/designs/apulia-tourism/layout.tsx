import { Suspense, cache } from 'react'
import { cookies } from 'next/headers'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { DEFAULT_THEME, DEFAULT_MODULES, type DesignTheme, type DesignModules } from '@/lib/types/design'
import { resolveSimfoniaShell } from '@/lib/simfonia/shellTheme'
import Sidebar from './_components/Sidebar'
import LocationSwitcher from './_components/LocationSwitcher'
import './shell.css'

/**
 * Cached layout data loader — React `cache()` deduplicates across
 * the same server request, so layout + page don't double-query.
 */
const getLayoutData = cache(async () => {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  let locations: { location_id: string; design_slug: string | null; name: string }[] = []
  let currentLocationId = ''
  let finalTheme: DesignTheme = DEFAULT_THEME
  let finalModules: DesignModules = DEFAULT_MODULES

  if (user) {
    const supabase = createAdminClient()

    const [{ data: profile }, { data: connections }, { data: profileLocs }, cookieStore] = await Promise.all([
      supabase.from('profiles').select('role, location_id, agency_id').eq('id', user.id).single(),
      supabase.from('ghl_connections').select('location_id').order('location_id'),
      supabase.from('profile_locations').select('location_id').eq('user_id', user.id),
      cookies(),
    ])

    const isAdmin = profile?.role === 'admin'
    const connectedIds = new Set((connections ?? []).map((c) => c.location_id).filter(Boolean))

    let locationIds: string[]
    if (isAdmin && profile?.agency_id) {
      // Admins see all locations in their agency
      const { data: agencyLocs } = await supabase
        .from('locations')
        .select('location_id')
        .eq('agency_id', profile.agency_id)
      locationIds = (agencyLocs ?? []).map((l) => l.location_id).filter((id) => connectedIds.has(id))
    } else {
      // Everyone (including super_admin) — only locations they're associated with
      const fromDb = (profileLocs ?? []).map((r) => r.location_id)
      locationIds = fromDb.filter((id) => connectedIds.has(id))
      if (locationIds.length === 0 && profile?.location_id && connectedIds.has(profile.location_id)) {
        locationIds = [profile.location_id]
      }
    }

    const [{ data: installs }, { data: locationNames }] = locationIds.length > 0
      ? await Promise.all([
          supabase.from('installs').select('location_id, design_slug').in('location_id', locationIds).not('design_slug', 'is', null),
          supabase.from('locations').select('location_id, name').in('location_id', locationIds),
        ])
      : [{ data: [] }, { data: [] }]

    const designByLocation: Record<string, string | null> = {}
    for (const i of installs ?? []) {
      designByLocation[i.location_id] = i.design_slug
    }

    const locationIdsWithDesign = locationIds.filter((id) => designByLocation[id] === 'apulian-tourism-service')
    const nameById: Record<string, string> = {}
    for (const r of locationNames ?? []) nameById[r.location_id] = r.name

    locations = locationIdsWithDesign.map((id) => ({
      location_id: id,
      design_slug: designByLocation[id] ?? null,
      name: nameById[id] ?? id,
    }))

    const cookieLocation = cookieStore.get('active_location_id')?.value
    currentLocationId =
      (cookieLocation && locationIds.includes(cookieLocation) ? cookieLocation : null) ??
      locations[0]?.location_id ?? ''

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

  return { locations, currentLocationId, finalTheme, finalModules }
})

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const { locations, currentLocationId, finalTheme, finalModules } = await getLayoutData()
  const shellAccent = finalTheme.secondaryColor
  const shell = resolveSimfoniaShell(finalTheme)

  const cssVars = `:root {
    --brand: ${shellAccent};
    --accent: ${shellAccent};
    --foreground: ${shell.foreground};
    --shell-bg: ${shell.shellBg};
    --shell-surface: ${shell.shellSurface};
    --shell-canvas: ${shell.shellCanvas};
    --shell-muted: ${shell.shellMuted};
    --shell-line: ${shell.shellLine};
    --shell-soft: ${shell.shellSoft};
    --shell-soft-alt: ${shell.shellSoftAlt};
    --shell-tint: ${shell.shellTint};
    --shell-tint-strong: ${shell.shellTintStrong};
    --shell-sidebar: ${shell.shellSidebar};
  }`

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <div className="simfonia-shell flex min-h-screen">
        <Sidebar theme={finalTheme} modules={finalModules} locationId={currentLocationId} />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {locations.length > 1 && (
            <header className="app-top-bar flex items-center justify-between px-6 py-2.5 sm:px-8">
              <Suspense fallback={null}>
                <LocationSwitcher
                  locations={locations}
                  currentLocationId={currentLocationId}
                />
              </Suspense>
              <div className="flex items-center gap-4" />
            </header>
          )}
          <main className="flex-1 px-5 py-7 sm:px-8 sm:py-10">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </>
  )
}
