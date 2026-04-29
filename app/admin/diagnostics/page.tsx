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

interface DiagRow {
  locationId: string
  locationName: string
  expiresAt: string | null
  refreshedAt: string | null
  hasRefreshToken: boolean
  jwt: JwtInfo
  health: HealthCheck
  hasAffiliateScope: boolean
  affiliateCheck: HealthCheck
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

  const { data: connections } = await sb
    .from('ghl_connections')
    .select('location_id, access_token, refresh_token, expires_at, refreshed_at')
    .order('expires_at', { ascending: true, nullsFirst: true })

  const { data: locations } = await sb
    .from('locations')
    .select('location_id, name')
    .eq('agency_id', profile.agency_id)
  const nameMap = new Map((locations ?? []).map((l) => [l.location_id, l.name]))

  const rows: DiagRow[] = await Promise.all((connections ?? []).map(async (conn): Promise<DiagRow> => {
    const jwt = decodeJwt(conn.access_token)
    const hasAffiliateScope = jwt.scopes.some((s) => s.toLowerCase().includes('affiliate'))
    const [health, affiliateCheck] = await Promise.all([
      ping(`${GHL_BASE}/locations/${conn.location_id}`, conn.access_token),
      ping(`${GHL_BASE}/affiliate-manager/${conn.location_id}/affiliates`, conn.access_token),
    ])
    return {
      locationId: conn.location_id,
      locationName: nameMap.get(conn.location_id) ?? conn.location_id,
      expiresAt: conn.expires_at,
      refreshedAt: conn.refreshed_at,
      hasRefreshToken: Boolean(conn.refresh_token),
      jwt,
      health,
      hasAffiliateScope,
      affiliateCheck,
    }
  }))

  const totalOk = rows.filter((r) => r.health.ok).length
  const totalScopeIssues = rows.filter((r) => !r.hasAffiliateScope).length
  const totalDeadRefresh = rows.filter((r) => !r.health.ok && r.health.detail?.toLowerCase().includes('jwt')).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className={ad.pageTitle}>Diagnostics</h1>
        <p className={ad.pageSubtitle}>
          GHL token health for every connected location. Cron <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">refresh-ghl-tokens</code> runs every 6 hours and rotates tokens before they idle out.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Healthy</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">{totalOk}<span className="text-base font-bold text-gray-400">/{rows.length}</span></p>
        </div>
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Refresh tokens dead</p>
          <p className="mt-2 text-3xl font-black text-rose-600">{totalDeadRefresh}</p>
        </div>
        <div className={ad.panel}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Missing affiliate scope</p>
          <p className="mt-2 text-3xl font-black text-amber-600">{totalScopeIssues}</p>
        </div>
      </div>

      <div className={ad.tableShell}>
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className={ad.tableHeadRow}>
            <tr className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Auth class</th>
              <th className="px-4 py-3">Scopes</th>
              <th className="px-4 py-3">Affiliate</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Last refreshed</th>
              <th className="px-4 py-3 text-right">Health</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">No GHL connections yet.</td>
              </tr>
            )}
            {rows.map((r) => {
              const expired = r.expiresAt && new Date(r.expiresAt).getTime() < Date.now()
              const expiringSoon = r.expiresAt && new Date(r.expiresAt).getTime() - Date.now() < 12 * 60 * 60 * 1000
              return (
                <tr key={r.locationId} className="align-top">
                  <td className="px-4 py-4">
                    <div className="font-bold text-gray-900">{r.locationName}</div>
                    <div className="mt-1 font-mono text-[10px] text-gray-400">{r.locationId}</div>
                    {r.jwt.versionId && (
                      <div className="mt-1 font-mono text-[10px] text-gray-400">v: {r.jwt.versionId}</div>
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
                    {r.hasAffiliateScope
                      ? badge('green', 'In token')
                      : badge('amber', 'Missing')}
                    <div className="mt-1 text-[10px] text-gray-500">
                      {r.affiliateCheck.ok ? 'API ✓' : `API ${r.affiliateCheck.status}`}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className={`text-xs font-semibold ${expired ? 'text-rose-700' : expiringSoon ? 'text-amber-700' : 'text-gray-900'}`}>
                      {relTime(r.expiresAt)}
                    </div>
                    <div className="text-[10px] text-gray-400">{r.expiresAt ? new Date(r.expiresAt).toLocaleString() : '—'}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs font-semibold text-gray-900">{relTime(r.refreshedAt)}</div>
                    <div className="text-[10px] text-gray-400">{r.refreshedAt ? new Date(r.refreshedAt).toLocaleString() : 'never (since instrumented)'}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col items-end gap-2">
                      {r.health.ok
                        ? badge('green', 'OK')
                        : r.health.detail?.toLowerCase().includes('jwt')
                          ? badge('red', 'Reconnect')
                          : badge('amber', `HTTP ${r.health.status}`)}
                      {!r.health.ok && r.health.detail && (
                        <code className="text-right font-mono text-[10px] text-gray-500 line-clamp-2">{r.health.detail}</code>
                      )}
                      <div className="flex items-center gap-2">
                        <RefreshButton locationId={r.locationId} />
                        <Link href="/admin/locations" className="text-[10px] font-bold uppercase tracking-wide text-gray-500 hover:text-gray-900">
                          Reconnect →
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
          <li><strong>Affiliate</strong>: <em>In token</em> = scope present; <em>Missing</em> = the token has no affiliate scope, so /affiliate-manager calls will 401 regardless of validity.</li>
          <li><strong>Health</strong>: live <code>GET /locations/&#123;id&#125;</code>. <em>OK</em> = token works; <em>Reconnect</em> = JWT rejected (refresh token likely revoked too); other = unexpected error.</li>
          <li><strong>Last refreshed</strong>: shows <em>never</em> until the cron or a manual refresh rotates the token after migration 075. After that, it should never be older than ~6h.</li>
        </ul>
      </div>
    </div>
  )
}
