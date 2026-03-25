import Link from 'next/link'
import NewPackagePageForm from './_components/NewPackagePageForm'

export default function AdminNewPackagePage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/admin/packages"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Back to Packages
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">New Package</h1>
      </div>
      <NewPackagePageForm />
    </div>
  )
}
