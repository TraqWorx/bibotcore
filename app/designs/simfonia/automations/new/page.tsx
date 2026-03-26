import Link from 'next/link'
import AutomationForm from '../_components/AutomationForm'

export default function NewAutomationPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/designs/simfonia/automations"
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← Automations
        </Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-xl font-semibold text-gray-900">New Automation</h1>
      </div>

      <AutomationForm mode="create" />
    </div>
  )
}
