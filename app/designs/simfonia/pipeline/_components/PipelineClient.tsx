'use client'

import Link from 'next/link'
import useSWR from 'swr'
import PipelineView from '../PipelineView'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function PipelineClient({ locationId }: { locationId: string }) {
  const { data, isLoading } = useSWR(`/api/pipeline?locationId=${locationId}`, fetcher, {
    revalidateOnFocus: false,
  })

  const pipelines = data?.pipelines ?? []
  const opportunities = data?.opportunities ?? []
  const q = `?locationId=${locationId}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isLoading ? (
              <span className="inline-block h-4 w-16 animate-pulse rounded bg-gray-200" />
            ) : (
              <>{opportunities.length} opportunità</>
            )}
          </p>
        </div>
        <Link
          href={`/designs/simfonia/pipeline/new${q}`}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-black transition-all hover:opacity-90"
          style={{ background: '#00F0FF' }}
        >
          + Nuova Opportunità
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#2A00CC]" />
          <p className="mt-3 text-sm text-gray-400">Caricamento pipeline...</p>
        </div>
      ) : pipelines.length === 0 ? (
        <p className="text-sm text-gray-500">Nessuna pipeline trovata.</p>
      ) : (
        <PipelineView pipelines={pipelines} opportunities={opportunities} locationId={locationId} />
      )}
    </div>
  )
}
