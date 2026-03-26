import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-server'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import AutomationForm from '../../_components/AutomationForm'

interface Condition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains'
  value: string
}

interface ActionItem {
  type: 'send_internal_notification' | 'create_task' | 'send_sms' | 'add_contact_tag'
  config: Record<string, string | number>
}

export default async function EditAutomationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const locationId = await getActiveLocation(await searchParams).catch(() => null)
  if (!locationId) notFound()

  const supabase = createAdminClient()
  const { data: automation } = await supabase
    .from('automations')
    .select('id, name, trigger_type, conditions, actions')
    .eq('id', id)
    .eq('location_id', locationId)
    .single()

  if (!automation) notFound()

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
        <h1 className="text-xl font-semibold text-gray-900">Edit Automation</h1>
      </div>

      <AutomationForm
        mode="edit"
        automationId={automation.id}
        initial={{
          name: automation.name,
          triggerType: automation.trigger_type,
          conditions: automation.conditions as Condition[],
          actions: automation.actions as ActionItem[],
        }}
      />
    </div>
  )
}
