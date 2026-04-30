import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/redirect') ||
    pathname.startsWith('/portal/login') ||
    pathname.startsWith('/onboarding') ||
    /^\/designs\/[^/]+\/demo(?:\/.*)?$/.test(pathname) ||
    pathname.startsWith('/apulia/lead/') ||
    pathname.startsWith('/scope/') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  // Embed routes with token don't need session auth
  if (pathname.startsWith('/embed/') && req.nextUrl.searchParams.has('token')) {
    return NextResponse.next()
  }

  const res = NextResponse.next({
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
    if (pathname.startsWith('/portal/')) {
      const segments = pathname.split('/')
      const portalLocationId = segments[2] ?? ''
      loginUrl.pathname = '/portal/login'
      if (portalLocationId) loginUrl.searchParams.set('locationId', portalLocationId)
    } else {
      loginUrl.pathname = '/login'
    }
    return NextResponse.redirect(loginUrl)
  }

  if (pathname.startsWith('/designs')) {
    let locationId: string | null = req.nextUrl.searchParams.get('locationId')

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
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/platform/:path*', '/designs/:path*', '/agency', '/agency/:path*', '/portal/:path*', '/embed/:path*'],
}
