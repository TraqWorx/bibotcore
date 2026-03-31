import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { createAdminClient } from '@/lib/supabase-server'
import { getGhlClient } from '@/lib/ghl/ghlClient'

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
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">Nessuna location connessa.</p>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Automazioni</h1>
        <p className="mt-1 text-sm text-gray-500">
          Workflow attivi configurati in GoHighLevel
        </p>
      </div>

      {workflows.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-400">Nessun workflow trovato. Crea i workflow direttamente in GoHighLevel.</p>
        </div>
      ) : (
        <>
          {/* Active workflows */}
          {active.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
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
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
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

      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
        <p className="text-xs text-gray-400">
          Le automazioni vengono create e gestite direttamente in GoHighLevel. Questa pagina mostra solo lo stato attuale.
        </p>
      </div>
    </div>
  )
}
