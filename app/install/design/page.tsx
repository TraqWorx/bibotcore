import { redirect } from 'next/navigation'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import DesignPicker from './_components/DesignPicker'

export default async function DesignSelectionPage() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect('/login')

  const supabase = createAdminClient()

  // Find user's pending (unconfigured) install
  const { data: install } = await supabase
    .from('installs')
    .select('id, location_id, package_slug')
    .eq('user_id', user.id)
    .eq('configured', false)
    .order('installed_at', { ascending: false })
    .limit(1)
    .single()

  if (!install) {
    const { data: anyInstall } = await supabase
      .from('installs').select('location_id, design_slug').eq('user_id', user.id).limit(1).single()
    const slug = anyInstall?.design_slug ?? 'simfonia'
    redirect(`/designs/${slug}/dashboard${anyInstall?.location_id ? `?locationId=${anyInstall.location_id}` : ''}`)
  }

  // Load designs
  const designQuery = supabase
    .from('designs')
    .select('id, slug, name, is_default')
    .order('is_default', { ascending: false })

  // Filter by package if available
  if (install.package_slug) {
    designQuery.eq('package_slug', install.package_slug)
  }

  const { data: designs } = await designQuery

  if (!designs || designs.length === 0) {
    const slug = 'simfonia'
    redirect(`/designs/${slug}/dashboard?locationId=${install.location_id}`)
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-50 px-4 pt-16">
      <div className="w-full max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Choose your design</h1>
          <p className="mt-1 text-sm text-gray-500">
            Select a design theme for your CRM. You can change this later from the admin panel.
          </p>
        </div>
        <DesignPicker installId={install.id} designs={designs} />
      </div>
    </div>
  )
}
