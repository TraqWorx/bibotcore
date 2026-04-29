import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient, createAuthClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'
import { ad } from '@/lib/admin/ui'
import RefreshButton from './_components/RefreshButton'

export const dynamic = 'force-dynamic'

const GHL_BASE = 'https://services.leadconnectorhq.com'

interface JwtInfo {
  authClass?: string
  authClassId?: string
  scopes: string[]
  versionId?: string
  exp?: number
  decodeError?: string
}

interface HealthCheck {
  status: number
  ok: boolean
  detail?: string
}

interface CronHealthRow {
  jobname: string
  schedule: string
  active: boolean
  last_run_at: string | null
  last_status: string | null
  last_message: string | null
}

interface DiagRow {
  locationId: string
  locationName: string
  connected: boolean
  expiresAt: string | null
  refreshedAt: string | null
  hasRefreshToken: boolean
  jwt: JwtInfo
  health: HealthCheck | null
  hasAffiliateScope: boolean
  affiliateCheck: HealthCheck | null
  affiliateRelevant: boolean
  lastWebhookAt: string | null
}

interface IntegrationCheck {
  name: string
  ok: boolean
  detail: string
}

interface ConfigCheck {
  key: string
  state: 'set' | 'empty' | 'missing'
  required: boolean
}

function decodeJwt(token: string): JwtInfo {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return { scopes: [], decodeError: 'Not a JWT (private integration token?)' }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
    return {
      authClass: payload.authClass,
      authClassId: payload.authClassId,
      scopes: payload.oauthMeta?.scopes ?? [],
      versionId: payload.oauthMeta?.versionId ?? payload.versionId,
      exp: payload.exp,
    }
  } catch (err) {
    return { scopes: [], decodeError: err instanceof Error ? err.message : 'decode failed' }
  }
}

async function pingStripe(label: string, key: string | undefined): Promise<IntegrationCheck> {
  if (!key) return { name: label, ok: false, detail: 'env var missing' }
  if (key.length < 20) return { name: label, ok: false, detail: 'env var empty' }
  try {
    const r = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!r.ok) return { name: label, ok: false, detail: `HTTP ${r.status}` }
    return { name: label, ok: true, detail: 'OK' }
  } catch (err) {
    return { name: label, ok: false, detail: err instanceof Error ? err.message : 'fetch error' }
  }
}

async function pingAgencyToken(): Promise<IntegrationCheck> {
  const t = process.env.GHL_AGENCY_TOKEN
  const cid = process.env.GHL_COMPANY_ID
  if (!t) return { name: 'GHL agency token', ok: false, detail: 'env var missing' }
  if (!cid) return { name: 'GHL agency token', ok: false, detail: 'GHL_COMPANY_ID missing' }
  try {
    const r = await fetch(`${GHL_BASE}/locations/search?limit=1&companyId=${cid}`, {
      headers: { Authorization: `Bearer ${t}`, Version: '2021-07-28' },
    })
    if (!r.ok) return { name: 'GHL agency token', ok: false, detail: `HTTP ${r.status}` }
    return { name: 'GHL agency token', ok: true, detail: 'OK' }
  } catch (err) {
    return { name: 'GHL agency token', ok: false, detail: err instanceof Error ? err.message : 'fetch error' }
  }
}

function checkConfig(): ConfigCheck[] {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'GHL_AGENCY_TOKEN', 'GHL_COMPANY_ID', 'GHL_CLIENT_ID', 'GHL_CLIENT_SECRET',
    'GHL_REDIRECT_URI', 'GHL_APP_VERSION_ID',
    'STRIPE_SECRET_KEY', 'STRIPE_PRO_PRICE_ID', 'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_APP_URL', 'WEBHOOK_SECRET', 'CRON_SECRET', 'ANTHROPIC_API_KEY',
  ]
  const optional = ['STRIPE_GHL_SECRET_KEY', 'STRIPE_GHL_WEBHOOK_SECRET']
  return [...required.map((k) => ({ key: k, required: true })), ...optional.map((k) => ({ key: k, required: false }))]
    .map(({ key, required: req }) => {
      const val = process.env[key]
      const state: ConfigCheck['state'] = val == null ? 'missing' : val.length === 0 ? 'empty' : 'set'
      return { key, state, required: req }
    })
}

async function ping(url: string, token: string): Promise<HealthCheck> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
      cache: 'no-store',
    })
    if (res.ok) return { status: res.status, ok: true }
    const body = await res.text()
    return { status: res.status, ok: false, detail: body.slice(0, 220) }
  } catch (err) {
    return { status: 0, ok: false, detail: err instanceof Error ? err.message : 'fetch error' }
  }
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(ms)
  const sec = Math.round(abs / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)
  let phrase: string
  if (sec < 60) phrase = `${sec}s`
  else if (min < 60) phrase = `${min}m`
  else if (hr < 48) phrase = `${hr}h`
  else phrase = `${day}d`
  return ms < 0 ? `${phrase} ago` : `in ${phrase}`
}

function badge(color: 'green' | 'amber' | 'red' | 'gray', label: string) {
  const palette = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    gray: 'bg-gray-100 text-gray-700 ring-gray-500/20',
  }[color]
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${palette}`}>{label}</span>
}

export default async function DiagnosticsPage() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const sb = createAdminClient()
  const { data: profile } = await sb.from('profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id || !isBibotAgency(profile.agency_id)) redirect('/admin')

  const { data: cronJobs } = await sb.rpc('get_cron_health') as { data: CronHealthRow[] | null }

  // Run external integration pings in parallel — they all hit network.
  const [stripeSaas, stripeGhl, agencyTokenCheck] = await Promise.all([
    pingStripe('Stripe (SaaS)', process.env.STRIPE_SECRET_KEY),
    pingStripe('Stripe (Bibot customers)', process.env.STRIPE_GHL_SECRET_KEY),
    pingAgencyToken(),
  ])
  const integrations = [stripeSaas, stripeGhl, agencyTokenCheck]
  const configChecks = checkConfig()

  const { data: locations } = await sb
    .from('locations')
    .select('location_id, name')
    .eq('agency_id', profile.agency_id)
    .order('name', { ascending: true })

  const locationIds = (locations ?? []).map((l) => l.location_id)
  const { data: connections } = locationIds.length
    ? await sb
        .from('ghl_connections')
        .select('location_id, access_token, refresh_token, expires_at, refreshed_at')
        .in('location_id', locationIds)
    : { data: [] }
  const connByLoc = new Map((connections ?? []).map((c) => [c.location_id, c]))

  // Latest webhook received per location — drift detection. If a
  // location is connected but we haven't received a webhook in days,
  // GHL likely dropped the registration.
  const { data: webhookSamples } = locationIds.length
    ? await sb
        .from('ghl_webhook_events')
        .select('location_id, received_at')
        .in('location_id', locationIds)
        .order('received_at', { ascending: false })
        .limit(2000)
    : { data: [] as { location_id: string; received_at: string }[] }
  const lastWebhookByLoc = new Map<string, string>()
  for (const ev of webhookSamples ?? []) {
    if (!lastWebhookByLoc.has(ev.location_id)) lastWebhookByLoc.set(ev.location_id, ev.received_at)
  }

  const rows: DiagRow[] = await Promise.all((locations ?? []).map(async (loc): Promise<DiagRow> => {
    const conn = connByLoc.get(loc.location_id)
    // We surface affiliate scope info for every connected location now —
    // the scope is granted by the marketplace app version, so any re-authorized
    // location should have it. The Bibot subaccount is the only one that
    // actually exposes affiliate data, but visibility into scope state for
    // all locations helps spot drift.
    const isBibotLocation = /bibot/i.test(loc.name ?? '')

    if (!conn?.access_token) {
      return {
        locationId: loc.location_id,
        locationName: loc.name ?? loc.location_id,
        connected: false,
        expiresAt: null,
        refreshedAt: null,
        hasRefreshToken: false,
        jwt: { scopes: [] },
        health: null,
        hasAffiliateScope: false,
        affiliateCheck: null,
        affiliateRelevant: isBibotLocation,
        lastWebhookAt: lastWebhookByLoc.get(loc.location_id) ?? null,
      }
    }

    const jwt = decodeJwt(conn.access_token)
    const hasAffiliateScope = jwt.scopes.some((s) => s.toLowerCase().includes('affiliate'))
    const checks = await Promise.all([
      ping(`${GHL_BASE}/locations/${loc.location_id}`, conn.access_token),
      // Only ping the affiliate-manager API for the Bibot subaccount; other
      // locations may not have an affiliate manager configured at all.
      isBibotLocation
        ? ping(`${GHL_BASE}/affiliate-manager/${loc.location_id}/affiliates`, conn.access_token)
        : Promise.resolve(null),
    ])
    return {
      locationId: loc.location_id,
      locationName: loc.name ?? loc.location_id,
      connected: Boolean(conn.refresh_token),
      expiresAt: conn.expires_at,
      refreshedAt: conn.refreshed_at,
      hasRefreshToken: Boolean(conn.refresh_token),
      jwt,
      health: checks[0],
      hasAffiliateScope,
      affiliateCheck: checks[1],
      affiliateRelevant: isBibotLocation,
      lastWebhookAt: lastWebhookByLoc.get(loc.location_id) ?? null,
    }
  }))

  const connectedRows = rows.filter((r) => r.connected)
  const totalOk = connectedRows.filter((r) => r.health?.ok).length
  const totalNotConnected = rows.filter((r) => !r.connected).length
  const totalDeadRefresh = connectedRows.filter((r) => r.health && !r.health.ok && r.health.detail?.toLowerCase().includes('jwt')).length
  const bibotRow = rows.find((r) => r.affiliateRelevant && r.connected)
  const affiliateScopeOk = Boolean(bibotRow?.hasAffiliateScope)

  return (
    <div className="space-y-6">
      <div>
        <h1 className={ad.pageTitle}>Diagnostics</h1>
        <p className={ad.pageSubtitle}>
          Every Bibot location and the health of its GHL connection. Cron <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">refresh-ghl-tokens</code> runs every 6 hours and rotates tokens before they can go stale.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Healthy</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">{totalOk}<span className="text-base font-bold text-gray-400">/{connectedRows.length}</span></p>
        </div>
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Not connected</p>
          <p className="mt-2 text-3xl font-black text-gray-500">{totalNotConnected}<span className="text-base font-bold text-gray-400">/{rows.length}</span></p>
        </div>
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Refresh tokens dead</p>
          <p className="mt-2 text-3xl font-black text-rose-600">{totalDeadRefresh}</p>
        </div>
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Bibot affiliate scope</p>
          <p className={`mt-2 text-3xl font-black ${affiliateScopeOk ? 'text-emerald-600' : 'text-amber-600'}`}>{affiliateScopeOk ? 'OK' : bibotRow ? 'Missing' : '—'}</p>
        </div>
      </div>

      <div className={`${ad.panel} space-y-3`}>
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">External integrations</p>
          <p className="text-[10px] text-gray-400">Live ping</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {integrations.map((c) => (
            <div key={c.name} className="rounded-2xl border border-gray-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-900">{c.name}</span>
                {badge(c.ok ? 'green' : 'red', c.ok ? 'OK' : 'FAIL')}
              </div>
              <p className="mt-1 text-[10px] text-gray-500">{c.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`${ad.panel} space-y-3`}>
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Configuration</p>
          <p className="text-[10px] text-gray-400">Env var presence (values redacted)</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {configChecks.map((c) => {
            const color = c.state === 'set'
              ? 'green'
              : c.required
                ? 'red'
                : 'gray'
            return (
              <div key={c.key} className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2">
                <span className="font-mono text-[11px] text-gray-700">{c.key}</span>
                {badge(color, c.state)}
              </div>
            )
          })}
        </div>
      </div>

      <div className={`${ad.panel} space-y-3`}>
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Background jobs</p>
          <p className="text-[10px] text-gray-400">Last successful run per cron</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(cronJobs ?? []).map((job) => {
            const neverRan = !job.last_run_at
            const stale = !neverRan && (Date.now() - new Date(job.last_run_at!).getTime() > 8 * 60 * 60 * 1000)
            const failed = job.last_status && job.last_status !== 'succeeded'
            const color = !job.active ? 'gray' : failed ? 'red' : neverRan ? 'gray' : stale ? 'amber' : 'green'
            const label = !job.active ? 'paused' : failed ? job.last_status! : neverRan ? 'scheduled' : 'succeeded'
            return (
              <div key={job.jobname} className="rounded-2xl border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-gray-900">{job.jobname}</span>
                  {badge(color, label)}
                </div>
                <div className="mt-1 font-mono text-[10px] text-gray-400">{job.schedule}</div>
                <div className="mt-2 text-xs font-semibold text-gray-700">
                  {job.last_run_at ? relTime(job.last_run_at) : 'awaiting first tick'}
                </div>
                {job.last_run_at && (
                  <div className="text-[10px] text-gray-400">{new Date(job.last_run_at).toLocaleString()}</div>
                )}
              </div>
            )
          })}
          {(cronJobs ?? []).length === 0 && (
            <div className="col-span-3 text-xs text-gray-500">No cron jobs scheduled.</div>
          )}
        </div>
      </div>

      <div className={ad.tableShell}>
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead className={ad.tableHeadRow}>
            <tr className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Auth class</th>
              <th className="px-4 py-3">Scopes</th>
              <th className="px-4 py-3">Affiliate</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Last refreshed</th>
              <th className="px-4 py-3">Last webhook</th>
              <th className="px-4 py-3 text-right">Health</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">No locations yet.</td>
              </tr>
            )}
            {rows.map((r) => {
              const expired = r.expiresAt && new Date(r.expiresAt).getTime() < Date.now()
              const expiringSoon = r.expiresAt && new Date(r.expiresAt).getTime() - Date.now() < 12 * 60 * 60 * 1000

              if (!r.connected) {
                return (
                  <tr key={r.locationId} className="align-middle bg-gray-50/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700">{r.locationName}</span>
                        {r.affiliateRelevant && badge('gray', 'Bibot')}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-gray-400">{r.locationId}</div>
                    </td>
                    <td colSpan={6} className="px-4 py-2.5 text-xs text-gray-400">Not connected</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href="/admin/locations" className="text-[10px] font-bold uppercase tracking-wide text-brand hover:underline">
                        Connect →
                      </Link>
                    </td>
                  </tr>
                )
              }

              const webhookAgeMs = r.lastWebhookAt ? Date.now() - new Date(r.lastWebhookAt).getTime() : null
              const webhookStale = webhookAgeMs == null || webhookAgeMs > 7 * 24 * 60 * 60 * 1000

              return (
                <tr key={r.locationId} className="align-top">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{r.locationName}</span>
                      {r.affiliateRelevant && badge('gray', 'Bibot')}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-gray-400">{r.locationId}</div>
                    {r.jwt.versionId && (
                      <div className="mt-0.5 font-mono text-[10px] text-gray-400">v: {r.jwt.versionId}</div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {r.jwt.decodeError
                      ? badge('gray', 'PIT')
                      : r.jwt.authClass === 'Company'
                        ? badge('amber', 'Company')
                        : r.jwt.authClass === 'Location'
                          ? badge('green', 'Location')
                          : badge('gray', r.jwt.authClass ?? '—')}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs font-bold text-gray-900">{r.jwt.scopes.length}</span>
                    <span className="ml-1 text-[10px] text-gray-500">scopes</span>
                  </td>
                  <td className="px-4 py-4">
                    {r.hasAffiliateScope ? badge('green', 'In token') : badge('amber', 'Missing')}
                    {r.affiliateCheck && (
                      <div className="mt-1 text-[10px] text-gray-500">
                        {r.affiliateCheck.ok ? 'API ✓' : `API ${r.affiliateCheck.status}`}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className={`text-xs font-semibold ${expired ? 'text-rose-700' : expiringSoon ? 'text-amber-700' : 'text-gray-900'}`}>
                      {relTime(r.expiresAt)}
                    </div>
                    {r.expiresAt && (
                      <div className="text-[10px] text-gray-400">{new Date(r.expiresAt).toLocaleString()}</div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {r.refreshedAt ? (
                      <>
                        <div className="text-xs font-semibold text-gray-900">{relTime(r.refreshedAt)}</div>
                        <div className="text-[10px] text-gray-400">{new Date(r.refreshedAt).toLocaleString()}</div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-400">—</div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {r.lastWebhookAt ? (
                      <>
                        <div className={`text-xs font-semibold ${webhookStale ? 'text-amber-700' : 'text-gray-900'}`}>{relTime(r.lastWebhookAt)}</div>
                        <div className="text-[10px] text-gray-400">{new Date(r.lastWebhookAt).toLocaleString()}</div>
                      </>
                    ) : (
                      <div className="text-xs text-amber-700">never</div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col items-end gap-1.5">
                      {r.health?.ok
                        ? badge('green', 'OK')
                        : r.health?.detail?.toLowerCase().includes('jwt')
                          ? badge('red', 'Reconnect')
                          : badge('amber', `HTTP ${r.health?.status ?? '?'}`)}
                      {r.health && !r.health.ok && r.health.detail && (
                        <code className="text-right font-mono text-[10px] text-gray-500 line-clamp-2">{r.health.detail}</code>
                      )}
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <RefreshButton locationId={r.locationId} />
                        <span className="text-[10px] text-gray-300">·</span>
                        <Link href="/admin/locations" className="text-[10px] font-bold uppercase tracking-wide text-gray-500 hover:text-gray-900">
                          Reconnect
                        </Link>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className={`${ad.panel} space-y-2`}>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Legend</p>
        <ul className="space-y-1 text-xs text-gray-700">
          <li><strong>Auth class</strong>: <code>Location</code> = OAuth location-scoped, <code>Company</code> = needs locationToken exchange, <code>PIT</code> = Private Integration Token (40-char, no JWT).</li>
          <li><strong>Scopes</strong>: how many scopes the token grants. The OAuth app&apos;s <code>versionId</code> determines this — to add scopes, edit the marketplace app version then re-authorize.</li>
          <li><strong>Affiliate</strong>: <em>In token</em> = `affiliate-manager.readonly` scope is on the JWT; <em>Missing</em> = needs re-authorization after the marketplace app version is updated. The API ping below the badge runs only for the Bibot subaccount (the only one with affiliate data).</li>
          <li><strong>Health</strong>: live <code>GET /locations/&#123;id&#125;</code>. <em>OK</em> = token works; <em>Reconnect</em> = JWT rejected; <em>Not connected</em> = no OAuth install on this location yet.</li>
          <li><strong>Last refreshed</strong>: never older than ~2h once the cron has run after instrumentation.</li>
          <li><strong>Last webhook</strong>: timestamp of the most recent GHL event we received for this location. <em>never</em> or older than ~7 days suggests GHL dropped the webhook registration; reconnect to re-register.</li>
          <li><strong>External integrations</strong>: live ping of Stripe (both accounts) and the agency PIT — if one shows FAIL, anything depending on it is broken until fixed.</li>
          <li><strong>Configuration</strong>: env-var presence only (values redacted). Required keys missing/empty show red; optional ones show gray. Catches the &quot;empty string&quot; failure mode where <code>process.env.X = &apos;&apos;</code> bypasses null fallbacks.</li>
        </ul>
      </div>
    </div>
  )
}
