import { createAdminClient } from '@/lib/supabase-server'
import { isBibotAgency } from '@/lib/isBibotAgency'

export const dynamic = 'force-dynamic'

const HOUR = 3600_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeCount(q: any): Promise<number> {
  try {
    const { count } = await q
    return count ?? 0
  } catch {
    return 0
  }
}

export default async function PlatformDiagnostics() {
  const sb = createAdminClient()
  const now = Date.now()

  const [agenciesRes, locationsRes, connectionsRes, subsRes, installsRes, syncRes] = await Promise.all([
    sb.from('agencies').select('id, name'),
    sb.from('locations').select('location_id, name, agency_id'),
    sb.from('ghl_connections').select('location_id, access_token, refresh_token, expires_at'),
    sb.from('agency_subscriptions').select('location_id, agency_id, status'),
    sb.from('installs').select('location_id, install_status, last_error'),
    sb.from('sync_status').select('location_id, status, last_synced_at, error'),
  ])

  const agencies = new Map((agenciesRes.data ?? []).map((a) => [a.id, a.name]))
  const locations = locationsRes.data ?? []
  const connByLoc = new Map((connectionsRes.data ?? []).map((c) => [c.location_id, c]))
  const activeSubLocs = new Set((subsRes.data ?? []).filter((s) => s.status === 'active').map((s) => s.location_id))
  const installByLoc = new Map((installsRes.data ?? []).map((i) => [i.location_id, i]))
  const lastSyncByLoc = new Map<string, { ts: number; error: boolean }>()
  for (const s of syncRes.data ?? []) {
    const ts = s.last_synced_at ? new Date(s.last_synced_at).getTime() : 0
    const prev = lastSyncByLoc.get(s.location_id)
    const error = s.status === 'failed' || !!s.error
    if (!prev || ts > prev.ts) lastSyncByLoc.set(s.location_id, { ts, error: error || (prev?.error ?? false) })
    else if (error && prev) prev.error = true
  }

  type Row = { locationId: string; name: string; agency: string; conn: string; lastSync: string; status: 'ok' | 'warn' | 'error' | 'idle'; note: string }
  const rows: Row[] = locations.map((loc) => {
    const conn = connByLoc.get(loc.location_id)
    const install = installByLoc.get(loc.location_id)
    const sync = lastSyncByLoc.get(loc.location_id)
    const subscribed = activeSubLocs.has(loc.location_id) || isBibotAgency(loc.agency_id)

    let connState: string
    if (!conn?.access_token) connState = 'not connected'
    else if (conn.expires_at && new Date(conn.expires_at).getTime() < now && !conn.refresh_token) connState = 'expired'
    else if (conn.expires_at && new Date(conn.expires_at).getTime() < now) connState = 'refreshing'
    else connState = 'connected'

    const syncAgeH = sync?.ts ? (now - sync.ts) / HOUR : Infinity
    const lastSync = sync?.ts ? `${Math.round(syncAgeH)}h ago` : '—'

    let status: Row['status'] = 'ok'
    let note = ''
    if (connState === 'not connected') { status = 'idle'; note = 'Not connected' }
    else if (connState === 'expired') { status = 'error'; note = 'Token expired (no refresh)' }
    else if (install?.install_status === 'failed') { status = 'error'; note = `Install failed: ${install.last_error ?? ''}`.slice(0, 60) }
    else if (sync?.error) { status = 'error'; note = 'Last sync failed' }
    else if (subscribed && syncAgeH > 48) { status = 'warn'; note = 'No sync in 48h+' }
    else if (subscribed && syncAgeH > 24) { status = 'warn'; note = 'Stale sync (24h+)' }
    else { status = 'ok'; note = 'Healthy' }

    return { locationId: loc.location_id, name: loc.name ?? loc.location_id, agency: agencies.get(loc.agency_id) ?? '—', conn: connState, lastSync, status, note }
  })

  const counts = {
    locations: rows.length,
    connected: rows.filter((r) => r.conn === 'connected' || r.conn === 'refreshing').length,
    errors: rows.filter((r) => r.status === 'error').length,
    warnings: rows.filter((r) => r.status === 'warn').length,
  }
  const activeSubs = activeSubLocs.size
  const failedInstalls = (installsRes.data ?? []).filter((i) => i.install_status === 'failed').length

  // Data-volume proxy for Supabase usage
  const [contacts, apuliaContacts, queuePending, webhooks24h] = await Promise.all([
    safeCount(sb.from('cached_contacts').select('*', { count: 'exact', head: true })),
    safeCount(sb.from('apulia_contacts').select('*', { count: 'exact', head: true })),
    safeCount(sb.from('apulia_sync_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    safeCount(sb.from('ghl_webhook_events').select('*', { count: 'exact', head: true }).gte('created_at', new Date(now - 24 * HOUR).toISOString())),
  ])

  const tone = (s: Row['status']) => s === 'error' ? 'bg-red-100 text-red-700' : s === 'warn' ? 'bg-amber-100 text-amber-700' : s === 'idle' ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700'
  // worst first
  const order = { error: 0, warn: 1, idle: 2, ok: 3 }
  rows.sort((a, b) => order[a.status] - order[b.status])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Diagnostics</h1>
        <p className="mt-1 text-sm text-gray-500">Health of every connected client + platform usage signals.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Locations', value: counts.locations, sub: `${counts.connected} connected` },
          { label: 'Errors', value: counts.errors, sub: 'need attention', tone: counts.errors ? 'text-red-600' : 'text-gray-900' },
          { label: 'Warnings', value: counts.warnings, sub: 'stale / degraded', tone: counts.warnings ? 'text-amber-600' : 'text-gray-900' },
          { label: 'Active subs', value: activeSubs, sub: `${failedInstalls} failed installs`, tone: failedInstalls ? 'text-red-600' : 'text-gray-900' },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{c.label}</p>
            <p className={`mt-2 text-3xl font-bold ${c.tone ?? 'text-gray-900'}`}>{c.value}</p>
            <p className="mt-0.5 text-xs text-gray-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Per-client health */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-700">Client health</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Location</th>
              <th className="px-5 py-3">Agency</th>
              <th className="px-5 py-3">Connection</th>
              <th className="px-5 py-3">Last sync</th>
              <th className="px-5 py-3">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No locations.</td></tr>}
            {rows.map((r) => (
              <tr key={r.locationId} className="hover:bg-gray-50/50">
                <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone(r.status)}`}>{r.status === 'ok' ? 'OK' : r.status === 'warn' ? 'Warn' : r.status === 'error' ? 'Error' : 'Idle'}</span></td>
                <td className="px-5 py-3 font-medium text-gray-800">{r.name}</td>
                <td className="px-5 py-3 text-gray-500">{r.agency}</td>
                <td className="px-5 py-3 text-gray-500">{r.conn}</td>
                <td className="px-5 py-3 text-gray-500 tabular-nums">{r.lastSync}</td>
                <td className="px-5 py-3 text-gray-400">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Infra & usage */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700">Data volume (Supabase)</h2>
          <p className="mt-1 text-xs text-gray-400">Row counts — a proxy for database size/usage.</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">cached_contacts</dt><dd className="font-semibold tabular-nums">{contacts.toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">apulia_contacts</dt><dd className="font-semibold tabular-nums">{apuliaContacts.toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">sync queue (pending)</dt><dd className={`font-semibold tabular-nums ${queuePending > 500 ? 'text-amber-600' : ''}`}>{queuePending.toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">webhooks (24h)</dt><dd className={`font-semibold tabular-nums ${webhooks24h === 0 ? 'text-amber-600' : ''}`}>{webhooks24h.toLocaleString()}</dd></div>
          </dl>
          <a href={`https://supabase.com/dashboard/project/qhnmoietamwjooqtrhas/reports/database`} target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs font-semibold text-brand hover:underline">Supabase usage dashboard →</a>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700">Vercel & Supabase limits</h2>
          <p className="mt-1 text-xs text-gray-400">Watch these against your plan limits:</p>
          <ul className="mt-3 space-y-1.5 text-xs text-gray-600">
            <li>• <strong>Vercel</strong>: bandwidth, function invocations + duration, build minutes</li>
            <li>• <strong>Supabase</strong>: database size, egress/bandwidth, MAU, storage</li>
          </ul>
          <div className="mt-4 flex flex-col gap-1.5">
            <a href="https://vercel.com/traqworxs-projects/bibotcore/usage" target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand hover:underline">Vercel usage →</a>
            <a href="https://supabase.com/dashboard/project/qhnmoietamwjooqtrhas/settings/billing/usage" target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand hover:underline">Supabase usage/billing →</a>
          </div>
          <p className="mt-4 rounded-lg bg-gray-50 p-3 text-[11px] text-gray-500">Live limit tracking here needs a <code>VERCEL_TOKEN</code> + <code>SUPABASE_ACCESS_TOKEN</code> — add them and I&apos;ll pull real usage vs. limits into this card.</p>
        </div>
      </div>
    </div>
  )
}
