'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import PipelineView from '../PipelineView'

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json())

interface Stage { id: string; name: string }
interface Pipeline { id: string; name: string; stages: Stage[] }
interface Opportunity {
  id: string
  name?: string
  pipelineId?: string
  pipelineStageId?: string
  monetaryValue?: number
  status?: string
  contactId?: string
  assignedTo?: string | null
  contact?: { name?: string; firstName?: string; lastName?: string; email?: string | null; phone?: string | null; company?: string | null; tags?: string[] }
}

export default function PipelineClient({
  locationId,
  demoPipelines,
  demoOpportunities,
  demoMode = false,
}: {
  locationId: string
  demoPipelines?: Pipeline[]
  demoOpportunities?: Opportunity[]
  demoMode?: boolean
}) {
  const searchParams = useSearchParams()
  const created = searchParams.get('created')
  const swrKey = `/api/pipeline?locationId=${locationId}${created ? `&fresh=${created}` : ''}`
  const { data, isLoading, mutate } = useSWR(demoPipelines ? null : swrKey, fetcher, {
    revalidateOnFocus: false,
    revalidateOnMount: true,
  })

  useEffect(() => {
    if (!created) return
    void mutate()
  }, [created, mutate])

  const pipelines = demoPipelines ?? data?.pipelines ?? []
  const opportunities = demoOpportunities ?? data?.opportunities ?? []

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-7rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
          <p className="mt-4 text-sm font-medium text-gray-500">Caricamento pipeline…</p>
        </div>
      </div>
    )
  }

  if (pipelines.length === 0) {
    return (
      <div className="flex h-[calc(100vh-7rem)] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-500">Nessuna pipeline trovata.</p>
        </div>
      </div>
    )
  }

  return (
    <PipelineView pipelines={pipelines} opportunities={opportunities} locationId={locationId} demoMode={demoMode} />
  )
}
