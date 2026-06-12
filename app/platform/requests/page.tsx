import { createAdminClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function PlatformRequestsPage() {
  const sb = createAdminClient()
  const { data: requests } = await sb
    .from('access_requests')
    .select('id, email, message, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  const rows = requests ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Access requests</h1>
        <p className="mt-1 text-sm text-gray-500">{rows.length} request{rows.length === 1 ? '' : 's'} from the landing page. Email service isn&apos;t wired yet, so review them here.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
              <th className="px-5 py-3">When</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length === 0 && <tr><td colSpan={3} className="px-5 py-10 text-center text-gray-400">No requests yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-gray-50/50">
                <td className="px-5 py-3 whitespace-nowrap text-gray-400">{new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-5 py-3 font-medium text-gray-800"><a href={`mailto:${r.email}`} className="hover:text-brand">{r.email}</a></td>
                <td className="px-5 py-3 max-w-md text-gray-600">{r.message || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
