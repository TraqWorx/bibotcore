import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-server'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { toggleAutomation, deleteAutomation } from './_actions'

const TRIGGER_LABELS: Record<string, string> = {
  contact_created:     'Contact Created',
  deal_created:        'Deal Created',
  deal_stage_changed:  'Deal Stage Changed',
  appointment_created: 'Appointment Created',
  message_received:    'Message Received',
}

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locationId = await getActiveLocation(await searchParams).catch(() => null)

  if (!locationId) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">No connected location.</p>
      </div>
    )
  }

  const supabase = createAdminClient()
  const { data: automations } = await supabase
    .from('automations')
    .select('id, name, trigger_type, active, created_at')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Automations</h1>
          <p className="mt-0.5 text-sm text-gray-500">Trigger actions when events happen in your CRM</p>
        </div>
        <Link
          href="/designs/simfonia/automations/new"
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-gray-900"
        >
          New Automation
        </Link>
      </div>

      {/* List */}
      {!automations?.length ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-gray-900">No automations yet</p>
          <p className="mt-1 text-sm text-gray-500">Create your first automation to start automating your workflow.</p>
          <Link
            href="/designs/simfonia/automations/new"
            className="mt-4 inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-all duration-150 ease-out hover:bg-gray-900"
          >
            Create Automation
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Trigger</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {automations.map((auto) => (
                <tr key={auto.id} className="group">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{auto.name}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {TRIGGER_LABELS[auto.trigger_type] ?? auto.trigger_type}
                  </td>
                  <td className="px-5 py-3.5">
                    <form action={async () => { await toggleAutomation(auto.id, auto.active) }}>
                      <button
                        type="submit"
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                          auto.active
                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${auto.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {auto.active ? 'Active' : 'Paused'}
                      </button>
                    </form>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <Link
                        href={`/designs/simfonia/automations/${auto.id}/edit`}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                      >
                        Edit
                      </Link>
                      <form action={async () => { await deleteAutomation(auto.id) }}>
                        <button
                          type="submit"
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
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
