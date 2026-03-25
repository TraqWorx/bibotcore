import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const packageSlug = req.nextUrl.searchParams.get('packageSlug')

  if (!packageSlug) {
    return NextResponse.json({ error: 'Missing packageSlug' }, { status: 400 })
  }

  const scopes = [
    'contacts.readonly',
    'contacts.write',
    'opportunities.readonly',
    'opportunities.write',
    'calendars.readonly',
    'calendars.write',
    'calendars/events.readonly',
    'calendars/events.write',
    'conversations.readonly',
    'conversations.write',
    'conversations/message.readonly',
    'conversations/message.write',
    'locations.readonly',
    'locations.write',
    'locations/customFields.readonly',
    'locations/customFields.write',
    'users.readonly',
  ].join(' ')

  // Build URL manually to avoid URLSearchParams encoding slashes in scopes
  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: process.env.GHL_REDIRECT_URI!,
    client_id: process.env.GHL_CLIENT_ID!,
    version_id: process.env.GHL_APP_VERSION_ID!,
    state: packageSlug,
  })

  const oauthUrl =
    'https://marketplace.gohighlevel.com/oauth/chooselocation?' +
    params.toString() +
    '&scope=' + encodeURIComponent(scopes).replace(/%2F/g, '/')

  return NextResponse.redirect(oauthUrl)
}
