import fs from 'node:fs'
import path from 'node:path'
import { createAdminClient } from '@/lib/supabase-server'
import DesignsTable from './_components/DesignsTable'
import CreateDesignButton from './_components/CreateDesignButton'
import { ad } from '@/lib/admin/ui'

export const dynamic = 'force-dynamic'

/**
 * Auto-register design folders that exist in app/designs/* but aren't in
 * the designs table. New design folders show up in the catalog without a
 * manual SQL insert.
 */
async function autoRegisterDesigns(supabase: ReturnType<typeof createAdminClient>) {
  try {
    const dir = path.join(process.cwd(), 'app/designs')
    if (!fs.existsSync(dir)) return
    const folders = fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
      .map((d) => d.name)
    if (folders.length === 0) return
    const { data: known } = await supabase.from('designs').select('slug')
    const knownSlugs = new Set((known ?? []).map((d) => d.slug))
    const missing = folders.filter((slug) => !knownSlugs.has(slug))
    if (missing.length === 0) return
    const rows = missing.map((slug) => ({
      slug,
      name: slug.split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' '),
      is_default: false,
      theme: {},
      modules: {},
    }))
    await supabase.from('designs').upsert(rows, { onConflict: 'slug' })
  } catch (err) {
    console.error('[admin/designs] auto-register:', err)
  }
}

export default async function AdminDesignsPage() {
  const supabase = createAdminClient()
  await autoRegisterDesigns(supabase)
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
