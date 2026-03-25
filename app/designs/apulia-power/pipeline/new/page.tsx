import { getGhlClient } from '@/lib/ghl/ghlClient'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import NewOpportunityForm from './_components/NewOpportunityForm'

const BASE_URL = 'https://services.leadconnectorhq.com'

async function fetchAllContacts(locationId: string, token: string) {
  const contacts: { id: string; name: string }[] = []
  let startAfterId: string | undefined
  for (let page = 0; page < 10; page++) {
    try {
      const params = new URLSearchParams({ locationId, limit: '100' })
      if (startAfterId) params.set('startAfterId', startAfterId)
      const res = await fetch(`${BASE_URL}/contacts/?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
        next: { revalidate: 120 },
      })
      if (!res.ok) break
      const data = await res.json()
      const raw = (data?.contacts ?? []) as { id: string; firstName?: string; lastName?: string }[]
      if (raw.length === 0) break
      for (const c of raw) {
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.id
        contacts.push({ id: c.id, name })
      }
      if (raw.length < 100) break
      startAfterId = raw[raw.length - 1].id
    } catch {
      break
    }
  }
  return contacts.sort((a, b) => a.name.localeCompare(b.name))
}

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = await getActiveLocation(sp)
  const ghl = await getGhlClient(locationId)
  const token = await getGhlTokenForLocation(locationId)

  const [pipelinesData, contacts] = await Promise.all([
    ghl.pipelines.list(),
    fetchAllContacts(locationId, token),
  ])
  const pipelines = pipelinesData?.pipelines ?? []

  // Pre-select pipeline/stage if passed in query params
  const preselectedPipelineId = typeof sp.pipelineId === 'string' ? sp.pipelineId : undefined
  const preselectedStageId = typeof sp.stageId === 'string' ? sp.stageId : undefined

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Nuova Opportunità</h1>
      <NewOpportunityForm
        pipelines={pipelines}
        contacts={contacts}
        locationId={locationId}
        preselectedPipelineId={preselectedPipelineId}
        preselectedStageId={preselectedStageId}
      />
    </div>
  )
}
