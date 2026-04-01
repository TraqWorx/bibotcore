import { createAdminClient } from '@/lib/supabase-server'
import { deletePlanMapping } from './_actions'
import AddMappingForm from './_components/AddMappingForm'
import SyncPlansButton from './_components/SyncPlansButton'
import { ad } from '@/lib/admin/ui'

export default async function AdminPlanMappingPage() {
  const supabase = createAdminClient()

  const [
    { data: plans },
    { data: designs },
    { data: designMaps },
  ] = await Promise.all([
    supabase.from('ghl_plans').select('ghl_plan_id, name').order('created_at', { ascending: false }),
    supabase.from('designs').select('slug, name').order('name'),
    supabase.from('plan_design_map').select('ghl_plan_id, design_slug'),
  ])

  const mapByPlanId: Record<string, { design_slug: string }> = {}
  for (const m of designMaps ?? []) mapByPlanId[m.ghl_plan_id] = m

  const allPlans = plans ?? []
  const mappedRows = allPlans
    .map((p) => ({ ...p, mapping: mapByPlanId[p.ghl_plan_id] ?? null }))
    .filter((r) => r.mapping !== null)

  const availablePlans = allPlans

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className={ad.pageTitle}>Plan → Design Mapping</h1>
        <SyncPlansButton />
      </div>

      <AddMappingForm designs={designs ?? []} plans={availablePlans} />

      <div className={ad.tableShell}>
        {mappedRows.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">No plan mappings yet. Sync GHL Plans, then map each plan to a design.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className={ad.tableHeadRow}>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">GHL Plan ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Design</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {mappedRows.map((row) => (
                <tr key={row.ghl_plan_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.ghl_plan_id}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.mapping!.design_slug}</td>
                  <td className="px-4 py-3 text-right">
                    <form
                      action={async () => {
                        'use server'
                        await deletePlanMapping(row.ghl_plan_id)
                      }}
                    >
                      <button
                        type="submit"
                        className="text-xs font-medium text-gray-400 transition-colors hover:text-red-600"
                      >
                        Delete
                      </button>
                    </form>
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
