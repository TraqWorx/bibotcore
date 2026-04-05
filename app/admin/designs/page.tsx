import { createAdminClient } from '@/lib/supabase-server'
import DesignsTable from './_components/DesignsTable'
import CreateDesignButton from './_components/CreateDesignButton'
import { ad } from '@/lib/admin/ui'

export default async function AdminDesignsPage() {
  const supabase = createAdminClient()
  const { data: designs, error } = await supabase
    .from('designs')
    .select('id, slug, name, is_default, created_at')
    .order('name')

  if (error) {
    return <p className="text-sm text-red-600">Failed to load designs: {error.message}</p>
  }

  const rows = (designs ?? []).map((d) => ({ id: d.id, name: d.name, slug: d.slug }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className={ad.pageTitle}>Designs</h1>
        <CreateDesignButton />
      </div>

      {rows.length === 0 ? (
        <div className={ad.panel}>
          <p className="text-sm font-medium text-gray-500">No designs yet.</p>
        </div>
      ) : (
        <DesignsTable rows={rows} />
      )}
    </div>
  )
}
