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

  const openOpps = opportunities.filter(
    (o: { status?: string }) => (o.status ?? 'open').toLowerCase() === 'open'
  )
  const openValue = openOpps.reduce(
    (s: number, o: { monetaryValue?: number }) => s + (o.monetaryValue ?? 0),
    0
  )

  return (
    <div className="space-y-8">
      {/* Page hero */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-br from-white via-[color-mix(in_srgb,var(--brand)_4%,white)] to-[color-mix(in_srgb,var(--accent)_6%,white)] px-6 py-8 shadow-sm sm:px-10 sm:py-10">
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full opacity-90 blur-3xl"
          style={{ background: 'color-mix(in srgb, var(--accent) 18%, transparent)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full opacity-80 blur-3xl"
          style={{ background: 'color-mix(in srgb, var(--brand) 14%, transparent)' }}
        />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
              Vendite
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Pipeline
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
              Gestisci gli stage, filtra per esito, cerca in fretta. Trascina le card per spostare le
              opportunità o apri il pannello per messaggi, note e attività.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <StatChip label="Aperte" value={isLoading ? '—' : String(openOpps.length)} />
              <StatChip
                label="Valore (aperte)"
                value={isLoading ? '—' : `€${openValue.toLocaleString('it-IT')}`}
                emphasize
              />
              <StatChip label="In anagrafica" value={isLoading ? '—' : String(opportunities.length)} />
            </div>
          </div>
          <Link
            href={`/designs/simfonia/pipeline/new${q}`}
            className="relative inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-gray-900/10 px-7 py-3.5 text-sm font-bold text-gray-900 shadow-[0_12px_40px_-12px_color-mix(in_srgb,var(--brand)_35%,transparent)] transition hover:brightness-[1.03] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 88%, white) 100%)',
            }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuova opportunità
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white/60 px-8 py-16 text-center backdrop-blur-sm">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-brand" />
          <p className="mt-4 text-sm font-medium text-gray-500">Caricamento pipeline…</p>
        </div>
      ) : pipelines.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-white/90 p-12 text-center shadow-sm">
          <p className="text-sm text-gray-500">Nessuna pipeline trovata.</p>
        </div>
      ) : (
        <PipelineView pipelines={pipelines} opportunities={opportunities} locationId={locationId} />
      )}
    </div>
  )
}

function StatChip({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div className="inline-flex items-baseline gap-2 rounded-2xl border border-gray-200/90 bg-white/85 px-4 py-2.5 shadow-sm backdrop-blur-sm">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${emphasize ? 'text-brand' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  )
}
