import { createAdminClient } from '@/lib/supabase-server'
import { activateInstall } from './_actions'
import RetryButton from './_components/RetryButton'

export default async function InstallsPage() {
  const supabase = createAdminClient()

  const { data: installs } = await supabase
    .from('installs')
    .select('id, location_id, user_id, package_slug, design_slug, configured, install_status, last_error, installed_at')
    .order('installed_at', { ascending: false })

  const rows = installs ?? []

  // Resolve user emails via profiles
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))]
  let emailByUserId: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds)
    for (const p of profiles ?? []) {
      emailByUserId[p.id] = p.email ?? '—'
    }
  }

  const pending = rows.filter((r) => r.install_status === 'pending' || (!r.configured && !r.install_status))
  const needsRetry = rows.filter((r) => r.install_status === 'failed' || (r.last_error && !r.configured))

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Installs</h1>

      {needsRetry.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
            Failed / Needs Retry ({needsRetry.length})
          </h2>
          <div className="overflow-x-auto rounded-xl border border-red-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Design</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Error</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {needsRetry.map((install) => (
                  <tr key={install.id} className="border-b border-red-50 bg-red-50 last:border-0">
                    <td className="px-4 py-3 text-gray-700">
                      {install.user_id ? (emailByUserId[install.user_id] ?? install.user_id) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{install.location_id}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{install.design_slug ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-red-600 max-w-xs truncate">
                      {install.last_error ?? install.install_status}
                    </td>
                    <td className="px-4 py-3">
                      <RetryButton locationId={install.location_id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-orange-600">
            Pending ({pending.length})
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Package</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Requested</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((install) => (
                  <tr key={install.id} className="border-b border-orange-100 bg-orange-50 last:border-0">
                    <td className="px-4 py-3 text-gray-700">
                      {install.user_id ? (emailByUserId[install.user_id] ?? install.user_id) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{install.location_id}</td>
                    <td className="px-4 py-3 text-gray-700">{install.package_slug ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {install.installed_at ? new Date(install.installed_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <form
                        action={async () => {
                          'use server'
                          await activateInstall(install.id, install.location_id)
                        }}
                      >
                        <button
                          type="submit"
                          className="rounded-lg bg-[#2A00CC] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1A0099] transition-colors"
                        >
                          Activate
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          All Installs
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No installs yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Design</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Installer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Configured</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Installed</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((install) => {
                  const needsRetryRow = install.install_status === 'failed' || (install.last_error && !install.configured)
                  return (
                    <tr key={install.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 text-gray-700">
                        {install.user_id ? (emailByUserId[install.user_id] ?? install.user_id) : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{install.location_id}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{install.design_slug ?? '—'}</td>
                      <td className="px-4 py-3">
                        {install.install_status ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            install.install_status === 'installed' ? 'bg-green-50 text-green-700' :
                            install.install_status === 'failed' ? 'bg-red-50 text-red-700' :
                            install.install_status === 'installing' ? 'bg-blue-50 text-blue-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {install.install_status}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {install.configured ? (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Yes</span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {install.installed_at ? new Date(install.installed_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {needsRetryRow && <RetryButton locationId={install.location_id} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
