import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-server'

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = typeof sp.locationId === 'string' ? sp.locationId : null

  if (!locationId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Missing locationId.</p>
      </div>
    )
  }

  // Get the design slug for this location
  const supabase = createAdminClient()
  const { data: install } = await supabase
    .from('installs')
    .select('design_slug')
    .eq('location_id', locationId)
    .maybeSingle()

  const designSlug = install?.design_slug ?? 'simfonia'

  // Build the OAuth URL — avoid URLSearchParams for scope to preserve slashes
  const scope =
    'contacts.readonly contacts.write opportunities.readonly opportunities.write ' +
    'calendars.readonly calendars.write calendars/events.readonly calendars/events.write ' +
    'conversations.readonly conversations.write conversations/message.readonly conversations/message.write ' +
    'locations.readonly locations.write locations/customFields.readonly locations/customFields.write ' +
    'users.readonly'
  const oauthParams = new URLSearchParams({
    response_type: 'code',
    redirect_uri: process.env.GHL_REDIRECT_URI!,
    client_id: process.env.GHL_CLIENT_ID!,
    version_id: process.env.GHL_APP_VERSION_ID!,
    state: `${designSlug}|admin`,
    locationId,
  })
  const oauthUrl =
    'https://marketplace.gohighlevel.com/oauth/chooselocation?' +
    oauthParams.toString() +
    '&scope=' + encodeURIComponent(scope).replace(/%2F/g, '/')

  // Check if connection already has OAuth tokens (user may have been redirected here stale)
  const { data: conn } = await supabase
    .from('ghl_connections')
    .select('refresh_token, status')
    .eq('location_id', locationId)
    .single()

  if (conn?.refresh_token && conn.status !== 'pending_oauth') {
    redirect(`/designs/${designSlug}/dashboard?locationId=${locationId}`)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center space-y-6">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: '#2A00CC' }}
        >
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>

        <div>
          <h1 className="text-xl font-bold text-gray-900">Autorizzazione Necessaria</h1>
          <p className="mt-2 text-sm text-gray-500">
            Per accedere ai tuoi contatti, pipeline e calendario, devi autorizzare l&apos;app
            sul tuo account GoHighLevel. Ci vorrà solo un momento.
          </p>
        </div>

        <a
          href={oauthUrl}
          className="inline-block w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: '#2A00CC' }}
        >
          Autorizza su GoHighLevel
        </a>

        <p className="text-xs text-gray-400">
          Verrai reindirizzato a GoHighLevel per completare l&apos;autorizzazione,
          poi tornerai automaticamente alla tua dashboard.
        </p>
      </div>
    </div>
  )
}
