import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-server'
import { togglePackageField, togglePackageStatus, syncGhlPackages } from './_actions'
import SyncButton from './_components/SyncButton'
import { ad } from '@/lib/admin/ui'

export default async function AdminPackagesPage() {
  const supabase = createAdminClient()
  const { data: packages, error } = await supabase
    .from('packages')
    .select('id, slug, name, description, price_monthly, auto_install, auto_apply_design, status, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return <p className="text-sm text-red-600">Failed to load packages: {error.message}</p>
  }

  const rows = packages ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className={ad.pageTitle}>Packages</h1>
        <div className="flex items-center gap-3">
          <SyncButton syncAction={syncGhlPackages} />
          <Link
            href="/admin/packages/new"
            className={ad.btnPrimary}
          >
            New Package
          </Link>
        </div>
      </div>

      <div className={ad.tableShell}>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">No packages yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className={ad.tableHeadRow}>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Slug</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Price / mo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Auto Install</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Auto Design</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((pkg) => (
                <tr key={pkg.id ?? pkg.slug} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-medium text-gray-900">{pkg.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{pkg.slug}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {pkg.price_monthly != null ? `$${Number(pkg.price_monthly).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <form
                      action={async () => {
                        'use server'
                        await togglePackageField(pkg.id, 'auto_install', pkg.auto_install)
                      }}
                    >
                      <button
                        type="submit"
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          pkg.auto_install ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {pkg.auto_install ? 'Yes' : 'No'}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <form
                      action={async () => {
                        'use server'
                        await togglePackageField(pkg.id, 'auto_apply_design', pkg.auto_apply_design)
                      }}
                    >
                      <button
                        type="submit"
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          pkg.auto_apply_design ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {pkg.auto_apply_design ? 'Yes' : 'No'}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <form
                      action={async () => {
                        'use server'
                        await togglePackageStatus(pkg.id, pkg.status)
                      }}
                    >
                      <button
                        type="submit"
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          pkg.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {pkg.status}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/packages/${pkg.slug}/edit`}
                      className="text-xs font-bold text-brand underline-offset-4 transition-colors hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
