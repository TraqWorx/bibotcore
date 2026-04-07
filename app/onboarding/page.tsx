import Link from 'next/link'

export default function OnboardingPage() {
  return (
    <div className="space-y-8 text-center">
      <div>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-2xl font-black text-brand">
          GD
        </div>
        <h1 className="mt-6 text-2xl font-bold text-gray-900">GHL Dash</h1>
        <p className="mt-2 text-sm text-gray-500">
          Create beautiful, embeddable dashboards for your GoHighLevel sub-accounts.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm">
          <h3 className="font-bold text-gray-900">Basic Plan — $10/mo per location</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
            <li>Pre-built dashboard templates</li>
            <li>Basic widget set</li>
            <li>GHL data sync</li>
            <li>Embed via iframe</li>
          </ul>
        </div>

        <div className="rounded-2xl border-2 border-brand/20 bg-white p-6 text-left shadow-sm">
          <h3 className="font-bold text-brand">Pro Plan — $19/mo per location</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
            <li>Everything in Basic</li>
            <li>AI dashboard designer</li>
            <li>Full widget library</li>
            <li>Custom KPIs and branding</li>
          </ul>
        </div>
      </div>

      <Link
        href="/login"
        className="inline-flex rounded-xl bg-brand px-8 py-3 text-sm font-bold text-white shadow-md hover:opacity-90"
      >
        Get Started
      </Link>
    </div>
  )
}
