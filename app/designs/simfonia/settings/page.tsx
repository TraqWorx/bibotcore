import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-server'
import { getActiveLocation } from '@/lib/location/getActiveLocation'
import { getGhlTokenForLocation } from '@/lib/ghl/getGhlTokenForLocation'
import { DEFAULT_THEME, type DesignTheme } from '@/lib/types/design'
import { getCategoryTags, getClosedDays, getGareMensili, getLocationTags, getProvvigioni, getUserAvailability, getUniqueFields } from './_actions'
import {
  discoverCategories,
  getProviderField,
  type CustomFieldDef,
} from '@/lib/utils/categoryFields'
import SettingsTabs from './_components/SettingsTabs'
import TargetForm from './_components/TargetForm'
import GareForm from './_components/GareForm'
import ProvvigioniForm from './_components/ProvvigioniForm'
import AvailabilityForm from './_components/AvailabilityForm'
import TagsManager from './_components/TagsManager'
import CategoryTagsForm from './_components/CategoryTagsForm'
import ThemeForm from './_components/ThemeForm'
import ClosedDaysForm from './_components/ClosedDaysForm'
import UniqueFieldsForm from './_components/UniqueFieldsForm'

const BASE_URL = 'https://services.leadconnectorhq.com'

interface GhlUser {
  id: string
  name: string
  email: string
}

async function fetchGhlUsers(token: string, locationId: string): Promise<GhlUser[]> {
  try {
    const res = await fetch(`${BASE_URL}/users/?locationId=${locationId}`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return ((data?.users ?? []) as { id: string; name?: string; firstName?: string; lastName?: string; email?: string }[]).map((u) => ({
      id: u.id,
      name: u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.id,
      email: u.email ?? '',
    }))
  } catch {
    return []
  }
}

async function fetchCustomFields(token: string, locationId: string): Promise<CustomFieldDef[]> {
  try {
    const res = await fetch(`${BASE_URL}/locations/${locationId}/customFields`, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return ((data?.customFields ?? []) as CustomFieldDef[]).map((cf) => ({
      id: cf.id,
      name: cf.name,
      fieldKey: cf.fieldKey ?? cf.id,
      dataType: cf.dataType ?? 'TEXT',
      placeholder: cf.placeholder,
      picklistOptions: cf.picklistOptions,
    }))
  } catch {
    return []
  }
}

/** Collect all gestore picklist options across all categories */
function getAllGestoreOptions(customFields: CustomFieldDef[], categories: { label: string }[]): string[] {
  const allOptions = new Set<string>()
  for (const cat of categories) {
    const pf = getProviderField(customFields, cat.label)
    if (pf?.picklistOptions) {
      for (const opt of pf.picklistOptions) allOptions.add(opt)
    }
  }
  return Array.from(allOptions).sort()
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const locationId = await getActiveLocation(sp).catch(() => null)

  if (!locationId) redirect('/designs/simfonia/dashboard')

  const supabase = createAdminClient()
  const currentMonth = getCurrentMonth()
  const token = await getGhlTokenForLocation(locationId).catch(() => null)

  const [settingsRes, themeRes, gareRows, locationTags, provvigioniRows, availabilitySlots, ghlUsers, customFields, categoryTagsMap, closedDays, uniqueFieldIds] = await Promise.all([
    supabase
      .from('location_settings')
      .select('target_annuale')
      .eq('location_id', locationId)
      .single(),
    supabase
      .from('location_design_settings')
      .select('theme_overrides')
      .eq('location_id', locationId)
      .single(),
    getGareMensili(locationId, currentMonth),
    getLocationTags(locationId),
    getProvvigioni(locationId),
    getUserAvailability(locationId),
    token ? fetchGhlUsers(token, locationId) : Promise.resolve([]),
    token ? fetchCustomFields(token, locationId) : Promise.resolve([]),
    getCategoryTags(locationId).catch(() => ({} as Record<string, string[]>)),
    getClosedDays(locationId),
    getUniqueFields(locationId),
  ])

  const ghlTags = locationTags.map((t) => t.name)
  const ghlTagsWithIds = locationTags.map((t) => ({ id: t.id, name: t.name }))
  const categories = discoverCategories(customFields)
  const gestoriOptions = getAllGestoreOptions(customFields, categories)

  const currentTarget = settingsRes.data?.target_annuale ?? 1900
  const overrides = (themeRes.data?.theme_overrides ?? {}) as Partial<DesignTheme>

  const tabs = [
    {
      id: 'obiettivi',
      label: 'Obiettivi',
      content: (
        <div className="space-y-6">
          <TargetForm locationId={locationId} currentTarget={currentTarget} />
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-bold text-gray-800">Gare Mensili</h2>
            <p className="mt-1 mb-5 text-sm text-gray-500">
              Imposta gli obiettivi mensili per operatore/categoria.
            </p>
            <GareForm
              locationId={locationId}
              month={currentMonth}
              initialRows={gareRows}
              gestoriOptions={gestoriOptions}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'tags',
      label: 'Tags',
      content: (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-bold text-gray-800">Gestione Tags</h2>
          <p className="mt-1 mb-5 text-sm text-gray-500">
            Aggiungi o rimuovi tag GHL per questa location.
          </p>
          <TagsManager
            locationId={locationId}
            initialTags={locationTags}
          />
        </div>
      ),
    },
    {
      id: 'categorie-tags',
      label: 'Categorie & Tag',
      content: (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-bold text-gray-800">Tag per Categoria</h2>
          <p className="mt-1 mb-5 text-sm text-gray-500">
            Associa tag a ciascuna categoria. Solo i tag associati verranno mostrati nei filtri e nella creazione contatti.
          </p>
          <CategoryTagsForm
            locationId={locationId}
            categories={categories}
            allTags={ghlTagsWithIds}
            initialCategoryTags={categoryTagsMap}
          />
        </div>
      ),
    },
    {
      id: 'provvigioni',
      label: 'Provvigioni',
      content: (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-bold text-gray-800">Calcolatore Provvigioni</h2>
          <p className="mt-1 mb-5 text-sm text-gray-500">
            Configura i tipi di provvigione con importo fisso o percentuale.
          </p>
          <ProvvigioniForm
            locationId={locationId}
            initialRows={provvigioniRows}
          />
        </div>
      ),
    },
    {
      id: 'calendario',
      label: 'Calendario',
      content: (
        <AvailabilityForm
          locationId={locationId}
          users={ghlUsers.map((u) => ({ id: u.id, name: u.name }))}
          initialSlots={availabilitySlots}
        />
      ),
    },
    {
      id: 'chiusure',
      label: 'Chiusure',
      content: (
        <ClosedDaysForm locationId={locationId} initialDays={closedDays} />
      ),
    },
    {
      id: 'campi-univoci',
      label: 'Campi Univoci',
      content: (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-bold text-gray-800">Campi Univoci</h2>
          <p className="mt-1 mb-5 text-sm text-gray-500">
            Seleziona i campi personalizzati che devono avere valori unici tra i contatti (es. POD, PDR).
          </p>
          <UniqueFieldsForm
            locationId={locationId}
            customFields={customFields}
            initialUniqueFieldIds={uniqueFieldIds}
          />
        </div>
      ),
    },
    {
      id: 'aspetto',
      label: 'Aspetto',
      content: (
        <ThemeForm
          locationId={locationId}
          primaryColor={overrides.primaryColor ?? DEFAULT_THEME.primaryColor}
          secondaryColor={overrides.secondaryColor ?? DEFAULT_THEME.secondaryColor}
          logoUrl={overrides.logoUrl ?? ''}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Impostazioni</h1>
        <p className="mt-0.5 text-sm text-gray-500">Configurazione per questa location</p>
      </div>

      <SettingsTabs tabs={tabs} />
    </div>
  )
}
