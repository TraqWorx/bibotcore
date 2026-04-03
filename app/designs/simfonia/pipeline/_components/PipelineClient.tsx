'use client'

import useSWR from 'swr'
import PipelineView from '../PipelineView'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function PipelineClient({ locationId }: { locationId: string }) {
  const { data, isLoading } = useSWR(`/api/pipeline?locationId=${locationId}`, fetcher, {
    revalidateOnFocus: false,
  })

  const pipelines = data?.pipelines ?? []
  const opportunities = data?.opportunities ?? []

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
    <PipelineView pipelines={pipelines} opportunities={opportunities} locationId={locationId} />
  )
}
