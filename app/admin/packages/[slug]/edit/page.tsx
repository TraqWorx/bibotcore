import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-server'
import EditPackageForm from './_components/EditPackageForm'

export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: pkg } = await supabase
    .from('packages')
    .select('slug, name, description, price_monthly, auto_install, auto_apply_design, status')
    .eq('slug', slug)
    .single()

  if (!pkg) notFound()

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/admin/packages"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Back to Packages
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">Edit — {pkg.name}</h1>
      </div>
      <EditPackageForm pkg={pkg} />
    </div>
  )
}
