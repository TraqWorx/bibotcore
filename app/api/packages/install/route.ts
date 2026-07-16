import { NextRequest, NextResponse } from 'next/server'
import { GHL_SCOPES } from '@/lib/ghl/scopes'
import { createOAuthState } from '@/lib/ghl/oauthState'
import { createAuthClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const packageSlug = req.nextUrl.searchParams.get('packageSlug')

  if (!packageSlug) {
    return NextResponse.json({ error: 'Missing packageSlug' }, { status: 400 })
  }

  // Bind the OAuth state to the initiating session so a captured callback URL
  // can't be replayed against another logged-in user to rebind their profile.
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', `/api/packages/install?packageSlug=${encodeURIComponent(packageSlug)}`)
    return NextResponse.redirect(loginUrl)
  }

  const scopes = GHL_SCOPES

  // Build URL manually to avoid URLSearchParams encoding slashes in scopes
  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: process.env.GHL_REDIRECT_URI!,
    client_id: process.env.GHL_CLIENT_ID!,
    version_id: process.env.GHL_APP_VERSION_ID!,
    state: createOAuthState({ flow: 'package_install', packageSlug, uid: user.id }),
  })

  const oauthUrl =
    'https://marketplace.gohighlevel.com/oauth/chooselocation?' +
    params.toString() +
    '&scope=' + encodeURIComponent(scopes).replace(/%2F/g, '/')

  return NextResponse.redirect(oauthUrl)
}
