import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export default async function PortalInvoicesPage({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect(`/portal/login?locationId=${locationId}`)

  const sb = createAdminClient()
  const { data: portalUser } = await sb
    .from('portal_users')
    .select('contact_ghl_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!portalUser) redirect(`/portal/login?locationId=${locationId}`)

  const { data: invoices } = await sb
    .from('cached_invoices')
    .select('ghl_id, name, status, amount_due, amount_paid, currency, due_date, created_at_ghl')
    .eq('location_id', locationId)
    .eq('contact_ghl_id', portalUser.contact_ghl_id)
    .order('created_at_ghl', { ascending: false })

  const totalPaid = (invoices ?? []).reduce((s, i) => s + (Number(i.amount_paid) || 0), 0)
  const totalDue = (invoices ?? []).reduce((s, i) => s + (Number(i.amount_due) || 0), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Fatture e Pagamenti</h1>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Fatture</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{(invoices ?? []).length}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Totale Pagato</p>
          <p className="mt-2 text-3xl font-black text-green-600">
            {totalPaid.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Da Pagare</p>
          <p className={`mt-2 text-3xl font-black ${totalDue > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {totalDue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
      </div>

      {/* Invoices list */}
      {(invoices ?? []).length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
          <p className="text-sm text-gray-400">Nessuna fattura trovata.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Fattura</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Stato</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-widest text-gray-400">Importo</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-widest text-gray-400">Pagato</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-widest text-gray-400">Scadenza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(invoices ?? []).map((inv) => (
                <tr key={inv.ghl_id}>
                  <td className="px-5 py-3 font-medium text-gray-800">{inv.name ?? 'Fattura'}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      inv.status === 'paid' ? 'bg-green-50 text-green-700' :
                      inv.status === 'sent' ? 'bg-blue-50 text-blue-700' :
                      inv.status === 'overdue' ? 'bg-red-50 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {inv.status === 'paid' ? 'Pagata' :
                       inv.status === 'sent' ? 'Inviata' :
                       inv.status === 'overdue' ? 'Scaduta' :
                       inv.status ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-600">
                    {(Number(inv.amount_due) + Number(inv.amount_paid || 0)).toLocaleString('it-IT', { style: 'currency', currency: inv.currency ?? 'EUR' })}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-green-600">
                    {Number(inv.amount_paid || 0).toLocaleString('it-IT', { style: 'currency', currency: inv.currency ?? 'EUR' })}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-gray-500">
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString('it-IT') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
