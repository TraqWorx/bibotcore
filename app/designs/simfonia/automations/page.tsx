import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { getGhlClient } from '@/lib/ghl/ghlClient'
import SimfoniaPageHeader from '../_components/SimfoniaPageHeader'
import { sf } from '@/lib/simfonia/ui'

interface Workflow {
  id: string
  name: string
  status: string
  version?: number
}

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locationId = await getActiveLocation(await searchParams).catch(() => null)

  if (!locationId) {
    return (
      <div className={`${sf.emptyPanel}`}>
        <p className="text-sm font-medium text-gray-500">Nessuna location connessa.</p>
      </div>
    )
  }

  // Try to fetch workflows from GHL
  let workflows: Workflow[] = []
  try {
    const ghl = await getGhlClient(locationId)
    const data = await ghl.workflows.list()
    workflows = ((data?.workflows ?? []) as Record<string, unknown>[]).map((w) => ({
      id: w.id as string,
      name: (w.name as string) ?? 'Senza nome',
      status: (w.status as string) ?? 'unknown',
      version: w.version as number | undefined,
    }))
  } catch {
    // GHL down — show message
  }

  const active = workflows.filter((w) => w.status === 'published' || w.status === 'active')
  const draft = workflows.filter((w) => w.status === 'draft')

  return (
    <div className="space-y-8">
      <SimfoniaPageHeader
        eyebrow="Workflow"
        title="Automazioni"
        description="Stato dei workflow GoHighLevel collegati a questa location (sola lettura)."
      />

      {workflows.length === 0 ? (
        <div className={`${sf.card} ${sf.cardPadding} text-center`}>
          <p className="text-sm text-gray-500">
            Nessun workflow trovato. Crealo e pubblicalo da Bibot.
          </p>
        </div>
      ) : (
        <>
          {/* Active workflows */}
          {active.length > 0 && (
            <div className={`${sf.card} overflow-hidden p-0 shadow-md`}>
              <div className="border-b border-gray-200/80 bg-gray-50/80 px-5 py-3.5 backdrop-blur-sm">
                <h2 className={sf.sectionLabel}>
                  Attivi ({active.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-50">
                {active.map((w) => (
                  <div key={w.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
                        <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{w.name}</p>
                        {w.version && <p className="text-[10px] text-gray-400">v{w.version}</p>}
                      </div>
                    </div>
                    <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
                      Attivo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Draft workflows */}
          {draft.length > 0 && (
            <div className={`${sf.card} overflow-hidden p-0 shadow-md`}>
              <div className="border-b border-gray-200/80 bg-gray-50/80 px-5 py-3.5 backdrop-blur-sm">
                <h2 className={sf.sectionLabel}>
                  Bozze ({draft.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-50">
                {draft.map((w) => (
                  <div key={w.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-500">{w.name}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-500">
                      Bozza
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className={`${sf.cardMuted} px-5 py-4`}>
        <p className="text-xs leading-relaxed text-gray-500">
          Le automazioni si gestiscono in Bibot. Qui vedi solo uno snapshot dello stato.
        </p>
      </div>
    </div>
  )
}
