import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GHL location ids are ~20-char alphanumeric; also accept UUIDs. Restricting to
// [A-Za-z0-9-] keeps the value safe to interpolate into start_url.
const LOCATION_ID_PATTERN = /^[A-Za-z0-9-]{15,40}$/

/**
 * GET /api/portal/manifest?locationId=xxx
 * Returns a PWA manifest for the portal so the icon shows when added to home screen.
 */
export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({}, { status: 400 })
  if (!LOCATION_ID_PATTERN.test(locationId)) {
    return NextResponse.json({}, { status: 400 })
  }

  const sb = createAdminClient()
  const [{ data: location }, { data: settings }] = await Promise.all([
    sb.from('locations').select('name').eq('location_id', locationId).single(),
    sb.from('location_settings').select('portal_icon_url').eq('location_id', locationId).single(),
  ])

  const name = location?.name ?? 'Portale Clienti'
  const iconUrl = settings?.portal_icon_url ?? null

  const manifest = {
    name,
    short_name: name.slice(0, 12),
    start_url: `/portal/${locationId}`,
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#2A00CC',
    icons: iconUrl ? [
      { src: iconUrl, sizes: '192x192', type: 'image/png' },
      { src: iconUrl, sizes: '512x512', type: 'image/png' },
    ] : [],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
