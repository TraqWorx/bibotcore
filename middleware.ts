import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ✅ Allow public routes INCLUDING redirect
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/redirect') || // <-- THIS WAS MISSING
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  let res = NextResponse.next({
    request: { headers: req.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // For /designs/* routes: inject locationId + check OAuth status
  if (pathname.startsWith('/designs')) {
    let locationId: string | null = req.nextUrl.searchParams.get('locationId')

    // Inject locationId if missing
    if (!locationId) {
      const { data: install } = await supabase
        .from('installs')
        .select('location_id')
        .eq('user_id', session.user.id)
        .limit(1)
        .single()

      if (install?.location_id) {
        locationId = install.location_id
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.searchParams.set('locationId', install.location_id)
        return NextResponse.redirect(redirectUrl)
      }
    }

    // If location needs OAuth, redirect to authorize page (skip if already on /authorize)
    if (locationId && !pathname.startsWith('/designs/authorize')) {
      const { data: conn } = await supabase
        .from('ghl_connections')
        .select('status, refresh_token')
        .eq('location_id', locationId)
        .single()

      if (conn && conn.status === 'pending_oauth' && !conn.refresh_token) {
        const authorizeUrl = req.nextUrl.clone()
        authorizeUrl.pathname = '/designs/authorize'
        authorizeUrl.searchParams.set('locationId', locationId)
        return NextResponse.redirect(authorizeUrl)
      }
    }
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/designs/:path*', '/agency', '/agency/:path*'],
}