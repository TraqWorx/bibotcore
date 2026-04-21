import { NextRequest, NextResponse } from 'next/server'
import { GHL_SCOPES } from '@/lib/ghl/scopes'
import { createOAuthState } from '@/lib/ghl/oauthState'

export async function GET(req: NextRequest) {
  const packageSlug = req.nextUrl.searchParams.get('packageSlug')

  if (!packageSlug) {
    return NextResponse.json({ error: 'Missing packageSlug' }, { status: 400 })
  }

  const scopes = GHL_SCOPES

  // Build URL manually to avoid URLSearchParams encoding slashes in scopes
  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: process.env.GHL_REDIRECT_URI!,
    client_id: process.env.GHL_CLIENT_ID!,
    version_id: process.env.GHL_APP_VERSION_ID!,
    state: createOAuthState({ flow: 'package_install', packageSlug }),
  })

  const oauthUrl =
    'https://marketplace.gohighlevel.com/oauth/chooselocation?' +
    params.toString() +
    '&scope=' + encodeURIComponent(scopes).replace(/%2F/g, '/')

  return NextResponse.redirect(oauthUrl)
}
