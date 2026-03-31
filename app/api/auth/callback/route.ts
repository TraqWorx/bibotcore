import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null

  // Build redirect response first so we can attach cookies to it
  const redirectTo = searchParams.get('redirectTo')
  const redirectUrl = new URL(redirectTo ?? '/redirect', req.url)
  const response = NextResponse.redirect(redirectUrl)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Must set on the response, not cookieStore — otherwise cookies are lost on redirect
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let authError: string | null = null

  if (code) {
    // PKCE flow (OAuth, some email flows)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[auth/callback] exchangeCodeForSession error:', error.message)
      authError = error.message
    }
  } else if (token_hash && type) {
    // Magic link / OTP flow
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (error) {
      console.error('[auth/callback] verifyOtp error:', error.message)
      authError = error.message
    }
  }

  // If auth failed, redirect to login with error instead of silently failing
  if (authError) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.hash = `error_code=auth_error&error_description=${encodeURIComponent(authError)}`
    return NextResponse.redirect(loginUrl)
  }

  return response
}
