import { createAdminClient } from '@/lib/supabase-server'
import ProvisionForm from './_components/ProvisionForm'

export default async function ProvisionPage() {
  const supabase = createAdminClient()
  const { data: locations } = await supabase
    .from('locations')
    .select('location_id, name')
    .order('name')

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Provision Location</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create custom fields, tags, and pipelines for a location. This will DELETE all existing custom fields first.
        </p>
      </div>
      <ProvisionForm locations={locations ?? []} />
    </div>
  )
}
